/**
 * Admin Portal & Advanced Visual Excel Engine for Cô Tư Tour
 * Role-Based Access Control, Order Management, Pre-bookings, Activity Logs, and Styled Excel Export
 */

window.AdminPortal = (function() {
  let ordersList = [];
  let currentAdminTab = 'orders';
  let storageSyncBound = false;
  let realtimeSyncBound = false;
  const dirtyPreNotes = new Map();

  function updateRealtimeBadge(status, detail = '') {
    if (typeof document === 'undefined') return;
    const badge = document.getElementById('admin-realtime-status');
    if (!badge) return;
    if (status === 'online') {
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-tertiary-fixed/70 border border-tertiary/30 text-[11px] font-bold text-on-tertiary-fixed-variant hover:brightness-95 transition-colors cursor-pointer';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-tertiary animate-pulse"></span><span>Đồng bộ Real-time</span>';
      badge.title = detail || 'Đang kết nối Real-time với Server (nhấn để làm mới)';
    } else if (status === 'reconnecting') {
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary-container/60 border border-primary/30 text-[11px] font-semibold text-on-primary-container hover:brightness-95 transition-colors cursor-pointer';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-primary"></span><span>Đang kết nối lại...</span>';
    } else {
      badge.className = 'hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-container-low border border-outline-variant/40 text-[11px] font-semibold text-on-surface-variant cursor-pointer';
      badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-outline"></span><span>Chế độ Offline (Cùng trình duyệt)</span>';
      badge.title = 'Không phát hiện backend server.js — chỉ đồng bộ trong cùng trình duyệt.';
    }
  }

  function refreshAllAdminViews() {
    loadOrders();
    updateKPIs();
    renderOrdersTable();
    renderPreBookingsTable();
    renderCustomersTable();
    renderActivitiesTable();
    updateExcelPreviewKPIs();
  }

  function init() {
    // Enforce standalone admin auth guard if running in browser
    if (typeof window !== 'undefined' && typeof document !== 'undefined') {
      const isStandaloneAdminPage = !!document.getElementById('admin-sidebar') || !!window.location?.pathname?.includes('admin.html');
      if (isStandaloneAdminPage) {
        if (!window.AuthManager || !window.AuthManager.isAdmin()) {
          window.location?.replace?.('admin-login.html');
          return;
        }
      }
    }

    loadOrders();
    setupEventListeners();
    if (!storageSyncBound && typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      storageSyncBound = true;
      window.addEventListener('storage', (e) => {
        if (e && e.key && !['co_tu_orders', 'co_tu_prebookings', 'co_tu_users', 'co_tu_activities'].includes(e.key)) {
          return;
        }
        if (window.AuthManager && !window.AuthManager.isAdmin()) return;
        refreshAllAdminViews();
      });
    }

    if (!realtimeSyncBound && window.AuthManager && typeof window.AuthManager.onDataSynced === 'function') {
      realtimeSyncBound = true;
      window.AuthManager.onDataSynced((meta = {}) => {
        if (window.AuthManager && !window.AuthManager.isAdmin()) return;
        if (meta.source === 'sse-status') {
          updateRealtimeBadge(meta.connected ? 'online' : 'reconnecting');
          return;
        }
        if (window.AuthManager.isBackendAvailable && window.AuthManager.isBackendAvailable()) {
          updateRealtimeBadge('online');
        }
        if (meta.source === 'init' || meta.source === 'manual-refresh') {
          refreshAllAdminViews();
        } else {
          if (meta.ordersChanged) {
            loadOrders();
            updateKPIs();
            renderOrdersTable();
            updateExcelPreviewKPIs();
          }
          if (meta.prebookingsChanged) {
            updateKPIs();
            renderPreBookingsTable();
            updateExcelPreviewKPIs();
          }
          if (meta.usersChanged) {
            updateKPIs();
            renderCustomersTable();
          }
          if (meta.activitiesChanged) {
            renderActivitiesTable();
            updateExcelPreviewKPIs();
          }
        }
        if (meta.source === 'sse') {
          if (meta.eventType === 'orders:created' && meta.payload?.order) {
            showToast(`Có đơn đặt tour mới: ${meta.payload.order.id} (${meta.payload.order.name})`, 'success');
          } else if (meta.eventType === 'prebookings:created' && meta.payload?.preBooking) {
            showToast(`Có yêu cầu đặt tour trước mới: ${meta.payload.preBooking.id} (${meta.payload.preBooking.customerName})`, 'success');
          }
        }
      });
    }

    if (typeof document !== 'undefined') {
      const badge = document.getElementById('admin-realtime-status');
      if (badge && !badge.dataset.bound) {
        badge.dataset.bound = '1';
        badge.addEventListener('click', () => {
          if (window.AuthManager?.syncFromServer) {
            window.AuthManager.syncFromServer({ source: 'manual-refresh', forceNotify: true }).then((res) => {
              if (res && res.ok) {
                updateRealtimeBadge('online');
                showToast('Đã đồng bộ dữ liệu mới nhất từ máy chủ!', 'success');
              } else {
                updateRealtimeBadge('offline');
              }
            });
          }
        });
      }
    }

    if (window.AuthManager?.isHttpOrigin?.() && window.AuthManager?.apiRequest) {
      window.AuthManager.apiRequest('GET', '/api/network-info').then((res) => {
        if (res && res.ok && res.data) {
          updateRealtimeBadge('online');
          const qrInput = typeof document !== 'undefined' ? document.getElementById('qr-url-input') : null;
          if (res.data.primaryLanUrl && qrInput && (!qrInput.value || qrInput.value.trim() === 'https://cotu-saigon.vn')) {
            qrInput.value = res.data.primaryLanUrl;
          }
          generateQRCanvas();
        } else {
          updateRealtimeBadge('offline');
        }
      });
    } else {
      updateRealtimeBadge('offline');
    }

    updateKPIs();
    renderOrdersTable();
    renderPreBookingsTable();
    renderCustomersTable();
    renderActivitiesTable();
    updateExcelPreviewKPIs();
    generateQRCanvas();
  }

  function loadOrders() {
    try {
      const stored = localStorage.getItem('co_tu_orders');
      if (stored) {
        ordersList = JSON.parse(stored);
      } else {
        ordersList = [...(window.CO_TU_DATA?.initialOrders || [])];
        localStorage.setItem('co_tu_orders', JSON.stringify(ordersList));
      }
    } catch (e) {
      ordersList = [...(window.CO_TU_DATA?.initialOrders || [])];
    }
  }

  function setupEventListeners() {
    // Admin Tabs Switcher
    const adminTabButtons = document.querySelectorAll('.admin-nav-tab-btn');
    adminTabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        switchAdminTab(tab);
      });
    });

    // Orders Search & Filter
    const searchInput = document.getElementById('admin-search-orders');
    const statusFilter = document.getElementById('admin-status-filter');
    if (searchInput) searchInput.addEventListener('input', renderOrdersTable);
    if (statusFilter) statusFilter.addEventListener('change', renderOrdersTable);

    // Pre-bookings Search & Filter
    const searchPreInput = document.getElementById('admin-search-prebookings');
    const statusPreFilter = document.getElementById('admin-status-pre-filter');
    if (searchPreInput) searchPreInput.addEventListener('input', renderPreBookingsTable);
    if (statusPreFilter) statusPreFilter.addEventListener('change', renderPreBookingsTable);

    // Customers Search & Filter
    const searchCustInput = document.getElementById('admin-search-customers');
    const tierCustFilter = document.getElementById('admin-customer-tier-filter');
    if (searchCustInput) searchCustInput.addEventListener('input', renderCustomersTable);
    if (tierCustFilter) tierCustFilter.addEventListener('change', renderCustomersTable);

    // Activity Log Search & Filter
    const searchActInput = document.getElementById('admin-search-activities');
    if (searchActInput) searchActInput.addEventListener('input', renderActivitiesTable);

    // Excel Export Center Actions
    const btnExportComprehensive = document.getElementById('btn-export-excel-comprehensive');
    const btnExportPrebookings = document.getElementById('btn-export-excel-prebookings');
    const btnExportActivities = document.getElementById('btn-export-excel-activities');
    const btnExportCSV = document.getElementById('btn-export-csv');

    if (btnExportComprehensive) btnExportComprehensive.addEventListener('click', exportComprehensiveExcel);
    if (btnExportPrebookings) btnExportPrebookings.addEventListener('click', exportPreBookingsExcel);
    if (btnExportActivities) btnExportActivities.addEventListener('click', exportActivitiesExcel);
    if (btnExportCSV) btnExportCSV.addEventListener('click', exportCSV);

    // Quick export buttons from tables
    const btnQuickExportOrders = document.getElementById('btn-quick-export-orders');
    const btnQuickExportPre = document.getElementById('btn-quick-export-prebookings');
    const btnQuickExportAct = document.getElementById('btn-quick-export-activities');
    if (btnQuickExportOrders) btnQuickExportOrders.addEventListener('click', exportOrdersExcel);
    if (btnQuickExportPre) btnQuickExportPre.addEventListener('click', exportPreBookingsExcel);
    if (btnQuickExportAct) btnQuickExportAct.addEventListener('click', exportActivitiesExcel);

    // Excel Date Filter & Type
    const excelDateFrom = document.getElementById('excel-filter-from');
    const excelDateTo = document.getElementById('excel-filter-to');
    const excelDateType = document.getElementById('excel-date-type-filter');
    if (excelDateFrom) excelDateFrom.addEventListener('change', updateExcelPreviewKPIs);
    if (excelDateTo) excelDateTo.addEventListener('change', updateExcelPreviewKPIs);
    if (excelDateType) excelDateType.addEventListener('change', updateExcelPreviewKPIs);

    // Date Presets in Excel Center
    document.querySelectorAll('[data-action="excel-preset"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const preset = btn.getAttribute('data-preset');
        applyDatePreset(preset);
      });
    });

    // Admin Logout (Standalone Dashboard -> Redirect to admin-login.html)
    document.querySelectorAll('[data-action="admin-logout"], [data-action="admin-modal-logout"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.AuthManager && window.AuthManager.logout) {
          window.AuthManager.logout();
        }
        showToast('Đã đăng xuất an toàn khỏi tài khoản Quản Trị Viên!', 'info');
        setTimeout(() => {
          window.location.replace('admin-login.html');
        }, 300);
      });
    });

    // QR Generator input
    const qrInput = document.getElementById('qr-url-input');
    const btnGenQR = document.getElementById('btn-generate-qr');
    const btnDownloadQR = document.getElementById('btn-download-qr-png');
    if (btnGenQR && qrInput) {
      btnGenQR.addEventListener('click', () => {
        generateQRCanvas();
        showToast('Đã tạo mã QR mới!', 'success');
      });
      qrInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          generateQRCanvas();
        }
      });
    }
    if (btnDownloadQR) {
      btnDownloadQR.addEventListener('click', downloadQRPNG);
    }
  }

  function openAdminModal() {
    if (!window.AuthManager || !window.AuthManager.isAdmin()) {
      window.location.replace('admin-login.html');
      return;
    }
    // In standalone architecture, redirect to admin.html if invoked from elsewhere
    if (!window.location.pathname.includes('admin.html')) {
      window.location.href = 'admin.html';
    }
  }

  function closeAdminModal() {
    // No-op in standalone admin.html architecture
  }

  function switchAdminTab(tabName) {
    currentAdminTab = tabName;
    const tabButtons = document.querySelectorAll('.admin-nav-tab-btn');
    const tabPanels = document.querySelectorAll('.admin-tab-panel');

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
      if (panel.id === `admin-panel-${tabName}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    const titleEl = document.getElementById('admin-topbar-title');
    if (titleEl) {
      const titles = {
        orders: 'Quản Lý Đơn Tour Trực Tiếp',
        prebookings: 'Duyệt Yêu Cầu Đặt Tour Trước',
        customers: 'Danh Sách Tài Khoản Khách Hàng',
        activities: 'Nhật Ký Hoạt Động Hệ Thống',
        excel: 'Trung Tâm Kết Xuất Báo Cáo Excel (.xls & CSV)',
        qr: 'Tạo Mã QR Tiếp Thị Tại Bàn'
      };
      titleEl.textContent = titles[tabName] || 'Trung Tâm Quản Trị Tour Cô Tư';
    }

    if (tabName === 'orders') renderOrdersTable();
    if (tabName === 'prebookings') renderPreBookingsTable();
    if (tabName === 'customers') renderCustomersTable();
    if (tabName === 'activities') renderActivitiesTable();
    if (tabName === 'excel') updateExcelPreviewKPIs();
    if (tabName === 'qr') generateQRCanvas();
  }

  function updateKPIs() {
    let totalGuests = 0;
    let totalRevenue = 0;
    let activeOrdersCount = 0;

    ordersList.forEach(ord => {
      // Exclude cancelled orders from KPI calculations!
      if (ord.status === "Đã hủy") return;

      activeOrdersCount++;
      const g = parseInt(ord.guests, 10) || 1;
      totalGuests += g;
      
      const cleanTotal = String(ord.total).replace(/[^\d]/g, '');
      const num = parseInt(cleanTotal, 10);
      if (!isNaN(num) && num > 0) {
        totalRevenue += num;
      } else {
        totalRevenue += g * 590000;
      }
    });

    const prebookings = window.AuthManager ? window.AuthManager.getPreBookings() : [];
    const pendingPreCount = prebookings.filter(p => p.status === 'Chờ tư vấn' || p.status === 'Đã liên hệ').length;
    const customers = window.AuthManager ? window.AuthManager.getUsers().filter(u => u.role === 'customer') : [];

    const ordersCountEl = document.getElementById('admin-kpi-orders');
    const guestsCountEl = document.getElementById('admin-kpi-guests');
    const revenueEl = document.getElementById('admin-kpi-revenue');
    const preBadgeEl = document.getElementById('admin-prebooking-badge');
    const preKpiEl = document.getElementById('admin-kpi-prebookings');
    const custBadgeEl = document.getElementById('admin-customer-badge');

    if (ordersCountEl) ordersCountEl.textContent = `${activeOrdersCount} / ${ordersList.length}`;
    if (guestsCountEl) guestsCountEl.textContent = totalGuests;
    if (revenueEl) revenueEl.textContent = `${totalRevenue.toLocaleString('vi-VN')}₫`;
    if (preBadgeEl) {
      preBadgeEl.textContent = prebookings.length;
      preBadgeEl.style.display = prebookings.length > 0 ? 'inline-flex' : 'none';
    }
    if (preKpiEl) preKpiEl.textContent = `${pendingPreCount} chờ duyệt / ${prebookings.length}`;
    if (custBadgeEl) {
      custBadgeEl.textContent = customers.length;
    }
  }

  // 1. RENDER DIRECT ORDERS TABLE
  function renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const searchTerm = (document.getElementById('admin-search-orders')?.value || '').toLowerCase().trim();
    const filterStatus = document.getElementById('admin-status-filter')?.value || 'all';

    const filtered = ordersList.filter(ord => {
      const matchSearch = ord.id.toLowerCase().includes(searchTerm) ||
                          ord.name.toLowerCase().includes(searchTerm) ||
                          ord.phone.includes(searchTerm) ||
                          (ord.email && ord.email.toLowerCase().includes(searchTerm));
      const matchStatus = filterStatus === 'all' || ord.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-on-surface-variant font-medium">
            Không tìm thấy đơn đặt tour nào phù hợp bộ lọc.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach((ord) => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-outline-variant/30 hover:bg-surface-container transition-colors text-xs sm:text-sm";
      
      let statusColor = "bg-primary-fixed text-on-primary-fixed";
      if (ord.status === "Chờ xác nhận") statusColor = "bg-primary-container text-on-primary-container";
      if (ord.status === "Đã xác nhận") statusColor = "bg-tertiary-fixed text-on-tertiary-fixed-variant";
      if (ord.status === "Chờ gặp") statusColor = "bg-secondary-fixed text-on-secondary-fixed-variant";
      if (ord.status === "Đã hoàn thành") statusColor = "bg-surface-container-highest text-on-surface";
      if (ord.status === "Đã hủy") statusColor = "bg-error-container text-on-error-container opacity-75";

      tr.innerHTML = `
        <td class="p-3.5 font-bold text-secondary font-mono">${ord.id}</td>
        <td class="p-3.5">
          <p class="font-semibold text-on-surface leading-tight">${escapeHTML(ord.name)}</p>
          <p class="text-[11px] text-on-surface-variant">${escapeHTML(ord.email || 'Không có email')}</p>
        </td>
        <td class="p-3.5 text-on-surface font-mono text-xs">${escapeHTML(ord.phone)}</td>
        <td class="p-3.5 whitespace-nowrap text-xs">${escapeHTML(ord.date)}</td>
        <td class="p-3.5 text-center font-bold">${ord.guests}</td>
        <td class="p-3.5 font-bold text-primary whitespace-nowrap">${ord.total}</td>
        <td class="p-3.5">
          <select class="status-select px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor} border-0 cursor-pointer outline-none" data-order-id="${ord.id}">
            ${ord.status === 'Chờ xác nhận' ? '<option value="Chờ xác nhận" selected>Chờ xác nhận</option>' : ''}
            <option value="Đã xác nhận" ${ord.status === 'Đã xác nhận' ? 'selected' : ''}>Đã xác nhận</option>
            <option value="Chờ gặp" ${ord.status === 'Chờ gặp' ? 'selected' : ''}>Chờ gặp</option>
            <option value="Đã hoàn thành" ${ord.status === 'Đã hoàn thành' ? 'selected' : ''}>Đã hoàn thành</option>
            <option value="Đã hủy" ${ord.status === 'Đã hủy' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </td>
        <td class="p-3.5 text-right whitespace-nowrap">
          <button class="btn-delete-order text-secondary hover:text-error p-1 rounded transition-colors" data-order-id="${ord.id}" title="Xóa đơn">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const orderId = e.target.getAttribute('data-order-id');
        const newStatus = e.target.value;
        updateOrderStatus(orderId, newStatus);
      });
    });

    tbody.querySelectorAll('.btn-delete-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderId = btn.getAttribute('data-order-id');
        if (confirm(`Bạn có chắc muốn xóa đơn tour ${orderId}?`)) {
          deleteOrder(orderId);
        }
      });
    });
  }

  function updateOrderStatus(id, newStatus) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      showToast('Chỉ Quản Trị Viên mới có quyền cập nhật trạng thái đơn tour!', 'error');
      return false;
    }
    loadOrders();
    const ord = ordersList.find(o => o.id === id);
    if (ord) {
      ord.status = newStatus;
      localStorage.setItem('co_tu_orders', JSON.stringify(ordersList));
      renderOrdersTable();
      updateKPIs();
      updateExcelPreviewKPIs();

      const auth = window.AuthManager;
      const isOnlineSync = !!(auth && auth.isHttpOrigin && auth.isHttpOrigin() && auth.apiRequest);
      let act = null;
      if (auth) {
        act = auth.logActivity(
          'Cập nhật trạng thái đơn tour',
          `Quản Trị Viên đổi trạng thái đơn ${id} thành "${newStatus}"`,
          id,
          { localOnly: isOnlineSync }
        );
      }

      if (isOnlineSync && auth.sendMutation) {
        const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
        auth.sendMutation('PATCH', `/api/orders/${encodeURIComponent(id)}`, {
          status: newStatus,
          _activityId: act ? act.id : undefined,
          _actorName: currentUser ? currentUser.fullName : 'Quản Trị Viên Cô Tư',
          _actorRole: currentUser ? currentUser.role : 'admin'
        }, 'order-update');
      } else if (isOnlineSync && auth.nextMutationToken) {
        const mutToken = auth.nextMutationToken('order-update');
        const currentUser = auth.getCurrentUser ? auth.getCurrentUser() : null;
        auth.apiRequest('PATCH', `/api/orders/${encodeURIComponent(id)}`, {
          status: newStatus,
          _activityId: act ? act.id : undefined,
          _actorName: currentUser ? currentUser.fullName : 'Quản Trị Viên Cô Tư',
          _actorRole: currentUser ? currentUser.role : 'admin'
        }, { keepalive: true }).finally(() => {
          if (auth.finishMutationToken) auth.finishMutationToken(mutToken);
          if (auth.getPendingMutationCount && auth.getPendingMutationCount() === 0 && auth.isBackendAvailable && auth.isBackendAvailable()) {
            auth.syncFromServer({ source: 'order-updated' });
          }
        });
      }

      showToast(`Đã cập nhật trạng thái đơn ${id} thành "${newStatus}"`, 'success');
      return true;
    }
    return false;
  }

  function deleteOrder(id) {
    if (window.AuthManager && !window.AuthManager.isAdmin()) {
      showToast('Chỉ Quản Trị Viên mới có quyền xóa đơn tour!', 'error');
      return false;
    }
    loadOrders();
    const prevLen = ordersList.length;
    ordersList = ordersList.filter(o => o.id !== id);
    if (ordersList.length === prevLen) return false;
    localStorage.setItem('co_tu_orders', JSON.stringify(ordersList));
    renderOrdersTable();
    updateKPIs();
    updateExcelPreviewKPIs();

    const auth = window.AuthManager;
    const isOnlineSync = !!(auth && auth.isHttpOrigin && auth.isHttpOrigin() && auth.apiRequest);
    if (auth) {
      auth.logActivity(
        'Xóa đơn tour',
        `Quản Trị Viên đã xóa đơn tour ${id}`,
        id,
        { localOnly: isOnlineSync }
      );
    }

    if (isOnlineSync && auth.sendMutation) {
      auth.sendMutation('DELETE', `/api/orders/${encodeURIComponent(id)}`, undefined, 'order-delete');
    } else if (isOnlineSync && auth.nextMutationToken) {
      const mutToken = auth.nextMutationToken('order-delete');
      auth.apiRequest('DELETE', `/api/orders/${encodeURIComponent(id)}`, undefined, { keepalive: true }).finally(() => {
        if (auth.finishMutationToken) auth.finishMutationToken(mutToken);
        if (auth.getPendingMutationCount && auth.getPendingMutationCount() === 0 && auth.isBackendAvailable && auth.isBackendAvailable()) {
          auth.syncFromServer({ source: 'order-deleted' });
        }
      });
    }

    showToast(`Đã xóa đơn tour ${id}`, 'info');
    return true;
  }

  // 2. RENDER PRE-BOOKINGS TABLE (Khách Đặt Tour Trước)
  function renderPreBookingsTable() {
    const tbody = document.getElementById('admin-prebookings-table-body');
    if (!tbody) return;

    let activePreId = null;
    let activeSelStart = null;
    let activeSelEnd = null;
    if (typeof document !== 'undefined' && document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('admin-pre-note')) {
      activePreId = document.activeElement.getAttribute('data-pre-id');
      try {
        activeSelStart = document.activeElement.selectionStart;
        activeSelEnd = document.activeElement.selectionEnd;
      } catch (_) {}
      if (activePreId) {
        dirtyPreNotes.set(activePreId, document.activeElement.value);
      }
    }

    tbody.innerHTML = '';

    const prebookings = window.AuthManager ? window.AuthManager.getPreBookings() : [];
    const searchTerm = (document.getElementById('admin-search-prebookings')?.value || '').toLowerCase().trim();
    const filterStatus = document.getElementById('admin-status-pre-filter')?.value || 'all';

    const filtered = prebookings.filter(p => {
      const matchSearch = p.id.toLowerCase().includes(searchTerm) ||
                          p.customerName.toLowerCase().includes(searchTerm) ||
                          p.phone.includes(searchTerm) ||
                          p.theme.toLowerCase().includes(searchTerm);
      const matchStatus = filterStatus === 'all' || p.status === filterStatus;
      return matchSearch && matchStatus;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="p-8 text-center text-on-surface-variant font-medium">
            Chưa có yêu cầu đặt tour trước nào phù hợp.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-outline-variant/30 hover:bg-surface-container transition-colors text-xs sm:text-sm";

      let statusColor = "bg-primary-container text-on-primary-container";
      if (p.status === "Đã xác nhận cọc") statusColor = "bg-tertiary-fixed text-on-tertiary-fixed-variant";
      if (p.status === "Đã liên hệ") statusColor = "bg-secondary-fixed text-on-secondary-fixed-variant";
      if (p.status === "Đã hủy") statusColor = "bg-error-container text-on-error-container";

      const noteDisplayVal = dirtyPreNotes.has(p.id) ? dirtyPreNotes.get(p.id) : (p.adminNotes || '');

      tr.innerHTML = `
        <td class="p-3.5 font-bold text-primary font-mono">${p.id}</td>
        <td class="p-3.5">
          <p class="font-semibold text-on-surface">${escapeHTML(p.customerName)}</p>
          <p class="text-[11px] text-on-surface-variant font-mono">${escapeHTML(p.phone)}</p>
          <p class="text-[11px] text-on-surface-variant">${escapeHTML(p.email || '')}</p>
        </td>
        <td class="p-3.5">
          <p class="font-medium text-on-surface">${escapeHTML(p.theme)}</p>
          <p class="text-[11px] text-on-surface-variant font-semibold">Khởi hành: ${escapeHTML(p.targetDate)} - ${escapeHTML(p.timeSlot)}</p>
        </td>
        <td class="p-3.5 text-center font-bold text-on-surface">${p.guests} khách</td>
        <td class="p-3.5 font-bold text-tertiary whitespace-nowrap">${p.estimatedBudget}</td>
        <td class="p-3.5 max-w-[200px]">
          <p class="text-xs text-on-surface truncate" title="${escapeHTML(p.dietaryNotes)}"><strong>Khẩu vị:</strong> ${escapeHTML(p.dietaryNotes)}</p>
          ${p.specialRequests ? `<p class="text-[11px] text-on-surface-variant italic truncate" title="${escapeHTML(p.specialRequests)}"><strong>Yêu cầu:</strong> ${escapeHTML(p.specialRequests)}</p>` : ''}
          <div class="mt-1">
            <input type="text" class="admin-pre-note w-full px-2 py-1 rounded bg-surface-container text-[11px] text-on-surface border border-outline-variant/30" placeholder="Ghi chú nội bộ..." value="${escapeHTML(noteDisplayVal)}" data-pre-id="${p.id}"/>
          </div>
        </td>
        <td class="p-3.5 whitespace-nowrap">
          <select class="status-pre-select px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor} border-0 cursor-pointer outline-none" data-pre-id="${p.id}">
            <option value="Chờ tư vấn" ${p.status === 'Chờ tư vấn' ? 'selected' : ''}>Chờ tư vấn</option>
            <option value="Đã liên hệ" ${p.status === 'Đã liên hệ' ? 'selected' : ''}>Đã liên hệ</option>
            <option value="Đã xác nhận cọc" ${p.status === 'Đã xác nhận cọc' ? 'selected' : ''}>Đã xác nhận cọc</option>
            <option value="Đã hủy" ${p.status === 'Đã hủy' ? 'selected' : ''}>Đã hủy</option>
          </select>
        </td>
        <td class="p-3.5 text-right whitespace-nowrap space-x-1">
          <button class="btn-save-pre-note px-2.5 py-1 rounded-full bg-primary-container text-on-primary-container text-xs font-bold hover:brightness-105 transition-all shadow-sm" data-pre-id="${p.id}" title="Lưu ghi chú & trạng thái">
            Lưu
          </button>
          <button class="btn-delete-pre text-secondary hover:text-error p-1 rounded transition-colors inline-flex items-center" data-pre-id="${p.id}" title="Xóa yêu cầu">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Attach listeners
    if (typeof tbody.querySelectorAll === 'function') {
      tbody.querySelectorAll('.admin-pre-note').forEach(inp => {
        inp.addEventListener('input', () => {
          const id = inp.getAttribute('data-pre-id');
          if (id) dirtyPreNotes.set(id, inp.value);
        });
      });

      tbody.querySelectorAll('.status-pre-select').forEach(sel => {
        sel.addEventListener('change', (e) => {
          const id = e.target.getAttribute('data-pre-id');
          const newStatus = e.target.value;
          const noteInput = tbody.querySelector(`.admin-pre-note[data-pre-id="${id}"]`);
          const note = noteInput ? noteInput.value : '';
          dirtyPreNotes.delete(id);
          if (window.AuthManager) {
            const res = window.AuthManager.updatePreBookingStatus(id, newStatus, note);
            if (res && res.success) {
              updateKPIs();
              updateExcelPreviewKPIs();
              showToast(`Đã cập nhật trạng thái yêu cầu ${id} thành "${newStatus}"`, 'success');
            } else {
              showToast(res?.message || 'Không có quyền cập nhật trạng thái!', 'error');
            }
            renderPreBookingsTable();
          }
        });
      });

      tbody.querySelectorAll('.btn-save-pre-note').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-pre-id');
          const noteInput = tbody.querySelector(`.admin-pre-note[data-pre-id="${id}"]`);
          const sel = tbody.querySelector(`.status-pre-select[data-pre-id="${id}"]`);
          const note = noteInput ? noteInput.value : '';
          const status = sel ? sel.value : 'Chờ tư vấn';
          dirtyPreNotes.delete(id);
          if (window.AuthManager) {
            const res = window.AuthManager.updatePreBookingStatus(id, status, note);
            if (res && res.success) {
              renderPreBookingsTable();
              updateKPIs();
              updateExcelPreviewKPIs();
              showToast(`Đã lưu ghi chú cho yêu cầu ${id}`, 'success');
            } else {
              showToast(res?.message || 'Không có quyền lưu ghi chú!', 'error');
            }
          }
        });
      });

      tbody.querySelectorAll('.btn-delete-pre').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.getAttribute('data-pre-id');
          if (confirm(`Bạn có chắc muốn xóa yêu cầu đặt tour trước ${id}?`)) {
            dirtyPreNotes.delete(id);
            if (window.AuthManager && window.AuthManager.deletePreBooking) {
              const res = window.AuthManager.deletePreBooking(id);
              if (res.success) {
                renderPreBookingsTable();
                updateKPIs();
                updateExcelPreviewKPIs();
                showToast(res.message || `Đã xóa yêu cầu đặt trước ${id}`, 'info');
              } else {
                showToast(res.message, 'error');
              }
            }
          }
        });
      });

      if (activePreId && typeof tbody.querySelector === 'function') {
        const restoredInput = tbody.querySelector(`.admin-pre-note[data-pre-id="${activePreId}"]`);
        if (restoredInput && typeof restoredInput.focus === 'function') {
          restoredInput.focus();
          if (activeSelStart !== null && typeof restoredInput.setSelectionRange === 'function') {
            try { restoredInput.setSelectionRange(activeSelStart, activeSelEnd); } catch (_) {}
          }
        }
      }
    }
  }

  // 3. RENDER CUSTOMER ACTIVITY LOGS TABLE
  function renderActivitiesTable() {
    const tbody = document.getElementById('admin-activities-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const activities = window.AuthManager ? window.AuthManager.getActivities() : [];
    const search = (document.getElementById('admin-search-activities')?.value || '').toLowerCase().trim();

    const filtered = activities.filter(a => {
      return a.id.toLowerCase().includes(search) ||
             a.user.toLowerCase().includes(search) ||
             a.action.toLowerCase().includes(search) ||
             a.details.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-on-surface-variant font-medium">
            Chưa có ghi nhận hoạt động nào phù hợp.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(act => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-outline-variant/30 hover:bg-surface-container transition-colors text-xs";

      const timeStr = new Date(act.timestamp).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'
      });

      let roleBadge = 'bg-surface-container-high text-on-surface';
      if (act.role === 'admin') roleBadge = 'bg-primary-container text-on-primary-container font-bold';
      if (act.role === 'customer') roleBadge = 'bg-secondary-fixed text-on-secondary-fixed-variant font-semibold';

      let actionBadge = 'bg-surface-container text-on-surface';
      if (act.action.includes('đặt tour') || act.action.includes('Đặt tour')) actionBadge = 'bg-tertiary-fixed text-on-tertiary-fixed-variant font-bold';
      if (act.action.includes('Hủy') || act.action.includes('hủy')) actionBadge = 'bg-error-container text-on-error-container';

      tr.innerHTML = `
        <td class="p-3 font-mono text-on-surface-variant whitespace-nowrap">${timeStr}</td>
        <td class="p-3 font-bold text-on-surface">${escapeHTML(act.user)}</td>
        <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] ${roleBadge}">${act.role.toUpperCase()}</span></td>
        <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[11px] ${actionBadge}">${escapeHTML(act.action)}</span></td>
        <td class="p-3 font-mono font-semibold text-secondary">${escapeHTML(act.target || '-')}</td>
        <td class="p-3 text-on-surface">${escapeHTML(act.details)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 3B. RENDER REGISTERED CUSTOMER ACCOUNTS TABLE
  function matchesCustomerTier(tierStr, tierFilter) {
    if (!tierFilter || tierFilter === 'all') return true;
    const normTier = String(tierStr || '').toLowerCase();
    const normFilter = String(tierFilter).toLowerCase();
    if (normFilter === 'vàng' || normFilter === 'gold') {
      return normTier.includes('vàng') || normTier.includes('gold');
    }
    if (normFilter === 'bạc' || normFilter === 'silver') {
      return normTier.includes('bạc') || normTier.includes('silver');
    }
    if (normFilter === 'kim cương' || normFilter === 'diamond') {
      return normTier.includes('kim cương') || normTier.includes('diamond');
    }
    if (normFilter === 'mới' || normFilter === 'new') {
      return normTier.includes('mới') || normTier.includes('new');
    }
    return normTier.includes(normFilter);
  }

  function renderCustomersTable() {
    const tbody = document.getElementById('admin-customers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const allUsers = window.AuthManager ? window.AuthManager.getUsers() : [];
    const customers = allUsers.filter(u => u.role === 'customer');
    const search = (document.getElementById('admin-search-customers')?.value || '').toLowerCase().trim();
    const tierFilter = document.getElementById('admin-customer-tier-filter')?.value || 'all';

    const filtered = customers.filter(c => {
      const matchSearch = !search ||
        (c.fullName && c.fullName.toLowerCase().includes(search)) ||
        (c.phone && c.phone.includes(search)) ||
        (c.email && c.email.toLowerCase().includes(search)) ||
        (c.dietary && c.dietary.toLowerCase().includes(search));
      const matchTier = matchesCustomerTier(c.tier, tierFilter);
      return matchSearch && matchTier;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="p-8 text-center text-on-surface-variant font-medium">
            Chưa tìm thấy tài khoản khách hàng nào phù hợp.
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "border-b border-outline-variant/30 hover:bg-surface-container transition-colors text-xs sm:text-sm";
      const createdDate = c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : '01/11/2026';

      tr.innerHTML = `
        <td class="p-3.5">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-full bg-primary-container text-on-primary-container font-bold flex items-center justify-center text-xs shrink-0">${escapeHTML((c.fullName || 'K').charAt(0).toUpperCase())}</span>
            <div>
              <p class="font-bold text-on-surface">${escapeHTML(c.fullName)}</p>
              <p class="text-[11px] text-on-surface-variant font-mono">${escapeHTML(c.id || '')}</p>
            </div>
          </div>
        </td>
        <td class="p-3.5 font-mono text-xs text-on-surface">${escapeHTML(c.phone || '-')}</td>
        <td class="p-3.5 text-xs text-on-surface-variant">${escapeHTML(c.email || '-')}</td>
        <td class="p-3.5 text-xs text-on-surface max-w-[200px] truncate" title="${escapeHTML(c.dietary || 'Ăn được tất cả')}">${escapeHTML(c.dietary || 'Ăn được tất cả')}</td>
        <td class="p-3.5"><span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-primary-container/30 text-on-primary-container">${escapeHTML(c.tier || 'Hội Viên Mới')}</span></td>
        <td class="p-3.5 text-xs text-on-surface-variant font-mono">${createdDate}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 4. PARSER & DATE RANGE FILTERING ENGINE
  function parseFlexibleDate(dateStr) {
    if (!dateStr) return null;
    const str = String(dateStr).trim();
    if (!str) return null;

    const lower = str.toLowerCase();
    const now = new Date();
    if (lower.includes('hôm nay')) {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 30);
    }
    if (lower.includes('ngày mai')) {
      const tmr = new Date(now);
      tmr.setDate(tmr.getDate() + 1);
      return new Date(tmr.getFullYear(), tmr.getMonth(), tmr.getDate(), 16, 30);
    }

    const bareIsoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (bareIsoMatch) {
      const year = parseInt(bareIsoMatch[1], 10);
      const month = parseInt(bareIsoMatch[2], 10) - 1;
      const day = parseInt(bareIsoMatch[3], 10);
      const d = new Date(year, month, day, 12, 0);
      if (!isNaN(d.getTime())) return d;
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d;
    }

    const dmMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(?:lúc\s+)?(\d{1,2}):(\d{1,2}))?/i);
    if (dmMatch) {
      const day = parseInt(dmMatch[1], 10);
      const month = parseInt(dmMatch[2], 10) - 1;
      const year = parseInt(dmMatch[3], 10);
      const hours = dmMatch[4] ? parseInt(dmMatch[4], 10) : 12;
      const minutes = dmMatch[5] ? parseInt(dmMatch[5], 10) : 0;
      const d = new Date(year, month, day, hours, minutes);
      if (!isNaN(d.getTime())) return d;
    }

    const fallback = new Date(str);
    return isNaN(fallback.getTime()) ? null : fallback;
  }

  function getDateRangeFilter() {
    const fromVal = document.getElementById('excel-filter-from')?.value;
    const toVal = document.getElementById('excel-filter-to')?.value;
    const filterField = document.getElementById('excel-date-type-filter')?.value || 'created';

    const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
    const toDate = toVal ? new Date(toVal + 'T23:59:59') : null;

    const matchesDate = (itemDateStr) => {
      if (!fromDate && !toDate) return true;
      if (!itemDateStr) return false;
      const d = parseFlexibleDate(itemDateStr);
      if (!d) return false;
      if (fromDate && d < fromDate) return false;
      if (toDate && d > toDate) return false;
      return true;
    };

    return {
      fromDate,
      toDate,
      fromVal,
      toVal,
      filterField,
      hasFilter: !!(fromDate || toDate),
      matchesDate,
      filterOrders: (orders) => {
        if (!fromDate && !toDate) return orders;
        return orders.filter(o => {
          const targetStr = (filterField === 'tour' && (o.tourDate || o.date)) ? (o.tourDate || o.date) : (o.createdAt || o.date);
          return matchesDate(targetStr);
        });
      },
      filterPreBookings: (prebookings) => {
        if (!fromDate && !toDate) return prebookings;
        return prebookings.filter(p => {
          const targetStr = (filterField === 'tour' && p.targetDate) ? p.targetDate : (p.createdAt || p.targetDate);
          return matchesDate(targetStr);
        });
      },
      filterActivities: (activities) => {
        if (!fromDate && !toDate) return activities;
        return activities.filter(a => matchesDate(a.timestamp));
      }
    };
  }

  function applyDatePreset(preset) {
    const fromInput = document.getElementById('excel-filter-from');
    const toInput = document.getElementById('excel-filter-to');
    if (!fromInput || !toInput) return;

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      fromInput.value = '';
      toInput.value = '';
    } else if (preset === 'today') {
      const todayStr = formatDate(now);
      fromInput.value = todayStr;
      toInput.value = todayStr;
    } else if (preset === 'week' || preset === 'last7') {
      const past = new Date(now);
      past.setDate(past.getDate() - 7);
      fromInput.value = formatDate(past);
      toInput.value = formatDate(now);
    } else if (preset === 'month' || preset === 'this-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      fromInput.value = formatDate(firstDay);
      toInput.value = formatDate(lastDay);
    } else if (preset === 'nextmonth' || preset === 'next-month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      fromInput.value = formatDate(firstDay);
      toInput.value = formatDate(lastDay);
    }

    document.querySelectorAll('[data-action="excel-preset"]').forEach(btn => {
      const p = btn.getAttribute('data-preset');
      const isMatch = p === preset ||
        (preset === 'last7' && p === 'week') ||
        (preset === 'this-month' && p === 'month') ||
        (preset === 'next-month' && p === 'nextmonth');
      if (isMatch) {
        btn.classList.add('bg-primary-container', 'text-on-primary-container');
        btn.classList.remove('bg-surface-container', 'text-on-surface');
      } else {
        btn.classList.remove('bg-primary-container', 'text-on-primary-container');
        btn.classList.add('bg-surface-container', 'text-on-surface');
      }
    });

    updateExcelPreviewKPIs();
  }

  function updateExcelPreviewKPIs() {
    const filter = getDateRangeFilter();
    const orders = filter.filterOrders(ordersList);
    const prebookings = filter.filterPreBookings(window.AuthManager ? window.AuthManager.getPreBookings() : []);
    const activities = filter.filterActivities(window.AuthManager ? window.AuthManager.getActivities() : []);

    const cntOrders = document.getElementById('excel-count-orders');
    const cntPre = document.getElementById('excel-count-prebookings');
    const cntAct = document.getElementById('excel-count-activities');
    const descEl = document.getElementById('excel-filter-active-desc');

    if (cntOrders) cntOrders.textContent = `${orders.length} Đơn`;
    if (cntPre) cntPre.textContent = `${prebookings.length} Yêu Cầu`;
    if (cntAct) cntAct.textContent = `${activities.length} Hành Động`;

    if (descEl) {
      if (filter.hasFilter) {
        const fromStr = filter.fromVal || 'Bắt đầu';
        const toStr = filter.toVal || 'Hiện tại';
        const typeStr = filter.filterField === 'tour' ? 'ngày khởi hành tour' : 'ngày tạo đơn';
        descEl.textContent = `Bộ lọc (${typeStr}): ${fromStr} -> ${toStr} | Đơn tour: ${orders.length} | Đặt trước: ${prebookings.length}`;
        descEl.classList?.remove('hidden');
      } else {
        descEl.textContent = 'Toàn bộ thời gian (Không giới hạn kỳ báo cáo)';
        descEl.classList?.remove('hidden');
      }
    }
  }

  // =========================================================================
  // ADVANCED VISUAL EXCEL GENERATOR (SpreadsheetML / XML Format .xls)
  // =========================================================================

  function escapeXml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generates a fully formatted, multi-worksheet XML Spreadsheet
   * with custom branding, styled headers, colors, auto-fit widths, and formulas
   */
  function buildStyledSpreadsheetXML(sheets, customSubtitle = null) {
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const nowIso = new Date().toISOString();

    let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Author>Cô Tư Saigon Alley Food Tour Management</Author>
  <Created>${nowIso}</Created>
  <Company>Cô Tư Saigon Street Food Alley Odyssey</Company>
  <Version>16.00</Version>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="10" ss:Color="#1F1B15"/>
   <Interior/>
   <NumberFormat/>
   <Protection/>
  </Style>
  <!-- Main Banner Header -->
  <Style ss:ID="TitleBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Bricolage Grotesque" ss:Size="15" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#835500" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="SubBanner">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="10" ss:Italic="1" ss:Color="#FFDDB4"/>
   <Interior ss:Color="#835500" ss:Pattern="Solid"/>
  </Style>
  <!-- Table Column Header -->
  <Style ss:ID="ColHeader">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="10" ss:Bold="1" ss:Color="#291800"/>
   <Interior ss:Color="#F5A623" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#835500"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7C3AE"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7C3AE"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D7C3AE"/>
   </Borders>
  </Style>
  <!-- Data Rows (Zebra) -->
  <Style ss:ID="RowEven">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9.5" ss:Color="#1F1B15"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
   </Borders>
  </Style>
  <Style ss:ID="RowOdd">
   <Alignment ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9.5" ss:Color="#1F1B15"/>
   <Interior ss:Color="#FCF8F2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
   </Borders>
  </Style>
  <Style ss:ID="NumberCell">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9.5" ss:Bold="1" ss:Color="#1F1B15"/>
   <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
   </Borders>
  </Style>
  <!-- Status Badges -->
  <Style ss:ID="StatusGreen">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9" ss:Bold="1" ss:Color="#005237"/>
   <Interior ss:Color="#D4EDDA" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C3E6CB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C3E6CB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#C3E6CB"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusYellow">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9" ss:Bold="1" ss:Color="#633F00"/>
   <Interior ss:Color="#FFF3CD" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFEEBA"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFEEBA"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FFEEBA"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusBlue">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9" ss:Bold="1" ss:Color="#004085"/>
   <Interior ss:Color="#D1ECF1" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BEE5EB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BEE5EB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#BEE5EB"/>
   </Borders>
  </Style>
  <Style ss:ID="StatusRed">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9" ss:Bold="1" ss:Color="#721C24"/>
   <Interior ss:Color="#F8D7DA" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5C6CB"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5C6CB"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#F5C6CB"/>
   </Borders>
  </Style>
  <!-- Currency and Numbers -->
  <Style ss:ID="CurrencyCell">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Be Vietnam Pro" ss:Size="9.5" ss:Bold="1" ss:Color="#835500"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#EBE1D6"/>
   </Borders>
  </Style>
  <!-- Summary Bottom Row -->
  <Style ss:ID="SummaryRow">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Font ss:FontName="Bricolage Grotesque" ss:Size="10" ss:Bold="1" ss:Color="#835500"/>
   <Interior ss:Color="#F6ECE2" ss:Pattern="Solid"/>
   <Borders>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#835500"/>
    <Border ss:Position="Bottom" ss:LineStyle="Double" ss:Weight="3" ss:Color="#835500"/>
   </Borders>
  </Style>
 </Styles>\n`;

    sheets.forEach(sheet => {
      const colCount = sheet.headers.length;
      xml += ` <Worksheet ss:Name="${escapeXml(sheet.name)}">\n`;
      xml += `  <Table x:FullColumns="1" x:FullRows="1">\n`;

      // Set explicit column widths
      sheet.colWidths.forEach(w => {
        xml += `   <Column ss:AutoFitWidth="0" ss:Width="${w}"/>\n`;
      });

      // 1. Header Banner Title (Merged across all columns)
      xml += `   <Row ss:Height="32">\n`;
      xml += `    <Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="TitleBanner">\n`;
      xml += `     <Data ss:Type="String">${escapeXml(sheet.title)}</Data>\n`;
      xml += `    </Cell>\n`;
      xml += `   </Row>\n`;

      // 2. Sub-banner info
      const subInfo = customSubtitle || sheet.subtitle || `Thời gian xuất: ${todayStr} | Quản trị: Cô Tư Sài Gòn Alley Odyssey | Hotline: 0908 287 150`;
      xml += `   <Row ss:Height="20">\n`;
      xml += `    <Cell ss:MergeAcross="${colCount - 1}" ss:StyleID="SubBanner">\n`;
      xml += `     <Data ss:Type="String">${escapeXml(subInfo)}</Data>\n`;
      xml += `    </Cell>\n`;
      xml += `   </Row>\n`;

      // Blank spacing row
      xml += `   <Row ss:Height="10"/>\n`;

      // 3. Column Headers Row
      xml += `   <Row ss:Height="26">\n`;
      sheet.headers.forEach(h => {
        xml += `    <Cell ss:StyleID="ColHeader"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>\n`;
      });
      xml += `   </Row>\n`;

      // 4. Data Rows
      sheet.rows.forEach((row, rIdx) => {
        const rowStyle = rIdx % 2 === 0 ? 'RowEven' : 'RowOdd';
        xml += `   <Row ss:Height="22">\n`;
        row.forEach((cell, cIdx) => {
          let styleId = rowStyle;
          let dataType = 'String';
          let val = cell;

          // Check if status cell
          if (sheet.statusColIndex === cIdx) {
            const s = String(val).toLowerCase();
            if (s.includes('xác nhận') || s.includes('hoàn thành') || s.includes('chốt cọc')) styleId = 'StatusGreen';
            else if (s.includes('chờ') || s.includes('liên hệ')) styleId = 'StatusYellow';
            else if (s.includes('hủy')) styleId = 'StatusRed';
            else styleId = 'StatusBlue';
          } else if (sheet.currencyColIndex === cIdx) {
            styleId = 'CurrencyCell';
          } else if (sheet.numberColIndex && sheet.numberColIndex.includes(cIdx)) {
            const num = parseInt(String(val).replace(/[^\d.-]/g, ''), 10);
            if (!isNaN(num)) {
              dataType = 'Number';
              val = num;
              styleId = 'NumberCell';
            }
          }

          xml += `    <Cell ss:StyleID="${styleId}"><Data ss:Type="${dataType}">${escapeXml(val)}</Data></Cell>\n`;
        });
        xml += `   </Row>\n`;
      });

      // 5. Total / Summary Row (if specified)
      if (sheet.summaryText) {
        xml += `   <Row ss:Height="24">\n`;
        xml += `    <Cell ss:MergeAcross="${colCount - 2}" ss:StyleID="SummaryRow"><Data ss:Type="String">${escapeXml(sheet.summaryLabel || 'TỔNG CỘNG')}</Data></Cell>\n`;
        xml += `    <Cell ss:StyleID="SummaryRow"><Data ss:Type="String">${escapeXml(sheet.summaryText)}</Data></Cell>\n`;
        xml += `   </Row>\n`;
      }

      xml += `  </Table>\n`;
      xml += ` </Worksheet>\n`;
    });

    xml += `</Workbook>`;
    return xml;
  }

  function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // EXPORT 1: COMPREHENSIVE MULTI-SHEET EXCEL
  function exportComprehensiveExcel() {
    loadOrders();
    const filter = getDateRangeFilter();
    const allPre = window.AuthManager ? window.AuthManager.getPreBookings() : [];
    const allAct = window.AuthManager ? window.AuthManager.getActivities() : [];
    const users = window.AuthManager ? window.AuthManager.getUsers() : [];

    const ordersToExport = filter.filterOrders(ordersList);
    const preToExport = filter.filterPreBookings(allPre);
    const actToExport = filter.filterActivities(allAct);

    let periodText = 'Kỳ báo cáo: Toàn bộ lịch sử hoạt động';
    if (filter.hasFilter) {
      const typeText = filter.filterField === 'tour' ? 'Ngày khởi hành tour' : 'Ngày tạo đơn';
      periodText = `Kỳ báo cáo (${typeText}): ${filter.fromVal || 'Trước đây'} -> ${filter.toVal || 'Hiện tại'}`;
    }

    // Sheet 1: Orders
    let totalRevenueNum = 0;
    const orderRows = ordersToExport.map(o => {
      const cleanTotal = String(o.total).replace(/[^\d]/g, '');
      const num = parseInt(cleanTotal, 10);
      if (!isNaN(num) && o.status !== 'Đã hủy') totalRevenueNum += num;

      return [
        o.id,
        o.name,
        o.phone,
        o.email || '',
        o.tourDate || o.date,
        parseInt(o.guests, 10) || 1,
        o.total,
        o.payment || 'VIETQR',
        o.status,
        o.dietary || 'Bình thường',
        o.notes || ''
      ];
    });

    const sheetOrders = {
      name: 'Don_Tour_Chinh',
      title: 'DANH SÁCH ĐƠN ĐẶT TOUR HẺM CÔ TƯ SÀI GÒN',
      subtitle: `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} | ${periodText}`,
      colWidths: [80, 130, 95, 130, 110, 60, 100, 80, 100, 140, 150],
      headers: ['Mã Đơn', 'Họ Tên Khách', 'Số Điện Thoại', 'Email', 'Ngày Đi', 'Số Khách', 'Tổng Tiền', 'Thanh Toán', 'Trạng Thái', 'Khẩu Vị & Dị Ứng', 'Ghi Chú Nội Bộ'],
      statusColIndex: 8,
      currencyColIndex: 6,
      numberColIndex: [5],
      rows: orderRows,
      summaryLabel: `TỔNG CỘNG (${ordersToExport.length} ĐƠN TOUR)`,
      summaryText: `${totalRevenueNum.toLocaleString('vi-VN')}₫`
    };

    // Sheet 2: Pre-bookings
    let preBudgetTotal = 0;
    const preRows = preToExport.map(p => {
      const cleanBudget = String(p.estimatedBudget).replace(/[^\d]/g, '');
      const num = parseInt(cleanBudget, 10);
      if (!isNaN(num) && p.status !== 'Đã hủy') preBudgetTotal += num;

      return [
        p.id,
        p.customerName,
        p.phone,
        p.email || '',
        p.targetDate,
        p.timeSlot,
        p.theme,
        parseInt(p.guests, 10) || 1,
        p.estimatedBudget,
        p.status,
        p.dietaryNotes || '',
        p.specialRequests || '',
        p.adminNotes || ''
      ];
    });

    const sheetPre = {
      name: 'Khach_Dat_Truoc',
      title: 'DANH SÁCH YÊU CẦU ĐẶT TOUR TRƯỚC & TOUR RIÊNG',
      subtitle: `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} | ${periodText}`,
      colWidths: [80, 130, 95, 130, 90, 120, 190, 65, 100, 100, 140, 160, 150],
      headers: ['Mã Yêu Cầu', 'Tên Khách Hàng', 'Số Điện Thoại', 'Email', 'Ngày Dự Kiến', 'Khung Giờ', 'Tuyến Hẻm Yêu Cầu', 'Số Khách', 'Dự Toán', 'Trạng Thái', 'Khẩu Vị Dị Ứng', 'Yêu Cầu Đặc Biệt', 'Phản Hồi Nội Bộ'],
      statusColIndex: 9,
      currencyColIndex: 8,
      numberColIndex: [7],
      rows: preRows,
      summaryLabel: `TỔNG DỰ TOÁN ĐẶT TRƯỚC (${preToExport.length} YÊU CẦU)`,
      summaryText: `${preBudgetTotal.toLocaleString('vi-VN')}₫`
    };

    // Sheet 3: Activities
    const actRows = actToExport.map(a => [
      a.id,
      new Date(a.timestamp).toLocaleString('vi-VN'),
      a.user,
      a.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng',
      a.action,
      a.target || '-',
      a.details || ''
    ]);

    const sheetAct = {
      name: 'Nhat_Ky_Hoat_Dong',
      title: 'NHẬT KÝ HÀNH ĐỘNG KHÁCH HÀNG & HỆ THỐNG',
      subtitle: `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} | ${periodText}`,
      colWidths: [80, 120, 130, 95, 140, 90, 260],
      headers: ['Mã Hoạt Động', 'Thời Gian', 'Người Thực Hiện', 'Vai Trò', 'Hành Động', 'Đối Tượng', 'Chi Tiết Thao Tác'],
      statusColIndex: 4,
      rows: actRows,
      summaryLabel: `TỔNG CỘNG HÀNH ĐỘNG (${actToExport.length} SỰ KIỆN)`,
      summaryText: `${actToExport.length} sự kiện`
    };

    // Sheet 4: Customer Directory
    const custUsers = users.filter(u => u.role === 'customer');
    const custRows = custUsers.map(c => [
      c.id,
      c.fullName,
      c.phone,
      c.email,
      c.tier || 'Thành Viên',
      c.dietary || 'Bình thường',
      c.createdAt ? new Date(c.createdAt).toLocaleDateString('vi-VN') : ''
    ]);

    const sheetCust = {
      name: 'Khach_Hang_Than_Thiet',
      title: 'DANH SÁCH THÀNH VIÊN & HỘI VIÊN CÔ TƯ',
      colWidths: [90, 140, 100, 150, 130, 180, 95],
      headers: ['Mã KH', 'Họ Và Tên', 'Số Điện Thoại', 'Email', 'Hạng Thành Viên', 'Khẩu Vị Mặc Định', 'Ngày Tham Gia'],
      rows: custRows
    };

    const xml = buildStyledSpreadsheetXML([sheetOrders, sheetPre, sheetAct, sheetCust], `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')} | ${periodText}`);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(xml, `Bao_Cao_Quan_Tri_Co_Tu_Toan_Dien_${today}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    showToast(`Đã xuất Báo Cáo Excel Toàn Diện (${ordersToExport.length} đơn, ${preToExport.length} đặt trước)!`, 'success');
  }

  // EXPORT 2: DIRECT ORDERS EXCEL (Đơn Tour Trực Tiếp)
  function exportOrdersExcel() {
    loadOrders();
    const filter = getDateRangeFilter();
    let ordersToExport = ordersList;

    if (currentAdminTab === 'excel' && filter.hasFilter) {
      ordersToExport = filter.filterOrders(ordersList);
    } else if (currentAdminTab === 'orders') {
      const searchTerm = (document.getElementById('admin-search-orders')?.value || '').toLowerCase().trim();
      const filterStatus = document.getElementById('admin-status-filter')?.value || 'all';
      ordersToExport = ordersList.filter(ord => {
        const matchSearch = ord.id.toLowerCase().includes(searchTerm) ||
                            ord.name.toLowerCase().includes(searchTerm) ||
                            ord.phone.includes(searchTerm) ||
                            (ord.email && ord.email.toLowerCase().includes(searchTerm));
        const matchStatus = filterStatus === 'all' || ord.status === filterStatus;
        return matchSearch && matchStatus;
      });
    }

    if (ordersToExport.length === 0) {
      showToast('Không có dữ liệu đơn tour phù hợp để xuất file!', 'error');
      return;
    }

    let totalRevenueNum = 0;
    const orderRows = ordersToExport.map(o => {
      const cleanTotal = String(o.total).replace(/[^\d]/g, '');
      const num = parseInt(cleanTotal, 10);
      if (!isNaN(num) && o.status !== 'Đã hủy') totalRevenueNum += num;

      return [
        o.id,
        o.name,
        o.phone,
        o.email || '',
        o.tourDate || o.date,
        parseInt(o.guests, 10) || 1,
        o.total,
        o.payment || 'VIETQR',
        o.status,
        o.dietary || 'Bình thường',
        o.notes || ''
      ];
    });

    const sheetOrders = {
      name: 'Don_Tour_Co_Tu',
      title: 'BÁO CÁO DANH SÁCH ĐƠN ĐẶT TOUR - CÔ TƯ HẺM SAIGON',
      colWidths: [80, 130, 95, 130, 110, 60, 100, 80, 100, 140, 150],
      headers: ['Mã Đơn', 'Họ Tên Khách', 'Số Điện Thoại', 'Email', 'Ngày Đi', 'Số Khách', 'Tổng Tiền', 'Thanh Toán', 'Trạng Thái', 'Khẩu Vị & Dị Ứng', 'Ghi Chú'],
      statusColIndex: 8,
      currencyColIndex: 6,
      numberColIndex: [5],
      rows: orderRows,
      summaryLabel: `TỔNG CỘNG (${ordersToExport.length} ĐƠN TOUR)`,
      summaryText: `${totalRevenueNum.toLocaleString('vi-VN')}₫`
    };

    const xml = buildStyledSpreadsheetXML([sheetOrders]);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(xml, `Danh_Sach_Don_Tour_Co_Tu_${today}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    showToast(`Đã xuất Excel Đơn Tour (${ordersToExport.length} đơn) thành công!`, 'success');
  }

  // EXPORT 3: PRE-BOOKINGS EXCEL (Khách Đặt Tour Trước)
  function exportPreBookingsExcel() {
    const filter = getDateRangeFilter();
    let prebookings = window.AuthManager ? window.AuthManager.getPreBookings() : [];

    if (currentAdminTab === 'excel' && filter.hasFilter) {
      prebookings = filter.filterPreBookings(prebookings);
    } else if (currentAdminTab === 'prebookings') {
      const searchTerm = (document.getElementById('admin-search-prebookings')?.value || '').toLowerCase().trim();
      const filterStatus = document.getElementById('admin-status-pre-filter')?.value || 'all';
      prebookings = prebookings.filter(p => {
        const matchSearch = p.id.toLowerCase().includes(searchTerm) ||
                            p.customerName.toLowerCase().includes(searchTerm) ||
                            p.phone.includes(searchTerm) ||
                            p.theme.toLowerCase().includes(searchTerm);
        const matchStatus = filterStatus === 'all' || p.status === filterStatus;
        return matchSearch && matchStatus;
      });
    }

    if (prebookings.length === 0) {
      showToast('Không có dữ liệu yêu cầu đặt tour trước phù hợp để xuất file!', 'error');
      return;
    }

    let preBudgetTotal = 0;
    const preRows = prebookings.map(p => {
      const cleanBudget = String(p.estimatedBudget).replace(/[^\d]/g, '');
      const num = parseInt(cleanBudget, 10);
      if (!isNaN(num) && p.status !== 'Đã hủy') preBudgetTotal += num;

      return [
        p.id,
        p.customerName,
        p.phone,
        p.email || '',
        p.targetDate,
        p.timeSlot,
        p.theme,
        parseInt(p.guests, 10) || 1,
        p.estimatedBudget,
        p.status,
        p.dietaryNotes || '',
        p.specialRequests || '',
        p.adminNotes || ''
      ];
    });

    let periodSub = `Thời gian xuất: ${new Date().toLocaleDateString('vi-VN')}`;
    if (filter.hasFilter) {
      periodSub += ` | Kỳ: ${filter.fromVal || 'Trước'} -> ${filter.toVal || 'Nay'}`;
    }

    const sheetPre = {
      name: 'Dat_Tour_Truoc',
      title: 'BÁO CÁO YÊU CẦU ĐẶT TOUR TRƯỚC - CÔ TƯ HẺM SAIGON',
      subtitle: periodSub,
      colWidths: [80, 130, 95, 130, 90, 120, 190, 65, 100, 100, 140, 160, 150],
      headers: ['Mã Yêu Cầu', 'Tên Khách Hàng', 'Số Điện Thoại', 'Email', 'Ngày Dự Kiến', 'Khung Giờ', 'Tuyến Hẻm Yêu Cầu', 'Số Khách', 'Dự Toán', 'Trạng Thái', 'Khẩu Vị Dị Ứng', 'Yêu Cầu Đặc Biệt', 'Phản Hồi Nội Bộ'],
      statusColIndex: 9,
      currencyColIndex: 8,
      numberColIndex: [7],
      rows: preRows,
      summaryLabel: `TỔNG CỘNG (${prebookings.length} YÊU CẦU ĐẶT TRƯỚC)`,
      summaryText: `${preBudgetTotal.toLocaleString('vi-VN')}₫`
    };

    const xml = buildStyledSpreadsheetXML([sheetPre], periodSub);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(xml, `Danh_Sach_Dat_Tour_Truoc_Co_Tu_${today}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    showToast(`Đã xuất Excel Đặt Tour Trước (${prebookings.length} yêu cầu) thành công!`, 'success');
  }

  // EXPORT 4: ACTIVITIES EXCEL (Nhật Ký Hành Động)
  function exportActivitiesExcel() {
    const filter = getDateRangeFilter();
    let activities = window.AuthManager ? window.AuthManager.getActivities() : [];

    if (filter.hasFilter) {
      activities = filter.filterActivities(activities);
    }

    if (activities.length === 0) {
      showToast('Không có dữ liệu nhật ký hành động phù hợp để xuất file!', 'error');
      return;
    }

    const actRows = activities.map(a => [
      a.id,
      new Date(a.timestamp).toLocaleString('vi-VN'),
      a.user,
      a.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng',
      a.action,
      a.target || '-',
      a.details || ''
    ]);

    const sheetAct = {
      name: 'Nhat_Ky_Khach_Hang',
      title: 'BÁO CÁO NHẬT KÝ HÀNH ĐỘNG KHÁCH HÀNG - CÔ TƯ TOUR',
      colWidths: [80, 130, 140, 95, 150, 90, 270],
      headers: ['Mã Hoạt Động', 'Thời Gian', 'Người Thực Hiện', 'Vai Trò', 'Hành Động', 'Mã Đối Tượng', 'Chi Tiết Thao Tác'],
      statusColIndex: 4,
      rows: actRows,
      summaryLabel: 'TỔNG SỐ HÀNH ĐỘNG GHI NHẬN',
      summaryText: `${activities.length} sự kiện`
    };

    const xml = buildStyledSpreadsheetXML([sheetAct]);
    const today = new Date().toISOString().slice(0, 10);
    downloadFile(xml, `Nhat_Ky_Hanh_Dong_Khach_Hang_${today}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    showToast(`Đã xuất Excel Nhật Ký Hành Động (${activities.length} sự kiện) thành công!`, 'success');
  }

  // EXPORT 5: STANDARD CSV (UTF-8 BOM)
  function exportCSV() {
    loadOrders();
    const filter = getDateRangeFilter();
    const ordersToExport = filter.filterOrders(ordersList);

    if (ordersToExport.length === 0) {
      showToast('Không có dữ liệu đơn tour phù hợp để xuất file!', 'error');
      return;
    }

    const escCsv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    let csv = "\uFEFFMã Đơn,Họ Tên Khách,Số Điện Thoại,Email,Ngày & Giờ Đi,Số Khách,Tổng Tiền,Thanh Toán,Trạng Thái,Khẩu Vị & Dị Ứng,Ghi Chú\n";
    ordersToExport.forEach(o => {
      csv += [
        o.id,
        o.name,
        o.phone,
        o.email || '',
        o.tourDate || o.date,
        o.guests,
        o.total,
        o.payment || '',
        o.status,
        o.dietary || '',
        o.notes || ''
      ].map(escCsv).join(',') + "\n";
    });

    const today = new Date().toISOString().slice(0, 10);
    downloadFile(csv, `Danh_Sach_Dat_Tour_Co_Tu_${today}.csv`, 'text/csv;charset=utf-8;');
    showToast(`Đã xuất file CSV (${ordersToExport.length} đơn) thành công!`, 'success');
  }

  // QR Code Canvas Engine
  function generateQRCanvas() {
    const canvas = document.getElementById('qr-canvas-preview');
    const input = document.getElementById('qr-url-input');
    if (!canvas) return;

    const link = (input ? input.value : '') || (typeof window !== 'undefined' && window.location ? window.location.href : 'https://cotu-saigon.vn');

    if (window.QRCodeGenerator && window.QRCodeGenerator.renderToCanvas) {
      window.QRCodeGenerator.renderToCanvas(canvas, link, {
        size: 200,
        darkColor: '#1b1c1a',
        bgColor: '#ffffff',
        logoBgColor: '#835500',
        logoBorderColor: '#f5a623',
        logoText: 'CÔ TƯ'
      });
      return;
    }

    const ctx = canvas.getContext('2d');
    const size = 180;

    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(215, 195, 174, 0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, size - 2, size - 2);

    ctx.fillStyle = '#1b1c1a';
    function drawCorner(x, y, s) {
      ctx.fillRect(x, y, s, s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 7, y + 7, s - 14, s - 14);
      ctx.fillStyle = '#1b1c1a';
      ctx.fillRect(x + 13, y + 13, s - 26, s - 26);
    }
    drawCorner(14, 14, 44);
    drawCorner(122, 14, 44);
    drawCorner(14, 122, 44);

    for (let i = 62; i < 118; i += 8) {
      ctx.fillRect(i, 28, 4, 4);
      ctx.fillRect(28, i, 4, 4);
    }

    let hash = 0;
    for (let i = 0; i < link.length; i++) {
      hash = ((hash << 5) - hash) + link.charCodeAt(i);
      hash |= 0;
    }

    const gridSize = 18;
    const cellSize = 7;
    const offset = 27;

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if ((r < 7 && c < 7) || (r < 7 && c > 10) || (r > 10 && c < 7)) continue;
        if (r >= 7 && r <= 10 && c >= 7 && c <= 10) continue;

        const bit = Math.abs((hash ^ (r * 31 + c * 47 + link.length * 13))) % 2;
        if (bit === 1) {
          ctx.fillStyle = '#1b1c1a';
          ctx.fillRect(offset + c * cellSize, offset + r * cellSize, cellSize - 1, cellSize - 1);
        }
      }
    }

    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, 18, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#644000';
    ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TƯ', size / 2, size / 2 + 1);
  }

  function downloadQRPNG() {
    const canvas = document.getElementById('qr-canvas-preview');
    if (!canvas) return;
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    link.download = "Ma-QR-Dat-Tour-Co-Tu-Saigon.png";
    link.href = image;
    link.click();
    showToast('Đã tải hình ảnh QR về máy!', 'success');
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
    openAdminModal,
    closeAdminModal,
    switchAdminTab,
    refreshOrders: () => {
      loadOrders();
      renderOrdersTable();
      renderPreBookingsTable();
      renderCustomersTable();
      renderActivitiesTable();
      updateKPIs();
      updateExcelPreviewKPIs();
    },
    renderCustomersTable,
    matchesCustomerTier,
    updateOrderStatus,
    deleteOrder,
    exportComprehensiveExcel,
    exportOrdersExcel,
    exportPreBookingsExcel,
    exportActivitiesExcel,
    exportCSV,
    parseFlexibleDate,
    getDateRangeFilter,
    applyDatePreset
  };
})();
