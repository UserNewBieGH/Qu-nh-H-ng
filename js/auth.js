/**
 * Authentication & Role-Based Access Control (RBAC) Module for Cô Tư Alley Tour
 * Manages Customer vs Admin accounts, session state, pre-bookings & customer activity logs
 */

window.AuthManager = (function() {
  const USERS_STORAGE_KEY = 'co_tu_users';
  const CURRENT_USER_KEY = 'co_tu_current_user';
  const PREBOOKINGS_KEY = 'co_tu_prebookings';
  const ACTIVITIES_KEY = 'co_tu_activities';
  const ORDERS_STORAGE_KEY = 'co_tu_orders';
  const SYNC_QUEUE_KEY = 'co_tu_sync_queue';

  let currentUser = null;
  const authListeners = [];
  const syncListeners = [];
  const pendingMutations = new Set();

  let backendAvailable = null; // null = unknown, true = server.js active, false = static/offline
  let syncInFlight = null;
  let lastServerRevision = 0;
  let sseSource = null;
  let fallbackPollTimer = null;
  let realtimeStarted = false;
  let storageListenerBound = false;

  function isHttpOrigin() {
    return (
      typeof window !== 'undefined' &&
      window.location &&
      /^https?:$/i.test(window.location.protocol) &&
      typeof fetch === 'function'
    );
  }

  function nextMutationToken(prefix) {
    const token = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    pendingMutations.add(token);
    return token;
  }

  function finishMutationToken(token) {
    pendingMutations.delete(token);
  }

  async function apiRequest(method, url, body = undefined, extraOptions = {}) {
    if (!isHttpOrigin()) {
      return { ok: false, offline: true, status: 0, data: null };
    }
    try {
      const fetchOpts = {
        method,
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        ...extraOptions
      };
      if (body !== undefined) {
        fetchOpts.body = JSON.stringify(body);
      }
      const res = await fetch(url, fetchOpts);
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        if (res.status === 404 || res.status === 405 || res.status === 200) {
          backendAvailable = false;
        }
        return { ok: false, nonJson: true, status: res.status, data: null };
      }
      const data = await res.json();
      backendAvailable = true;
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      return { ok: false, networkError: true, status: 0, data: null, error: err };
    }
  }

  function getSyncQueue() {
    try {
      const raw = safeGetStorage(SYNC_QUEUE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveSyncQueue(queue) {
    try {
      if (!queue || queue.length === 0) {
        localStorage.removeItem(SYNC_QUEUE_KEY);
      } else {
        localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-50)));
      }
    } catch (_) {}
  }

  function enqueueMutation(method, url, body) {
    const queue = getSyncQueue();
    queue.push({ method, url, body, queuedAt: Date.now() });
    saveSyncQueue(queue);
  }

  let flushInFlight = null;
  async function flushSyncQueue() {
    if (!isHttpOrigin() || backendAvailable === false) return { remaining: 0 };
    if (flushInFlight) return flushInFlight;

    flushInFlight = (async () => {
      let queue = getSyncQueue();
      if (queue.length === 0) return { remaining: 0 };
      const remaining = [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        const res = await apiRequest(item.method, item.url, item.body, { keepalive: true });
        if (res.nonJson || backendAvailable === false) {
          saveSyncQueue([]);
          return { remaining: 0 };
        }
        if (res.networkError || res.status >= 500) {
          remaining.push(item, ...queue.slice(i + 1));
          break;
        }
        // 2xx or 4xx handled cleanly -> remove from queue
      }
      saveSyncQueue(remaining);
      return { remaining: remaining.length };
    })().finally(() => {
      flushInFlight = null;
    });
    return flushInFlight;
  }

  function sendMutation(method, url, body, prefix = 'mut', options = {}) {
    if (!isHttpOrigin() || backendAvailable === false) {
      return Promise.resolve({ ok: false, offline: true });
    }
    const mutToken = nextMutationToken(prefix);
    return apiRequest(method, url, body, { keepalive: true }).then((res) => {
      if (res.nonJson || backendAvailable === false) {
        saveSyncQueue([]);
      } else if (res.networkError || res.status >= 500) {
        enqueueMutation(method, url, body);
      } else if (!res.ok && options.onClientError) {
        options.onClientError(res);
      }
      return res;
    }).finally(() => {
      finishMutationToken(mutToken);
      if (pendingMutations.size === 0 && backendAvailable === true) {
        syncFromServer({ source: `${prefix}-done` });
      }
    });
  }

  function onDataSynced(fn) {
    if (typeof fn === 'function' && !syncListeners.includes(fn)) {
      syncListeners.push(fn);
    }
  }

  function notifyDataSynced(meta = {}) {
    syncListeners.forEach(fn => {
      try { fn(meta); } catch (e) { console.error('Sync listener err:', e); }
    });
  }

  function applyServerState(state, meta = {}) {
    if (!state || typeof state !== 'object') return false;
    const prevOrdersRaw = safeGetStorage(ORDERS_STORAGE_KEY);
    const prevPreRaw = safeGetStorage(PREBOOKINGS_KEY);
    const prevUsersRaw = safeGetStorage(USERS_STORAGE_KEY);
    const prevActRaw = safeGetStorage(ACTIVITIES_KEY);

    if (Array.isArray(state.orders) && pendingMutations.size === 0) {
      safeSetStorage(ORDERS_STORAGE_KEY, JSON.stringify(state.orders));
    }
    if (Array.isArray(state.prebookings) && pendingMutations.size === 0) {
      safeSetStorage(PREBOOKINGS_KEY, JSON.stringify(state.prebookings));
    }
    if (Array.isArray(state.users)) {
      // Preserve local password field if present for offline/test parity, merge server updates
      let mergedUsers = state.users;
      try {
        const localUsers = prevUsersRaw ? JSON.parse(prevUsersRaw) : [];
        if (Array.isArray(localUsers) && localUsers.length > 0) {
          const pwMap = new Map(localUsers.filter(u => u && u.password).map(u => [u.id, u.password]));
          mergedUsers = state.users.map(u => (pwMap.has(u.id) ? { ...u, password: pwMap.get(u.id) } : u));
        }
      } catch (_) {}
      safeSetStorage(USERS_STORAGE_KEY, JSON.stringify(mergedUsers));

      if (currentUser && currentUser.id) {
        const freshMe = state.users.find(u => u.id === currentUser.id);
        if (freshMe) {
          const mergedMe = { ...currentUser, ...freshMe };
          currentUser = mergedMe;
          safeSetStorage(CURRENT_USER_KEY, JSON.stringify(currentUser));
        }
      }
    }
    if (Array.isArray(state.activities)) {
      safeSetStorage(ACTIVITIES_KEY, JSON.stringify(state.activities));
    }

    const revChanged = typeof state.revision === 'number' && state.revision !== lastServerRevision;
    if (typeof state.revision === 'number') {
      lastServerRevision = state.revision;
    }

    const dataChanged =
      prevOrdersRaw !== safeGetStorage(ORDERS_STORAGE_KEY) ||
      prevPreRaw !== safeGetStorage(PREBOOKINGS_KEY) ||
      prevUsersRaw !== safeGetStorage(USERS_STORAGE_KEY) ||
      prevActRaw !== safeGetStorage(ACTIVITIES_KEY);

    if (dataChanged || revChanged || meta.forceNotify) {
      notifyDataSynced({
        ...meta,
        revision: lastServerRevision,
        ordersChanged: prevOrdersRaw !== safeGetStorage(ORDERS_STORAGE_KEY),
        prebookingsChanged: prevPreRaw !== safeGetStorage(PREBOOKINGS_KEY),
        usersChanged: prevUsersRaw !== safeGetStorage(USERS_STORAGE_KEY),
        activitiesChanged: prevActRaw !== safeGetStorage(ACTIVITIES_KEY)
      });
    }
    return dataChanged;
  }

  function safeGetStorage(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeSetStorage(key, val) {
    try { localStorage.setItem(key, val); } catch (_) {}
  }

  async function syncFromServer(meta = {}) {
    if (!isHttpOrigin()) return { ok: false, offline: true };
    if (syncInFlight) return syncInFlight;

    syncInFlight = (async () => {
      if (backendAvailable !== false) {
        const flushed = await flushSyncQueue();
        if (flushed && flushed.remaining > 0) {
          return { ok: false, queued: true };
        }
      }
      const res = await apiRequest('GET', '/api/state');
      if (res.ok && res.data && Array.isArray(res.data.orders)) {
        applyServerState(res.data, meta);
        if (realtimeStarted) {
          if (!sseSource) connectSSE();
          ensureFallbackPoll();
        }
        return { ok: true, state: res.data };
      }
      return { ok: false, status: res.status };
    })().finally(() => {
      syncInFlight = null;
    });

    return syncInFlight;
  }

  function ensureFallbackPoll() {
    if (!isHttpOrigin() || fallbackPollTimer || backendAvailable === false) return;
    fallbackPollTimer = setInterval(() => {
      if (backendAvailable === false) {
        clearInterval(fallbackPollTimer);
        fallbackPollTimer = null;
        return;
      }
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      const sseOpen = sseSource && sseSource.readyState === 1;
      if (!sseOpen) {
        syncFromServer({ source: 'poll-fallback' });
      }
    }, 4000);
  }

  function connectSSE() {
    if (!isHttpOrigin() || typeof EventSource !== 'function' || backendAvailable === false) return;
    if (sseSource) return;

    try {
      sseSource = new EventSource('/api/events');
      sseSource.addEventListener('connected', (evt) => {
        backendAvailable = true;
        try {
          const payload = JSON.parse(evt.data || '{}');
          if (payload.revision && payload.revision !== lastServerRevision) {
            syncFromServer({ source: 'sse-connected', eventType: 'connected' });
          }
        } catch (_) {}
        notifyDataSynced({ source: 'sse-status', connected: true });
      });

      const handleEvent = (evt) => {
        try {
          const payload = JSON.parse(evt.data || '{}');
          syncFromServer({ source: 'sse', eventType: payload.type || 'state:changed', payload });
        } catch (_) {
          syncFromServer({ source: 'sse', eventType: 'state:changed' });
        }
      };

      sseSource.addEventListener('state', handleEvent);
      sseSource.onmessage = handleEvent;

      sseSource.onerror = () => {
        notifyDataSynced({ source: 'sse-status', connected: false });
      };
    } catch (e) {
      sseSource = null;
    }
  }

  function startRealtimeSync() {
    if (!isHttpOrigin() || realtimeStarted) return;
    realtimeStarted = true;

    syncFromServer({ source: 'init' }).then((res) => {
      if (res && res.ok) {
        connectSSE();
        ensureFallbackPoll();
      } else if (backendAvailable !== false) {
        ensureFallbackPoll();
      }
    });

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('focus', () => {
        if (backendAvailable !== false) syncFromServer({ source: 'focus' });
      });
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && backendAvailable !== false) {
          syncFromServer({ source: 'visibility' });
        }
      });
    }
  }

  function normalizePhone(p) {
    if (!p) return '';
    let clean = String(p).replace(/[\s.-]/g, '');
    if (clean.startsWith('+84')) {
      clean = '0' + clean.slice(3);
    } else if (clean.startsWith('84') && clean.length >= 10) {
      clean = '0' + clean.slice(2);
    }
    return clean;
  }

  function init() {
    seedInitialData();
    loadSession();
    setupUIListeners();
    syncUIState();
    startRealtimeSync();
    if (!storageListenerBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      storageListenerBound = true;
      window.addEventListener('storage', (e) => {
        if (e.key === CURRENT_USER_KEY) {
          loadSession();
          notifyAuthStateChanged();
        } else if (e.key && [ORDERS_STORAGE_KEY, PREBOOKINGS_KEY, USERS_STORAGE_KEY, ACTIVITIES_KEY].includes(e.key)) {
          if (isCustomer()) {
            renderCustomerPortal();
          }
          notifyDataSynced({ source: 'storage', key: e.key });
        }
      });
    }
    onDataSynced(() => {
      if (isCustomer()) {
        renderCustomerPortal();
      }
    });
  }

  function seedInitialData() {
    try {
      if (!localStorage.getItem(USERS_STORAGE_KEY)) {
        const initialUsers = window.CO_TU_DATA?.initialUsers || [];
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(initialUsers));
      }
      if (!localStorage.getItem(PREBOOKINGS_KEY)) {
        const initialPreBookings = window.CO_TU_DATA?.initialPreBookings || [];
        localStorage.setItem(PREBOOKINGS_KEY, JSON.stringify(initialPreBookings));
      }
      if (!localStorage.getItem(ACTIVITIES_KEY)) {
        const initialActivities = window.CO_TU_DATA?.initialActivities || [];
        localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(initialActivities));
      }
    } catch (e) {
      console.warn('Error seeding auth initial data:', e);
    }
  }

  function loadSession() {
    try {
      const stored = localStorage.getItem(CURRENT_USER_KEY);
      if (stored) {
        currentUser = JSON.parse(stored);
      } else {
        currentUser = null;
      }
    } catch (e) {
      currentUser = null;
    }
  }

  function getUsers() {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : (window.CO_TU_DATA?.initialUsers || []);
    } catch (e) {
      return window.CO_TU_DATA?.initialUsers || [];
    }
  }

  function saveUsers(users) {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Could not save users:', e);
    }
  }

  function getCurrentUser() {
    return currentUser;
  }

  function isAuthenticated() {
    return !!currentUser;
  }

  function isAdmin() {
    return !!currentUser && currentUser.role === 'admin';
  }

  function isCustomer() {
    return !!currentUser && currentUser.role === 'customer';
  }

  function onAuthStateChanged(fn) {
    if (typeof fn === 'function') {
      authListeners.push(fn);
    }
  }

  function notifyAuthStateChanged() {
    syncUIState();
    authListeners.forEach(fn => {
      try { fn(currentUser); } catch (e) { console.error('Auth listener err:', e); }
    });
  }

  function login(identifier, password, options = {}) {
    const rawId = (identifier || '').trim();
    const trimmedId = rawId.toLowerCase();
    const normalizedPhoneId = normalizePhone(rawId);
    const trimmedPw = (password || '').trim();

    if (!trimmedId || !trimmedPw) {
      return { success: false, message: 'Vui lòng nhập đầy đủ tài khoản/email/SĐT và mật khẩu!' };
    }

    const users = getUsers();
    const user = users.find(u => 
      (u.username && u.username.toLowerCase() === trimmedId) ||
      (u.email && u.email.toLowerCase() === trimmedId) ||
      (normalizedPhoneId && u.phone && normalizePhone(u.phone) === normalizedPhoneId)
    );

    if (!user) {
      return { success: false, message: 'Tài khoản không tồn tại trong hệ thống!' };
    }

    if (user.password !== trimmedPw) {
      return { success: false, message: 'Mật khẩu không chính xác. Vui lòng thử lại!' };
    }

    if (options && options.requiredRole && user.role !== options.requiredRole) {
      if (options.requiredRole === 'customer') {
        return {
          success: false,
          code: 'role_mismatch',
          message: 'Cổng đăng nhập này chỉ dành riêng cho tài khoản Khách Hàng. Vui lòng sử dụng tài khoản khách hàng hoặc đăng ký mới!'
        };
      }
      return {
        success: false,
        code: 'role_mismatch',
        message: `Từ chối truy cập: Tài khoản ${user.fullName} là Khách Hàng, không có quyền Quản Trị Viên. Vui lòng quay lại trang dành cho khách hàng!`
      };
    }

    // Set Session
    currentUser = { ...user };
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } catch (e) {}

    logActivity('Đăng nhập hệ thống', `Đăng nhập thành công với vai trò ${user.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng'}`);
    notifyAuthStateChanged();

    return { 
      success: true, 
      user: currentUser, 
      message: `Chào mừng ${user.fullName} (${user.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng'}) đã đăng nhập!` 
    };
  }

  async function loginAsync(identifier, password, options = {}) {
    if (isHttpOrigin() && backendAvailable !== false) {
      const res = await apiRequest('POST', '/api/users/login', {
        identifier,
        password,
        requiredRole: options && options.requiredRole ? options.requiredRole : undefined
      });
      if (!res.offline && !res.nonJson && !res.networkError) {
        if (res.ok && res.data && res.data.success && res.data.user) {
          currentUser = { ...res.data.user };
          safeSetStorage(CURRENT_USER_KEY, JSON.stringify(currentUser));
          notifyAuthStateChanged();
          await syncFromServer({ source: 'login' });
          return res.data;
        }
        return res.data || { success: false, message: 'Đăng nhập thất bại. Vui lòng thử lại!' };
      }
    }
    return login(identifier, password, options);
  }

  function register(data) {
    const { fullName, phone, email, password, dietary } = data;
    
    // Validations
    if (!fullName || fullName.trim().length < 2) {
      return { success: false, message: 'Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự)!' };
    }

    const phoneClean = normalizePhone(phone);
    const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
    if (!phoneRegex.test(phoneClean)) {
      return { success: false, message: 'Số điện thoại không đúng chuẩn viễn thông Việt Nam (10 số, đầu 03, 05, 07, 08, 09)!' };
    }

    const emailClean = (email || '').trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailClean)) {
      return { success: false, message: 'Địa chỉ email không hợp lệ!' };
    }

    if (!password || password.length < 6) {
      return { success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự bảo mật!' };
    }

    const users = getUsers();
    const existingEmail = users.find(u => u.email && u.email.toLowerCase() === emailClean);
    if (existingEmail) {
      return { success: false, message: 'Địa chỉ email này đã được đăng ký tài khoản trước đó!' };
    }

    const existingPhone = users.find(u => u.phone && normalizePhone(u.phone) === phoneClean);
    if (existingPhone) {
      return { success: false, message: 'Số điện thoại này đã được liên kết với một tài khoản!' };
    }

    const newUser = {
      id: 'usr-cust-' + Date.now(),
      username: emailClean.split('@')[0],
      email: emailClean,
      password: password,
      fullName: fullName.trim(),
      phone: phoneClean,
      role: 'customer',
      dietary: dietary || 'Ăn được tất cả',
      tier: 'Hội Viên Thân Thiết Mới',
      avatar: '👤',
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);

    // Auto login
    currentUser = { ...newUser };
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } catch (e) {}

    logActivity('Đăng ký tài khoản mới', `Khách hàng ${newUser.fullName} tạo tài khoản mới qua SĐT ${newUser.phone}`, newUser.id);
    notifyAuthStateChanged();

    return { 
      success: true, 
      user: currentUser, 
      message: `Chúc mừng ${newUser.fullName}! Bạn đã tạo tài khoản khách hàng thành công.` 
    };
  }

  async function registerAsync(data) {
    if (isHttpOrigin() && backendAvailable !== false) {
      const mutToken = nextMutationToken('user-register');
      try {
        const res = await apiRequest('POST', '/api/users/register', data);
        if (!res.offline && !res.nonJson && !res.networkError) {
          if (res.ok && res.data && res.data.success && res.data.user) {
            const users = getUsers();
            if (!users.some(u => u.id === res.data.user.id)) {
              users.push(res.data.user);
              saveUsers(users);
            }
            currentUser = { ...res.data.user };
            safeSetStorage(CURRENT_USER_KEY, JSON.stringify(currentUser));
            notifyAuthStateChanged();
            finishMutationToken(mutToken);
            await syncFromServer({ source: 'register' });
            return res.data;
          }
          return res.data || { success: false, message: 'Đăng ký tài khoản thất bại!' };
        }
      } finally {
        finishMutationToken(mutToken);
      }
    }
    return register(data);
  }

  function clearProfileDirtyFlags() {
    if (typeof document === 'undefined') return;
    ['cust-profile-fullname', 'cust-profile-phone', 'cust-profile-dietary'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.dataset) delete el.dataset.dirty;
    });
  }

  function logout() {
    if (currentUser) {
      logActivity('Đăng xuất', `Tài khoản ${currentUser.fullName} (${currentUser.role}) đăng xuất`);
    }
    currentUser = null;
    try {
      localStorage.removeItem(CURRENT_USER_KEY);
    } catch (e) {}
    clearAutofilledBookingInputs(true);
    clearProfileDirtyFlags();
    notifyAuthStateChanged();
    return { success: true, message: 'Đã đăng xuất an toàn khỏi hệ thống!' };
  }

  function updateCustomerProfile(data) {
    if (!currentUser) return { success: false, message: 'Chưa đăng nhập!' };
    
    const users = getUsers();
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx === -1) return { success: false, message: 'Không tìm thấy tài khoản!' };

    if (data.fullName !== undefined) {
      const cleanName = String(data.fullName).trim();
      if (cleanName.length < 2) {
        return { success: false, message: 'Họ và tên phải có ít nhất 2 ký tự!' };
      }
      users[idx].fullName = cleanName;
    }

    if (data.phone !== undefined) {
      const cleanPhone = normalizePhone(data.phone);
      const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
      if (!phoneRegex.test(cleanPhone)) {
        return { success: false, message: 'Số điện thoại không đúng chuẩn Việt Nam (10 số, đầu 03, 05, 07, 08, 09)!' };
      }
      const duplicate = users.find(u => u.id !== currentUser.id && u.phone && normalizePhone(u.phone) === cleanPhone);
      if (duplicate) {
        return { success: false, message: 'Số điện thoại này đã được liên kết với một tài khoản khác!' };
      }
      users[idx].phone = cleanPhone;
    }

    if (data.dietary !== undefined) {
      users[idx].dietary = String(data.dietary).trim() || 'Ăn được tất cả';
    }

    currentUser = { ...users[idx] };
    saveUsers(users);
    try {
      localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
    } catch (e) {}

    clearProfileDirtyFlags();
    logActivity('Cập nhật hồ sơ & khẩu vị', `Khách hàng ${currentUser.fullName} cập nhật khẩu vị cá nhân: ${currentUser.dietary}`);
    notifyAuthStateChanged();

    return { success: true, user: currentUser, message: 'Đã cập nhật hồ sơ cá nhân thành công!' };
  }

  async function updateCustomerProfileAsync(data) {
    if (!currentUser) return { success: false, message: 'Chưa đăng nhập!' };
    if (isHttpOrigin() && backendAvailable !== false) {
      const mutToken = nextMutationToken('user-profile');
      try {
        const res = await apiRequest('PATCH', `/api/users/${encodeURIComponent(currentUser.id)}`, data);
        if (!res.offline && !res.nonJson && !res.networkError) {
          if (res.ok && res.data && res.data.success && res.data.user) {
            currentUser = { ...currentUser, ...res.data.user };
            safeSetStorage(CURRENT_USER_KEY, JSON.stringify(currentUser));
            clearProfileDirtyFlags();
            notifyAuthStateChanged();
            finishMutationToken(mutToken);
            await syncFromServer({ source: 'profile-update' });
            return res.data;
          }
          return res.data || { success: false, message: 'Cập nhật hồ sơ thất bại!' };
        }
      } finally {
        finishMutationToken(mutToken);
      }
    }
    return updateCustomerProfile(data);
  }

  // Activity Logger
  function logActivity(action, details, target = '', options = {}) {
    try {
      let activities = [];
      const stored = localStorage.getItem(ACTIVITIES_KEY);
      if (stored) {
        activities = JSON.parse(stored);
      } else {
        activities = [...(window.CO_TU_DATA?.initialActivities || [])];
      }

      const newAct = {
        id: 'ACT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(10 + Math.random() * 90),
        user: currentUser ? currentUser.fullName : 'Khách vãng lai',
        role: currentUser ? currentUser.role : 'guest',
        action: action,
        target: target || '',
        details: details || '',
        timestamp: new Date().toISOString()
      };

      activities.unshift(newAct);
      // Keep up to 200 activities
      if (activities.length > 200) activities = activities.slice(0, 200);
      localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities));

      if (!options.localOnly && isHttpOrigin() && backendAvailable !== false) {
        apiRequest('POST', '/api/activities', newAct, { keepalive: true }).catch(() => {});
      }

      return newAct;
    } catch (e) {
      console.warn('Could not log activity:', e);
      return null;
    }
  }

  function getActivities() {
    try {
      const stored = localStorage.getItem(ACTIVITIES_KEY);
      return stored ? JSON.parse(stored) : (window.CO_TU_DATA?.initialActivities || []);
    } catch (e) {
      return window.CO_TU_DATA?.initialActivities || [];
    }
  }

  // Pre-Bookings Manager
  function getPreBookings() {
    try {
      const stored = localStorage.getItem(PREBOOKINGS_KEY);
      return stored ? JSON.parse(stored) : (window.CO_TU_DATA?.initialPreBookings || []);
    } catch (e) {
      return window.CO_TU_DATA?.initialPreBookings || [];
    }
  }

  function savePreBookings(list) {
    try {
      localStorage.setItem(PREBOOKINGS_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Could not save prebookings:', e);
    }
  }

  function getCustomerPreBookings() {
    if (!currentUser) return [];
    const all = getPreBookings();
    const phone = normalizePhone(currentUser.phone);
    const email = (currentUser.email || '').toLowerCase();
    const userId = currentUser.id;
    return all.filter(p => {
      if (p.userId && userId && p.userId === userId) return true;
      const pPhone = normalizePhone(p.phone);
      const pEmail = (p.email || '').toLowerCase();
      return (phone && pPhone === phone) || (email && pEmail === email);
    });
  }

  function savePreBooking(data) {
    const list = getPreBookings();
    let preId;
    do {
      preId = 'PRE-' + (Math.floor(100 + Math.random() * 900));
    } while (list.some(p => p.id === preId));
    const phoneClean = normalizePhone(data.phone || (currentUser ? currentUser.phone : ''));
    
    const newPre = {
      id: preId,
      userId: currentUser ? currentUser.id : null,
      customerName: data.customerName || (currentUser ? currentUser.fullName : 'Khách Đặt Trước'),
      phone: phoneClean,
      email: data.email || (currentUser ? currentUser.email : ''),
      targetDate: data.targetDate || '',
      timeSlot: data.timeSlot || '16:30 (Chiều mát)',
      theme: data.theme || 'Hẻm Ẩm Thực Toàn Diện 5 Trạm',
      guests: parseInt(data.guests, 10) || 2,
      estimatedBudget: data.estimatedBudget || `${(parseInt(data.guests, 10) || 2) * 590000}₫`,
      dietaryNotes: data.dietaryNotes || 'Ăn được tất cả',
      specialRequests: data.specialRequests || 'Không có yêu cầu thêm',
      status: 'Chờ tư vấn',
      adminNotes: '',
      createdAt: new Date().toISOString()
    };

    list.unshift(newPre);
    savePreBookings(list);

    const isOnlineSync = isHttpOrigin() && backendAvailable !== false;
    const act = logActivity(
      'Đăng ký đặt tour trước',
      `Khách ${newPre.customerName} gửi yêu cầu ${newPre.theme} cho ${newPre.guests} khách ngày ${newPre.targetDate}`,
      newPre.id,
      { localOnly: isOnlineSync }
    );

    if (isOnlineSync) {
      sendMutation('POST', '/api/prebookings', {
        ...newPre,
        _activityId: act ? act.id : undefined,
        _actorName: currentUser ? currentUser.fullName : newPre.customerName,
        _actorRole: currentUser ? currentUser.role : 'guest'
      }, 'prebook-create');
    }

    return newPre;
  }

  function updatePreBookingStatus(id, newStatus, adminNote = null) {
    if (!isAdmin()) {
      return { success: false, message: 'Chỉ Quản Trị Viên mới có quyền duyệt đơn đặt tour trước!' };
    }

    const list = getPreBookings();
    const item = list.find(p => p.id === id);
    if (!item) return { success: false, message: 'Không tìm thấy yêu cầu đặt tour trước!' };

    item.status = newStatus;
    if (adminNote !== null) {
      item.adminNotes = adminNote;
    }
    savePreBookings(list);

    const isOnlineSync = isHttpOrigin() && backendAvailable !== false;
    const act = logActivity(
      'Duyệt đặt tour trước',
      `Quản Trị Viên cập nhật ${id} sang "${newStatus}"${adminNote ? ' - Ghi chú: ' + adminNote : ''}`,
      id,
      { localOnly: isOnlineSync }
    );

    if (isOnlineSync) {
      sendMutation('PATCH', `/api/prebookings/${encodeURIComponent(id)}`, {
        status: newStatus,
        adminNotes: adminNote,
        _activityId: act ? act.id : undefined,
        _actorName: currentUser ? currentUser.fullName : 'Quản Trị Viên Cô Tư',
        _actorRole: currentUser ? currentUser.role : 'admin'
      }, 'prebook-update');
    }

    return { success: true, preBooking: item };
  }

  function deletePreBooking(id) {
    if (!isAdmin()) {
      return { success: false, message: 'Chỉ Quản Trị Viên mới có quyền xóa yêu cầu đặt tour trước!' };
    }

    const list = getPreBookings();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, message: 'Không tìm thấy yêu cầu đặt tour trước!' };

    const item = list[idx];
    list.splice(idx, 1);
    savePreBookings(list);

    const isOnlineSync = isHttpOrigin() && backendAvailable !== false;
    logActivity(
      'Xóa yêu cầu đặt trước',
      `Quản Trị Viên đã xóa yêu cầu ${id} của khách ${item.customerName}`,
      id,
      { localOnly: isOnlineSync }
    );

    if (isOnlineSync) {
      sendMutation('DELETE', `/api/prebookings/${encodeURIComponent(id)}`, undefined, 'prebook-delete');
    }

    return { success: true, message: `Đã xóa yêu cầu đặt tour trước ${id} thành công!` };
  }

  // Get current customer's direct bookings from localStorage 'co_tu_orders'
  function getCustomerOrders() {
    if (!currentUser) return [];
    try {
      const stored = localStorage.getItem('co_tu_orders');
      const allOrders = stored ? JSON.parse(stored) : (window.CO_TU_DATA?.initialOrders || []);
      const phone = normalizePhone(currentUser.phone);
      const email = (currentUser.email || '').toLowerCase();
      const userId = currentUser.id;
      return allOrders.filter(o => {
        if (o.userId && userId && o.userId === userId) return true;
        const oPhone = normalizePhone(o.phone);
        const oEmail = (o.email || '').toLowerCase();
        return (phone && oPhone === phone) || (email && oEmail === email);
      });
    } catch (e) {
      return [];
    }
  }

  // Setup UI Listeners for Auth
  function setupUIListeners() {
    if (typeof document === 'undefined') return;

    // Open Auth Modal
    document.querySelectorAll('[data-action="open-auth"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const tab = btn.getAttribute('data-tab') || 'login';
        openAuthModal(tab);
      });
    });

    // Close Auth Modal
    const btnCloseAuth = document.getElementById('btn-close-auth-modal');
    const authModal = document.getElementById('auth-modal');
    if (btnCloseAuth && authModal) {
      btnCloseAuth.addEventListener('click', closeAuthModal);
    }
    if (authModal) {
      authModal.addEventListener('click', (e) => {
        if (e.target === authModal) closeAuthModal();
      });
    }

    // Auth Modal Tab Switch (Đăng Nhập vs Đăng Ký)
    const tabBtnLogin = document.getElementById('tab-btn-login');
    const tabBtnRegister = document.getElementById('tab-btn-register');
    if (tabBtnLogin && tabBtnRegister) {
      tabBtnLogin.addEventListener('click', () => switchAuthTab('login'));
      tabBtnRegister.addEventListener('click', () => switchAuthTab('register'));
    }

    // Login Form Submit (Customer Landing Page - Strictly Customer Accounts Only)
    const loginForm = document.getElementById('auth-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const ident = document.getElementById('login-identifier')?.value;
        const pass = document.getElementById('login-password')?.value;
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const res = await loginAsync(ident, pass, { requiredRole: 'customer' });
          if (res.success) {
            loginForm.reset();
            closeAuthModal();
            showToast(res.message, 'success');
            openCustomerPortalModal();
          } else {
            showToast(res.message, 'error');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Register Form Submit
    const regForm = document.getElementById('auth-register-form');
    if (regForm) {
      regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = document.getElementById('reg-name')?.value;
        const phone = document.getElementById('reg-phone')?.value;
        const email = document.getElementById('reg-email')?.value;
        const password = document.getElementById('reg-password')?.value;
        const confirmPw = document.getElementById('reg-confirm-password')?.value;
        const dietary = document.getElementById('reg-dietary')?.value;

        if (password !== confirmPw) {
          showToast('Xác nhận mật khẩu không khớp. Vui lòng kiểm tra lại!', 'error');
          return;
        }

        const submitBtn = regForm.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
        try {
          const res = await registerAsync({ fullName, phone, email, password, dietary });
          if (res.success) {
            regForm.reset();
            closeAuthModal();
            showToast(res.message, 'success');
            openCustomerPortalModal();
          } else {
            showToast(res.message, 'error');
          }
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      });
    }

    // Customer Portal Modal Open & Close
    document.querySelectorAll('[data-action="open-customer-portal"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCustomerPortalModal();
      });
    });

    const btnCloseCustPortal = document.getElementById('btn-close-customer-portal');
    const custPortalModal = document.getElementById('customer-portal-modal');
    if (btnCloseCustPortal && custPortalModal) {
      btnCloseCustPortal.addEventListener('click', closeCustomerPortalModal);
    }
    if (custPortalModal) {
      custPortalModal.addEventListener('click', (e) => {
        if (e.target === custPortalModal) closeCustomerPortalModal();
      });
    }

    // Logout button triggers
    document.querySelectorAll('[data-action="auth-logout"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
        closeCustomerPortalModal();
        if (window.AdminPortal && window.AdminPortal.closeAdminModal) {
          window.AdminPortal.closeAdminModal();
        }
        showToast('Đã đăng xuất tài khoản thành công!', 'info');
      });
    });
  }

  function openAuthModal(defaultTab = 'login') {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    switchAuthTab(defaultTab);
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
  }

  function closeAuthModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('auth-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  function switchAuthTab(tab) {
    if (typeof document === 'undefined') return;
    const btnLogin = document.getElementById('tab-btn-login');
    const btnRegister = document.getElementById('tab-btn-register');
    const formLogin = document.getElementById('auth-login-form');
    const formRegister = document.getElementById('auth-register-form');

    if (tab === 'login') {
      btnLogin?.classList.add('active', 'bg-primary-container', 'text-on-primary-container');
      btnLogin?.classList.remove('text-on-surface-variant');
      btnRegister?.classList.remove('active', 'bg-primary-container', 'text-on-primary-container');
      btnRegister?.classList.add('text-on-surface-variant');
      if (formLogin) formLogin.classList.remove('hidden');
      if (formRegister) formRegister.classList.add('hidden');
    } else {
      btnRegister?.classList.add('active', 'bg-primary-container', 'text-on-primary-container');
      btnRegister?.classList.remove('text-on-surface-variant');
      btnLogin?.classList.remove('active', 'bg-primary-container', 'text-on-primary-container');
      btnLogin?.classList.add('text-on-surface-variant');
      if (formRegister) formRegister.classList.remove('hidden');
      if (formLogin) formLogin.classList.add('hidden');
    }
  }

  function openCustomerPortalModal() {
    if (typeof document === 'undefined') return;
    if (!isCustomer()) {
      openAuthModal('login');
      return;
    }
    const modal = document.getElementById('customer-portal-modal');
    if (!modal) return;
    renderCustomerPortal();
    if (isHttpOrigin() && backendAvailable !== false) {
      syncFromServer({ source: 'open-customer-portal' });
    }
    modal.classList.remove('hidden');
    setTimeout(() => modal.classList.add('active'), 10);
  }

  function closeCustomerPortalModal() {
    if (typeof document === 'undefined') return;
    const modal = document.getElementById('customer-portal-modal');
    if (!modal) return;
    modal.classList.remove('active');
    setTimeout(() => modal.classList.add('hidden'), 250);
  }

  // Synchronize dynamic UI based on auth state (Header, Drawer, Badges)
  function syncUIState() {
    if (typeof document === 'undefined') return;

    const headerAuthContainer = document.getElementById('header-auth-container');
    const drawerAuthContainer = document.getElementById('drawer-auth-container');

    if (!headerAuthContainer) return;

    if (!currentUser) {
      // GUEST STATE
      headerAuthContainer.innerHTML = `
        <button data-action="open-auth" data-tab="login" class="btn-tactile px-3.5 py-1.5 rounded-full bg-surface-container hover:bg-primary-container hover:text-on-primary-container text-xs font-bold text-on-surface transition-all flex items-center gap-1.5 shadow-sm border border-outline-variant/30">
          <span class="material-symbols-outlined text-[18px]">account_circle</span>
          <span class="hidden sm:inline">Đăng Nhập / Đăng Ký</span>
        </button>
      `;

      if (drawerAuthContainer) {
        drawerAuthContainer.innerHTML = `
          <button data-action="open-auth" data-tab="login" class="w-full py-2.5 rounded-full bg-primary-container text-on-primary-container text-xs font-bold flex items-center justify-center gap-2 shadow-sm">
            <span class="material-symbols-outlined text-[18px]">account_circle</span>
            <span>Đăng Nhập / Đăng Ký</span>
          </button>
        `;
      }
    } else if (currentUser.role === 'customer') {
      // CUSTOMER STATE
      const safeName = escapeHTML(currentUser.fullName || 'Khách Hàng');
      const safeInitial = escapeHTML((currentUser.fullName || 'K').charAt(0).toUpperCase());
      headerAuthContainer.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2">
          <button data-action="open-customer-portal" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 text-xs font-semibold text-on-surface transition-all shadow-sm" title="Mở trang cá nhân khách hàng">
            <span class="w-6 h-6 rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center text-[12px] shadow-inner">${safeInitial}</span>
            <span class="max-w-[110px] truncate hidden sm:inline">${safeName}</span>
            <span class="text-[10px] px-1.5 py-0.5 rounded-md bg-secondary-fixed text-on-secondary-fixed-variant font-bold uppercase hidden md:inline">Khách</span>
            <span class="material-symbols-outlined text-[16px] text-on-surface-variant">expand_more</span>
          </button>
          <button data-action="auth-logout" class="px-2.5 py-1.5 rounded-full bg-error-container text-on-error-container text-xs font-bold hover:brightness-105 transition-all flex items-center gap-1 shadow-sm" title="Đăng Xuất">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span class="hidden md:inline">Đăng Xuất</span>
          </button>
        </div>
      `;

      if (drawerAuthContainer) {
        drawerAuthContainer.innerHTML = `
          <div class="p-3 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center text-sm shadow-inner">${safeInitial}</span>
              <div>
                <p class="text-xs font-bold text-on-surface">${safeName}</p>
                <p class="text-[11px] text-on-surface-variant">Tài khoản Khách Hàng</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <button data-action="open-customer-portal" class="py-1.5 rounded-lg bg-surface-container text-xs font-bold text-on-surface flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[16px]">receipt_long</span>
                <span>Đơn Của Tôi</span>
              </button>
              <button data-action="auth-logout" class="py-1.5 rounded-lg bg-error-container text-on-error-container text-xs font-bold flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Đăng Xuất</span>
              </button>
            </div>
          </div>
        `;
      }
    } else if (currentUser.role === 'admin') {
      // ADMIN STATE (When visiting customer landing page)
      const safeAdminName = escapeHTML(currentUser.fullName || 'Quản Trị Viên');
      headerAuthContainer.innerHTML = `
        <div class="flex items-center gap-1.5 sm:gap-2">
          <a href="admin.html" class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary text-surface text-xs font-bold transition-all shadow-md hover:brightness-105" title="Mở Bảng Quản Trị Hệ Thống">
            <span class="material-symbols-outlined text-[18px]">shield_person</span>
            <span class="hidden sm:inline">Vào Bảng Quản Trị</span>
            <span class="px-1.5 py-0.2 rounded-full bg-surface text-on-surface text-[10px] font-bold uppercase hidden md:inline">Admin</span>
          </a>
          <button data-action="auth-logout" class="px-2.5 py-1.5 rounded-full bg-error-container text-on-error-container text-xs font-bold hover:brightness-105 transition-all flex items-center gap-1 shadow-sm" title="Đăng Xuất Admin">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span class="hidden md:inline">Đăng Xuất</span>
          </button>
        </div>
      `;

      if (drawerAuthContainer) {
        drawerAuthContainer.innerHTML = `
          <div class="p-3 bg-primary-container/20 rounded-xl border border-primary/30 space-y-2">
            <div class="flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-2xl">shield_person</span>
              <div>
                <p class="text-xs font-bold text-on-surface">${safeAdminName}</p>
                <p class="text-[11px] font-semibold text-primary">Quản Trị Viên Hệ Thống</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-2 pt-1">
              <a href="admin.html" class="py-1.5 rounded-lg bg-primary text-surface text-xs font-bold flex items-center justify-center gap-1 shadow-sm">
                <span class="material-symbols-outlined text-[16px]">dashboard</span>
                <span>Admin Portal</span>
              </a>
              <button data-action="auth-logout" class="py-1.5 rounded-lg bg-error-container text-on-error-container text-xs font-bold flex items-center justify-center gap-1">
                <span class="material-symbols-outlined text-[16px]">logout</span>
                <span>Đăng Xuất</span>
              </button>
            </div>
          </div>
        `;
      }
    }

    // Re-attach triggers to newly inserted DOM elements in header
    headerAuthContainer.querySelectorAll('[data-action="open-auth"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openAuthModal(btn.getAttribute('data-tab') || 'login');
      });
    });
    headerAuthContainer.querySelectorAll('[data-action="open-customer-portal"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCustomerPortalModal();
      });
    });
    headerAuthContainer.querySelectorAll('[data-action="auth-logout"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        logout();
        showToast('Đã đăng xuất tài khoản thành công!', 'info');
      });
    });

    if (drawerAuthContainer) {
      drawerAuthContainer.querySelectorAll('[data-action="open-auth"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openAuthModal(btn.getAttribute('data-tab') || 'login');
        });
      });
      drawerAuthContainer.querySelectorAll('[data-action="open-customer-portal"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          openCustomerPortalModal();
        });
      });
      drawerAuthContainer.querySelectorAll('[data-action="auth-logout"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          logout();
          showToast('Đã đăng xuất tài khoản thành công!', 'info');
        });
      });
    }

    // Auto-populate booking inputs if Customer is logged in
    autoFillBookingForm();
  }

  function clearAutofilledBookingInputs(forceClearAll = false) {
    if (typeof document === 'undefined') return;
    const contactIds = [
      'book-cust-name', 'book-cust-phone', 'book-cust-email',
      'prebook-cust-name', 'prebook-cust-phone', 'prebook-cust-email'
    ];
    contactIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (forceClearAll || (el.dataset && el.dataset.autofilled === 'true')) {
        el.value = '';
        if (el.dataset) delete el.dataset.autofilled;
      }
    });
    const preDietary = document.getElementById('prebook-dietary');
    if (preDietary && (forceClearAll || (preDietary.dataset && preDietary.dataset.autofilled === 'true'))) {
      preDietary.value = 'Ăn được tất cả';
      if (preDietary.dataset) delete preDietary.dataset.autofilled;
    }
  }

  function autoFillBookingForm() {
    if (typeof document === 'undefined') return;
    if (!currentUser || currentUser.role !== 'customer') {
      clearAutofilledBookingInputs(false);
      return;
    }

    const bindWatcher = (el) => {
      if (!el || !el.dataset || typeof el.addEventListener !== 'function') return;
      if (!el.dataset.autofillWatched) {
        el.dataset.autofillWatched = 'true';
        el.addEventListener('input', () => {
          el.dataset.autofilled = 'false';
        });
      }
    };

    const setField = (el, val) => {
      if (!el) return;
      bindWatcher(el);
      const canOverwrite = !el.value || (el.dataset && el.dataset.autofilled === 'true');
      if (canOverwrite) {
        el.value = val;
        if (el.dataset) el.dataset.autofilled = 'true';
      }
    };

    // 1. Direct booking inputs
    setField(document.getElementById('book-cust-name'), currentUser.fullName || '');
    setField(document.getElementById('book-cust-phone'), currentUser.phone || '');
    setField(document.getElementById('book-cust-email'), currentUser.email || '');

    // 2. Pre-booking inputs
    setField(document.getElementById('prebook-cust-name'), currentUser.fullName || '');
    setField(document.getElementById('prebook-cust-phone'), currentUser.phone || '');
    setField(document.getElementById('prebook-cust-email'), currentUser.email || '');

    const preDietary = document.getElementById('prebook-dietary');
    if (preDietary) {
      bindWatcher(preDietary);
      const canOverwriteDiet = !preDietary.value || preDietary.value === 'Ăn được tất cả' || (preDietary.dataset && preDietary.dataset.autofilled === 'true');
      if (canOverwriteDiet) {
        preDietary.value = currentUser.dietary || 'Ăn được tất cả';
        if (preDietary.dataset) preDietary.dataset.autofilled = 'true';
      }
    }
  }

  function switchCustomerPortalTab(tabName) {
    if (typeof document === 'undefined') return;

    if (tabName === 'prebook-tab' || tabName === 'create-prebook' || tabName === 'new-prebooking') {
      if (window.BookingEngine && window.BookingEngine.switchBookingMode) {
        window.BookingEngine.switchBookingMode('prebook');
      }
      closeCustomerPortalModal();
      const bookSec = document.getElementById('section-book');
      if (bookSec) bookSec.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const tabButtons = document.querySelectorAll('.cust-nav-tab-btn');
    const tabPanels = document.querySelectorAll('.cust-tab-panel');

    tabButtons.forEach(btn => {
      const t = btn.getAttribute('data-tab');
      if (t === tabName) {
        btn.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
        btn.classList.remove('text-on-surface-variant', 'hover:bg-surface-container');
      } else {
        btn.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'shadow-sm');
        btn.classList.add('text-on-surface-variant', 'hover:bg-surface-container');
      }
    });

    tabPanels.forEach(panel => {
      if (panel.id === `cust-panel-${tabName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    renderCustomerPortal();
  }

  function renderCustomerPortal() {
    if (typeof document === 'undefined') return;
    if (!currentUser) return;

    // Header Info
    const avatarEl = document.getElementById('cust-portal-avatar');
    const nameEl = document.getElementById('cust-portal-name');
    const phoneEl = document.getElementById('cust-portal-phone');
    const emailEl = document.getElementById('cust-portal-email');
    const tierEl = document.getElementById('cust-portal-tier');

    if (avatarEl) avatarEl.textContent = currentUser.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'K';
    if (nameEl) nameEl.textContent = currentUser.fullName;
    if (phoneEl) phoneEl.textContent = currentUser.phone || 'Chưa cập nhật SĐT';
    if (emailEl) emailEl.textContent = currentUser.email || 'Chưa cập nhật Email';
    if (tierEl) tierEl.textContent = currentUser.tier || 'Thành Viên Thân Thiết';

    // 1. Render Orders List
    renderCustomerOrdersList();

    // 2. Render Pre-Bookings List
    renderCustomerPreBookingsList();

    // 3. Render Profile Form (without clobbering active/unsaved user edits during SSE sync)
    const profName = document.getElementById('cust-profile-fullname');
    const profPhone = document.getElementById('cust-profile-phone');
    const profEmail = document.getElementById('cust-profile-email');
    const profDietary = document.getElementById('cust-profile-dietary');

    const syncProfileField = (el, val) => {
      if (!el) return;
      if (el.dataset && !el.dataset.dirtyBound && typeof el.addEventListener === 'function') {
        el.dataset.dirtyBound = '1';
        el.addEventListener('input', () => {
          el.dataset.dirty = 'true';
        });
      }
      const isActive = typeof document !== 'undefined' && document.activeElement === el;
      const isDirty = el.dataset && el.dataset.dirty === 'true';
      const userSwitched = el.dataset && el.dataset.boundUserId && el.dataset.boundUserId !== String(currentUser.id || '');
      if (userSwitched || (!isActive && !isDirty)) {
        el.value = val;
        if (el.dataset) {
          delete el.dataset.dirty;
          el.dataset.boundUserId = String(currentUser.id || '');
        }
      }
    };

    syncProfileField(profName, currentUser.fullName || '');
    syncProfileField(profPhone, currentUser.phone || '');
    if (profEmail) profEmail.value = currentUser.email || '';
    syncProfileField(profDietary, currentUser.dietary || '');
  }

  function renderCustomerOrdersList() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('cust-orders-list');
    if (!listEl) return;

    const orders = getCustomerOrders();
    if (orders.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 space-y-3 bg-surface-container-low rounded-xl border border-outline-variant/30 p-6">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant">travel_explore</span>
          <p class="text-sm font-semibold text-on-surface">Bạn chưa có đơn đặt tour nào!</p>
          <p class="text-xs text-on-surface-variant max-w-sm mx-auto">Hãy chọn ngày và trải nghiệm chuyến luồn hẻm 5 trạm đặc sắc cùng Cô Tư tối nay.</p>
          <a href="#section-book" onclick="window.AuthManager.closeCustomerPortalModal()" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container text-on-primary-container text-xs font-bold shadow-sm">
            <span>Đặt Tour Hẻm Ngay</span>
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </a>
        </div>
      `;
      return;
    }

    let html = '';
    orders.forEach(o => {
      let statusColor = 'bg-secondary-fixed text-on-secondary-fixed-variant';
      if (o.status === 'Chờ gặp' || o.status === 'Chờ xác nhận') statusColor = 'bg-primary-container text-on-primary-container';
      if (o.status === 'Đã hoàn thành') statusColor = 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
      if (o.status === 'Đã hủy') statusColor = 'bg-error-container text-on-error-container';

      html += `
        <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2.5">
          <div class="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
            <div>
              <span class="font-mono font-bold text-xs text-secondary">${escapeHTML(o.id)}</span>
              <span class="text-xs text-on-surface-variant ml-2">${escapeHTML(o.date)}</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColor}">${escapeHTML(o.status)}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span class="text-on-surface-variant block text-[11px]">Số lượng khách:</span>
              <span class="font-semibold text-on-surface">${escapeHTML(o.guests)} Khách</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Tổng thanh toán:</span>
              <span class="font-bold text-primary">${escapeHTML(o.total)}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Phương thức:</span>
              <span class="font-semibold text-on-surface">${escapeHTML(o.payment || 'VIETQR')}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Khẩu vị / Dị ứng:</span>
              <span class="text-on-surface truncate block" title="${escapeHTML(o.dietary || 'Bình thường')}">${escapeHTML(o.dietary || 'Bình thường')}</span>
            </div>
          </div>

          <div class="flex items-center justify-between pt-1 text-[11px]">
            <span class="text-on-surface-variant">Điểm hẹn: Hẻm 150 Nguyễn Đình Chiểu, Q.1</span>
            <span class="text-tertiary font-semibold">Hotline: 0908 287 150</span>
          </div>
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function renderCustomerPreBookingsList() {
    if (typeof document === 'undefined') return;
    const listEl = document.getElementById('cust-prebookings-list');
    if (!listEl) return;

    const list = getCustomerPreBookings();
    if (list.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-8 space-y-3 bg-surface-container-low rounded-xl border border-outline-variant/30 p-6">
          <span class="material-symbols-outlined text-4xl text-on-surface-variant">event_upcoming</span>
          <p class="text-sm font-semibold text-on-surface">Chưa có yêu cầu đặt tour trước nào</p>
          <p class="text-xs text-on-surface-variant max-w-sm mx-auto">Bạn có kế hoạch tổ chức tour gia đình, công ty hoặc muốn giữ chỗ ngày lễ tương lai? Hãy gửi yêu cầu đặt tour trước.</p>
          <button type="button" onclick="window.AuthManager.switchCustomerPortalTab('prebook-tab')" class="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary-container text-on-primary-container text-xs font-bold shadow-sm">
            <span>Tạo Yêu Cầu Đặt Tour Trước</span>
            <span class="material-symbols-outlined text-[16px]">add</span>
          </button>
        </div>
      `;
      return;
    }

    let html = '';
    list.forEach(p => {
      let statusColor = 'bg-primary-container text-on-primary-container';
      if (p.status === 'Đã liên hệ' || p.status === 'Đã liên hệ tư vấn') statusColor = 'bg-secondary-fixed text-on-secondary-fixed-variant';
      if (p.status === 'Đã xác nhận cọc') statusColor = 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
      if (p.status === 'Đã hủy') statusColor = 'bg-error-container text-on-error-container';

      html += `
        <div class="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 space-y-2">
          <div class="flex items-center justify-between gap-2 border-b border-outline-variant/20 pb-2">
            <div>
              <span class="font-mono font-bold text-xs text-primary">${escapeHTML(p.id)}</span>
              <span class="font-bold text-xs text-on-surface ml-2">${escapeHTML(p.theme)}</span>
            </div>
            <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${statusColor}">${escapeHTML(p.status)}</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span class="text-on-surface-variant block text-[11px]">Ngày mong muốn:</span>
              <span class="font-semibold text-on-surface">${escapeHTML(p.targetDate)}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Khung giờ:</span>
              <span class="text-on-surface">${escapeHTML(p.timeSlot)}</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Số lượng khách:</span>
              <span class="font-semibold text-on-surface">${escapeHTML(p.guests)} khách</span>
            </div>
            <div>
              <span class="text-on-surface-variant block text-[11px]">Dự toán:</span>
              <span class="font-bold text-tertiary">${escapeHTML(p.estimatedBudget)}</span>
            </div>
          </div>

          ${p.specialRequests ? `<p class="text-xs text-on-surface-variant italic bg-surface-container p-2 rounded-lg">Yêu cầu riêng: ${escapeHTML(p.specialRequests)}</p>` : ''}
          ${p.adminNotes ? `<p class="text-xs text-secondary font-medium bg-secondary-fixed/30 p-2 rounded-lg">Phản hồi từ Cô Tư: ${escapeHTML(p.adminNotes)}</p>` : ''}
        </div>
      `;
    });

    listEl.innerHTML = html;
  }

  function showToast(msg, type = 'info') {
    if (window.AppController?.showToast) {
      window.AppController.showToast(msg, type);
      return;
    }
    if (typeof document === 'undefined') return;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    let iconName = 'info';
    if (type === 'success') iconName = 'check_circle';
    if (type === 'error') iconName = 'error';
    toast.innerHTML = `
      <span class="material-symbols-outlined text-[20px] shrink-0">${iconName}</span>
      <span class="flex-1 leading-snug">${escapeHTML(msg)}</span>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(40px)';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }

  function escapeHTML(str) {
    return String(str).replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  return {
    init,
    login,
    loginAsync,
    register,
    registerAsync,
    logout,
    getCurrentUser,
    getUsers,
    normalizePhone,
    isAuthenticated,
    isAdmin,
    isCustomer,
    updateCustomerProfile,
    updateCustomerProfileAsync,
    logActivity,
    getActivities,
    getPreBookings,
    getCustomerPreBookings,
    savePreBooking,
    updatePreBookingStatus,
    deletePreBooking,
    getCustomerOrders,
    onAuthStateChanged,
    onDataSynced,
    syncFromServer,
    apiRequest,
    sendMutation,
    isHttpOrigin,
    isBackendAvailable: () => backendAvailable === true,
    nextMutationToken,
    finishMutationToken,
    getPendingMutationCount: () => pendingMutations.size,
    openAuthModal,
    closeAuthModal,
    switchAuthTab,
    openCustomerPortalModal,
    closeCustomerPortalModal,
    switchCustomerPortalTab,
    renderCustomerPortal,
    autoFillBookingForm
  };
})();
