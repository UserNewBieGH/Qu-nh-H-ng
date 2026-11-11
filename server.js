/**
 * Cô Tư Saigon Alley Food Tour - Zero-Dependency Node.js Backend & Real-Time Sync Server
 * Provides static hosting, persistent JSON storage (data/db.json), REST APIs,
 * Server-Sent Events (SSE) real-time sync, and virtual-adapter-aware LAN IP detection.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const vm = require('vm');

const VIRTUAL_ADAPTER_REGEX = /(vmware|vmnet|virtualbox|vbox|vethernet|hyper-v|wsl|docker|bluetooth|loopback|teredo|isatap|hamachi|radmin|zerotier|tailscale|vpn|tunnel)/i;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
};

const BLOCKED_STATIC_PREFIXES = ['/data/', '/.git/', '/node_modules/'];
const BLOCKED_STATIC_FILES = new Set([
  '/server.js',
  '/package.json',
  '/package-lock.json',
  '/test_runner.js',
  '/test_functional.js',
  '/test_deep_verification.js',
  '/test_server_sync.js'
]);

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

function sanitizeUser(u) {
  if (!u || typeof u !== 'object') return null;
  const copy = { ...u };
  delete copy.password;
  return copy;
}

function isPrivateLanIPv4(ip) {
  if (!ip) return false;
  if (ip.startsWith('192.168.') || ip.startsWith('10.')) return true;
  if (ip.startsWith('172.')) {
    const second = parseInt(ip.split('.')[1], 10);
    return second >= 16 && second <= 31;
  }
  return false;
}

function scoreInterface(name, address) {
  let score = 0;
  const n = String(name || '');
  if (/^(wi-?fi|wlan|wireless)/i.test(n)) score += 100;
  else if (/(wi-?fi|wlan|wireless)/i.test(n)) score += 80;
  else if (/^(ethernet|eth\d|en\d)/i.test(n)) score += 60;
  else if (/ethernet/i.test(n)) score += 40;
  else score += 20;

  if (isPrivateLanIPv4(address)) score += 20;
  if (address.startsWith('192.168.')) score += 10;
  return score;
}

function getNetworkInfo(port = 3000, interfacesProvider = os.networkInterfaces) {
  const raw = typeof interfacesProvider === 'function' ? interfacesProvider() : {};
  const interfaces = [];
  const filteredVirtual = [];

  for (const [name, addrs] of Object.entries(raw || {})) {
    if (!Array.isArray(addrs)) continue;
    for (const iface of addrs) {
      if (!iface) continue;
      const family = typeof iface.family === 'string' ? iface.family : (iface.family === 4 ? 'IPv4' : 'IPv6');
      if (family !== 'IPv4' || iface.internal) continue;
      const addr = iface.address;
      if (!addr || addr.startsWith('127.') || addr.startsWith('169.254.')) {
        filteredVirtual.push({ name, address: addr, reason: 'link-local-or-loopback' });
        continue;
      }
      if (VIRTUAL_ADAPTER_REGEX.test(name)) {
        filteredVirtual.push({ name, address: addr, reason: 'virtual-adapter' });
        continue;
      }
      interfaces.push({
        name,
        address: addr,
        url: `http://${addr}:${port}/`,
        score: scoreInterface(name, addr)
      });
    }
  }

  interfaces.sort((a, b) => b.score - a.score);
  const primary = interfaces[0] || null;

  return {
    port,
    primaryLanIp: primary ? primary.address : null,
    primaryLanUrl: primary ? `http://${primary.address}:${port}/` : null,
    adminLanUrl: primary ? `http://${primary.address}:${port}/admin-login.html` : null,
    localUrl: `http://localhost:${port}/`,
    interfaces: interfaces.map(({ name, address, url }) => ({ name, address, url })),
    filteredVirtual
  };
}

function loadSeedData(rootDir) {
  const fallback = {
    orders: [],
    prebookings: [],
    users: [],
    activities: []
  };

  try {
    const dataJsPath = path.join(rootDir, 'js', 'data.js');
    if (!fs.existsSync(dataJsPath)) return fallback;
    const code = fs.readFileSync(dataJsPath, 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(code, sandbox);
    const data = sandbox.window.CO_TU_DATA || {};
    return {
      orders: Array.isArray(data.initialOrders) ? JSON.parse(JSON.stringify(data.initialOrders)) : [],
      prebookings: Array.isArray(data.initialPreBookings) ? JSON.parse(JSON.stringify(data.initialPreBookings)) : [],
      users: Array.isArray(data.initialUsers) ? JSON.parse(JSON.stringify(data.initialUsers)) : [],
      activities: Array.isArray(data.initialActivities) ? JSON.parse(JSON.stringify(data.initialActivities)) : []
    };
  } catch (err) {
    console.warn('[Server] Could not load seed data from js/data.js:', err.message);
    return fallback;
  }
}

function createStore(rootDir, dbPath) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let db = null;
  if (fs.existsSync(dbPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (parsed && Array.isArray(parsed.orders) && Array.isArray(parsed.prebookings) && Array.isArray(parsed.users) && Array.isArray(parsed.activities)) {
        db = {
          revision: typeof parsed.revision === 'number' ? parsed.revision : 1,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
          orders: parsed.orders,
          prebookings: parsed.prebookings,
          users: parsed.users,
          activities: parsed.activities
        };
      }
    } catch (err) {
      console.warn('[Server] Existing db.json unreadable, re-seeding:', err.message);
    }
  }

  if (!db) {
    const seed = loadSeedData(rootDir);
    db = {
      revision: 1,
      updatedAt: new Date().toISOString(),
      orders: seed.orders,
      prebookings: seed.prebookings,
      users: seed.users,
      activities: seed.activities
    };
    persist();
  }

  function persist() {
    const tmpPath = `${dbPath}.${process.pid}.tmp`;
    const serialized = JSON.stringify(db, null, 2);
    try {
      fs.writeFileSync(tmpPath, serialized, 'utf8');
      fs.renameSync(tmpPath, dbPath);
    } catch (err) {
      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
      } catch (_) {}
      fs.writeFileSync(dbPath, serialized, 'utf8');
    }
  }

  function bumpRevision() {
    db.revision = (db.revision || 0) + 1;
    db.updatedAt = new Date().toISOString();
    persist();
  }

  function addActivity({ user, role, action, target, details, id, timestamp }) {
    const actId = id || ('ACT-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(10 + Math.random() * 90));
    if (db.activities.some(a => a.id === actId)) {
      return db.activities.find(a => a.id === actId);
    }
    const entry = {
      id: actId,
      user: user || 'Khách vãng lai',
      role: role || 'guest',
      action: action || 'Thao tác hệ thống',
      target: target || '',
      details: details || '',
      timestamp: timestamp || new Date().toISOString()
    };
    db.activities.unshift(entry);
    if (db.activities.length > 200) {
      db.activities = db.activities.slice(0, 200);
    }
    return entry;
  }

  function getPublicState() {
    return {
      revision: db.revision,
      updatedAt: db.updatedAt,
      orders: db.orders,
      prebookings: db.prebookings,
      users: db.users.map(sanitizeUser),
      activities: db.activities
    };
  }

  return {
    db,
    persist,
    bumpRevision,
    addActivity,
    getPublicState
  };
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function parseJsonBody(req, maxBytes = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if (size > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(Object.assign(new Error('Invalid JSON payload'), { statusCode: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function createAppServer(options = {}) {
  const rootDir = path.resolve(options.rootDir || __dirname);
  const dbPath = path.resolve(options.dbPath || process.env.DB_PATH || path.join(rootDir, 'data', 'db.json'));
  const port = options.port !== undefined ? options.port : parseInt(process.env.PORT || '3000', 10);
  const host = options.host || process.env.HOST || '0.0.0.0';
  const networkInterfacesFn = options.networkInterfacesFn || os.networkInterfaces;

  const store = createStore(rootDir, dbPath);
  const sseClients = new Set();

  function broadcast(eventType, extra = {}) {
    const payload = JSON.stringify({
      type: eventType,
      revision: store.db.revision,
      updatedAt: store.db.updatedAt,
      ...extra
    });
    const frame = `event: state\ndata: ${payload}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }

  const heartbeatInterval = setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(': ping\n\n');
      } catch (_) {
        sseClients.delete(client);
      }
    }
  }, 25000);
  if (typeof heartbeatInterval.unref === 'function') {
    heartbeatInterval.unref();
  }

  const server = http.createServer(async (req, res) => {
    try {
      const rawUrlStr = String(req.url || '/');
      const qIdx = rawUrlStr.indexOf('?');
      const rawPathPart = qIdx === -1 ? rawUrlStr : rawUrlStr.slice(0, qIdx);
      let decodedPath;
      try {
        decodedPath = decodeURIComponent(rawPathPart);
      } catch (_) {
        return sendJson(res, 400, { success: false, message: 'Malformed URL encoding' });
      }
      const pathname = decodedPath.replace(/\\/g, '/').replace(/\/+/g, '/');
      const method = (req.method || 'GET').toUpperCase();

      if (method === 'OPTIONS') {
        res.writeHead(204, {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400'
        });
        res.end();
        return;
      }

      // =======================================================================
      // API ROUTES
      // =======================================================================
      if (pathname === '/api/network-info' && method === 'GET') {
        const activePort = (server.address() && typeof server.address() === 'object' && server.address().port) || port;
        return sendJson(res, 200, getNetworkInfo(activePort, networkInterfacesFn));
      }

      if (pathname === '/api/events' && method === 'GET') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Access-Control-Allow-Origin': '*'
        });
        res.write(`event: connected\ndata: ${JSON.stringify({ type: 'connected', revision: store.db.revision, updatedAt: store.db.updatedAt })}\n\n`);
        sseClients.add(res);
        req.on('close', () => {
          sseClients.delete(res);
        });
        return;
      }

      if (pathname === '/api/state' && method === 'GET') {
        return sendJson(res, 200, store.getPublicState());
      }

      // --- ORDERS ---
      if (pathname === '/api/orders' && method === 'GET') {
        return sendJson(res, 200, { revision: store.db.revision, orders: store.db.orders });
      }

      if (pathname === '/api/orders' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body || !body.name || !body.phone) {
          return sendJson(res, 400, { success: false, message: 'Thiếu thông tin khách hàng hoặc số điện thoại!' });
        }

        let orderId = body.id && String(body.id).trim();
        const cleanPhone = normalizePhone(body.phone);
        let existingIdx = orderId ? store.db.orders.findIndex(o => o.id === orderId) : -1;

        if (existingIdx !== -1) {
          const prev = store.db.orders[existingIdx];
          const sameOrder = (prev.createdAt && body.createdAt && prev.createdAt === body.createdAt) ||
                            (normalizePhone(prev.phone) === cleanPhone && prev.name === String(body.name).trim());
          if (!sameOrder) {
            orderId = '';
            existingIdx = -1;
          }
        }

        if (!orderId) {
          do {
            orderId = `CT-${Math.floor(1000 + Math.random() * 9000)}`;
          } while (store.db.orders.some(o => o.id === orderId));
        }

        const orderRecord = {
          id: orderId,
          userId: body.userId || null,
          name: String(body.name).trim(),
          phone: cleanPhone || String(body.phone).trim(),
          email: body.email ? String(body.email).trim() : 'Chưa cung cấp',
          tourDate: body.tourDate || '',
          tourTime: body.tourTime || '16:30',
          date: body.date || (body.tourDate ? `${body.tourDate} lúc ${body.tourTime || '16:30'}` : ''),
          guests: parseInt(body.guests, 10) || 1,
          adults: parseInt(body.adults, 10) || parseInt(body.guests, 10) || 1,
          children: parseInt(body.children, 10) || 0,
          total: body.total || '590.000₫',
          discount: body.discount || '0₫',
          payment: String(body.payment || 'VIETQR').toUpperCase(),
          status: body.status || 'Đã xác nhận',
          dietary: body.dietary || 'Ăn được tất cả',
          notes: body.notes || 'Không có ghi chú thêm',
          createdAt: body.createdAt || new Date().toISOString()
        };

        if (existingIdx !== -1) {
          store.db.orders[existingIdx] = orderRecord;
        } else {
          store.db.orders.unshift(orderRecord);
        }

        if (!body._skipActivity) {
          store.addActivity({
            id: body._activityId,
            user: body._actorName || orderRecord.name,
            role: body._actorRole || (orderRecord.userId ? 'customer' : 'guest'),
            action: 'Đặt tour trực tiếp',
            target: orderRecord.id,
            details: `Khách ${orderRecord.name} (${orderRecord.phone}) đặt tour ngày ${orderRecord.tourDate || orderRecord.date} (${orderRecord.guests} khách). Tổng tiền: ${orderRecord.total}`
          });
        }

        store.bumpRevision();
        broadcast('orders:created', { order: orderRecord });
        return sendJson(res, 201, { success: true, order: orderRecord, revision: store.db.revision });
      }

      const orderMatch = pathname.match(/^\/api\/orders\/([^/]+)$/);
      if (orderMatch && method === 'PATCH') {
        const id = orderMatch[1];
        const body = await parseJsonBody(req);
        const order = store.db.orders.find(o => o.id === id);
        if (!order) {
          return sendJson(res, 404, { success: false, message: 'Không tìm thấy đơn tour!' });
        }

        const prevStatus = order.status;
        if (body.status !== undefined) order.status = String(body.status);
        if (body.notes !== undefined) order.notes = String(body.notes);
        if (body.tourDate !== undefined) order.tourDate = String(body.tourDate);
        if (body.date !== undefined) order.date = String(body.date);
        order.updatedAt = new Date().toISOString();

        if (!body._skipActivity) {
          store.addActivity({
            id: body._activityId,
            user: body._actorName || 'Quản Trị Viên Cô Tư',
            role: body._actorRole || 'admin',
            action: 'Cập nhật trạng thái đơn tour',
            target: order.id,
            details: `Quản Trị Viên đổi trạng thái đơn ${order.id} từ "${prevStatus}" thành "${order.status}"`
          });
        }

        store.bumpRevision();
        broadcast('orders:updated', { order });
        return sendJson(res, 200, { success: true, order, revision: store.db.revision });
      }

      if (orderMatch && method === 'DELETE') {
        const id = orderMatch[1];
        const idx = store.db.orders.findIndex(o => o.id === id);
        if (idx === -1) {
          return sendJson(res, 404, { success: false, message: 'Không tìm thấy đơn tour!' });
        }
        const [removed] = store.db.orders.splice(idx, 1);

        store.addActivity({
          user: 'Quản Trị Viên Cô Tư',
          role: 'admin',
          action: 'Xóa đơn tour',
          target: id,
          details: `Quản Trị Viên đã xóa đơn tour ${id} (${removed.name})`
        });

        store.bumpRevision();
        broadcast('orders:deleted', { id });
        return sendJson(res, 200, { success: true, id, revision: store.db.revision });
      }

      // --- PRE-BOOKINGS ---
      if (pathname === '/api/prebookings' && method === 'GET') {
        return sendJson(res, 200, { revision: store.db.revision, prebookings: store.db.prebookings });
      }

      if (pathname === '/api/prebookings' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body || !body.customerName || !body.phone) {
          return sendJson(res, 400, { success: false, message: 'Thiếu thông tin khách hàng hoặc số điện thoại!' });
        }

        let preId = body.id && String(body.id).trim();
        const cleanPhone = normalizePhone(body.phone);
        let existingIdx = preId ? store.db.prebookings.findIndex(p => p.id === preId) : -1;

        if (existingIdx !== -1) {
          const prev = store.db.prebookings[existingIdx];
          const samePre = (prev.createdAt && body.createdAt && prev.createdAt === body.createdAt) ||
                          (normalizePhone(prev.phone) === cleanPhone && prev.customerName === String(body.customerName).trim());
          if (!samePre) {
            preId = '';
            existingIdx = -1;
          }
        }

        if (!preId) {
          do {
            preId = `PRE-${Math.floor(100 + Math.random() * 900)}`;
          } while (store.db.prebookings.some(p => p.id === preId));
        }

        const preRecord = {
          id: preId,
          userId: body.userId || null,
          customerName: String(body.customerName).trim(),
          phone: cleanPhone || String(body.phone).trim(),
          email: body.email ? String(body.email).trim() : '',
          targetDate: body.targetDate || '',
          timeSlot: body.timeSlot || '16:30 (Chiều mát)',
          theme: body.theme || 'Hẻm Ẩm Thực Toàn Diện 5 Trạm',
          guests: parseInt(body.guests, 10) || 2,
          estimatedBudget: body.estimatedBudget || `${((parseInt(body.guests, 10) || 2) * 590000).toLocaleString('vi-VN')}₫`,
          dietaryNotes: body.dietaryNotes || 'Ăn được tất cả',
          specialRequests: body.specialRequests || 'Không có yêu cầu thêm',
          status: body.status || 'Chờ tư vấn',
          adminNotes: body.adminNotes || '',
          createdAt: body.createdAt || new Date().toISOString()
        };

        if (existingIdx !== -1) {
          store.db.prebookings[existingIdx] = preRecord;
        } else {
          store.db.prebookings.unshift(preRecord);
        }

        if (!body._skipActivity) {
          store.addActivity({
            id: body._activityId,
            user: body._actorName || preRecord.customerName,
            role: body._actorRole || (preRecord.userId ? 'customer' : 'guest'),
            action: 'Đăng ký đặt tour trước',
            target: preRecord.id,
            details: `Khách ${preRecord.customerName} gửi yêu cầu ${preRecord.theme} cho ${preRecord.guests} khách ngày ${preRecord.targetDate}`
          });
        }

        store.bumpRevision();
        broadcast('prebookings:created', { preBooking: preRecord });
        return sendJson(res, 201, { success: true, preBooking: preRecord, revision: store.db.revision });
      }

      const preMatch = pathname.match(/^\/api\/prebookings\/([^/]+)$/);
      if (preMatch && method === 'PATCH') {
        const id = preMatch[1];
        const body = await parseJsonBody(req);
        const item = store.db.prebookings.find(p => p.id === id);
        if (!item) {
          return sendJson(res, 404, { success: false, message: 'Không tìm thấy yêu cầu đặt tour trước!' });
        }

        if (body.status !== undefined) item.status = String(body.status);
        if (body.adminNotes !== undefined && body.adminNotes !== null) item.adminNotes = String(body.adminNotes);
        item.updatedAt = new Date().toISOString();

        if (!body._skipActivity) {
          store.addActivity({
            id: body._activityId,
            user: body._actorName || 'Quản Trị Viên Cô Tư',
            role: body._actorRole || 'admin',
            action: 'Duyệt đặt tour trước',
            target: item.id,
            details: `Quản Trị Viên cập nhật ${item.id} sang "${item.status}"${item.adminNotes ? ' - Ghi chú: ' + item.adminNotes : ''}`
          });
        }

        store.bumpRevision();
        broadcast('prebookings:updated', { preBooking: item });
        return sendJson(res, 200, { success: true, preBooking: item, revision: store.db.revision });
      }

      if (preMatch && method === 'DELETE') {
        const id = preMatch[1];
        const idx = store.db.prebookings.findIndex(p => p.id === id);
        if (idx === -1) {
          return sendJson(res, 404, { success: false, message: 'Không tìm thấy yêu cầu đặt tour trước!' });
        }
        const [item] = store.db.prebookings.splice(idx, 1);

        store.addActivity({
          user: 'Quản Trị Viên Cô Tư',
          role: 'admin',
          action: 'Xóa yêu cầu đặt trước',
          target: id,
          details: `Quản Trị Viên đã xóa yêu cầu ${id} của khách ${item.customerName}`
        });

        store.bumpRevision();
        broadcast('prebookings:deleted', { id });
        return sendJson(res, 200, { success: true, message: `Đã xóa yêu cầu đặt tour trước ${id} thành công!`, id, revision: store.db.revision });
      }

      // --- USERS ---
      if (pathname === '/api/users' && method === 'GET') {
        return sendJson(res, 200, { revision: store.db.revision, users: store.db.users.map(sanitizeUser) });
      }

      if (pathname === '/api/users/register' && method === 'POST') {
        const body = await parseJsonBody(req);
        const fullName = String(body.fullName || '').trim();
        const phoneClean = normalizePhone(body.phone);
        const emailClean = String(body.email || '').trim().toLowerCase();
        const password = String(body.password || '');
        const dietary = String(body.dietary || '').trim() || 'Ăn được tất cả';

        if (fullName.length < 2) {
          return sendJson(res, 400, { success: false, message: 'Vui lòng nhập họ và tên hợp lệ (tối thiểu 2 ký tự)!' });
        }
        const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
        if (!phoneRegex.test(phoneClean)) {
          return sendJson(res, 400, { success: false, message: 'Số điện thoại không đúng chuẩn viễn thông Việt Nam (10 số, đầu 03, 05, 07, 08, 09)!' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailClean)) {
          return sendJson(res, 400, { success: false, message: 'Địa chỉ email không hợp lệ!' });
        }
        if (password.length < 6) {
          return sendJson(res, 400, { success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự bảo mật!' });
        }

        if (store.db.users.some(u => u.email && u.email.toLowerCase() === emailClean)) {
          return sendJson(res, 409, { success: false, message: 'Địa chỉ email này đã được đăng ký tài khoản trước đó!' });
        }
        if (store.db.users.some(u => u.phone && normalizePhone(u.phone) === phoneClean)) {
          return sendJson(res, 409, { success: false, message: 'Số điện thoại này đã được liên kết với một tài khoản!' });
        }

        let newId = body.id && String(body.id).trim();
        if (!newId || store.db.users.some(u => u.id === newId)) {
          newId = 'usr-cust-' + Date.now() + '-' + Math.floor(10 + Math.random() * 90);
        }

        const newUser = {
          id: newId,
          username: emailClean.split('@')[0],
          email: emailClean,
          password,
          fullName,
          phone: phoneClean,
          role: 'customer',
          dietary,
          tier: 'Hội Viên Thân Thiết Mới',
          avatar: '👤',
          createdAt: new Date().toISOString()
        };

        store.db.users.push(newUser);
        store.addActivity({
          user: newUser.fullName,
          role: 'customer',
          action: 'Đăng ký tài khoản mới',
          target: newUser.id,
          details: `Khách hàng ${newUser.fullName} tạo tài khoản mới qua SĐT ${newUser.phone}`
        });

        store.bumpRevision();
        const safeUser = sanitizeUser(newUser);
        broadcast('users:created', { user: safeUser });
        return sendJson(res, 201, {
          success: true,
          user: safeUser,
          message: `Chúc mừng ${newUser.fullName}! Bạn đã tạo tài khoản khách hàng thành công.`,
          revision: store.db.revision
        });
      }

      if (pathname === '/api/users/login' && method === 'POST') {
        const body = await parseJsonBody(req);
        const rawId = String(body.identifier || '').trim();
        const trimmedId = rawId.toLowerCase();
        const normalizedPhoneId = normalizePhone(rawId);
        const trimmedPw = String(body.password || '').trim();
        const requiredRole = body.requiredRole;

        if (!trimmedId || !trimmedPw) {
          return sendJson(res, 400, { success: false, message: 'Vui lòng nhập đầy đủ tài khoản/email/SĐT và mật khẩu!' });
        }

        const user = store.db.users.find(u =>
          (u.username && u.username.toLowerCase() === trimmedId) ||
          (u.email && u.email.toLowerCase() === trimmedId) ||
          (normalizedPhoneId && u.phone && normalizePhone(u.phone) === normalizedPhoneId)
        );

        if (!user) {
          return sendJson(res, 401, { success: false, message: 'Tài khoản không tồn tại trong hệ thống!' });
        }

        if (user.password !== trimmedPw) {
          return sendJson(res, 401, { success: false, message: 'Mật khẩu không chính xác. Vui lòng thử lại!' });
        }

        if (requiredRole && user.role !== requiredRole) {
          if (requiredRole === 'customer') {
            return sendJson(res, 403, {
              success: false,
              code: 'role_mismatch',
              message: 'Cổng đăng nhập này chỉ dành riêng cho tài khoản Khách Hàng. Vui lòng sử dụng tài khoản khách hàng hoặc đăng ký mới!'
            });
          }
          return sendJson(res, 403, {
            success: false,
            code: 'role_mismatch',
            message: `Từ chối truy cập: Tài khoản ${user.fullName} là Khách Hàng, không có quyền Quản Trị Viên. Vui lòng quay lại trang dành cho khách hàng!`
          });
        }

        store.addActivity({
          user: user.fullName,
          role: user.role,
          action: 'Đăng nhập hệ thống',
          target: user.id,
          details: `Đăng nhập thành công với vai trò ${user.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng'}`
        });
        store.bumpRevision();
        broadcast('activities:created', {});

        const safeUser = sanitizeUser(user);
        return sendJson(res, 200, {
          success: true,
          user: safeUser,
          message: `Chào mừng ${user.fullName} (${user.role === 'admin' ? 'Quản Trị Viên' : 'Khách Hàng'}) đã đăng nhập!`,
          revision: store.db.revision
        });
      }

      const userMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
      if (userMatch && method === 'PATCH') {
        const id = userMatch[1];
        const body = await parseJsonBody(req);
        const user = store.db.users.find(u => u.id === id);
        if (!user) {
          return sendJson(res, 404, { success: false, message: 'Không tìm thấy tài khoản!' });
        }

        if (body.fullName !== undefined) {
          const cleanName = String(body.fullName).trim();
          if (cleanName.length < 2) {
            return sendJson(res, 400, { success: false, message: 'Họ và tên phải có ít nhất 2 ký tự!' });
          }
          user.fullName = cleanName;
        }

        if (body.phone !== undefined) {
          const cleanPhone = normalizePhone(body.phone);
          const phoneRegex = /^0(?:3|5|7|8|9)\d{8}$/;
          if (!phoneRegex.test(cleanPhone)) {
            return sendJson(res, 400, { success: false, message: 'Số điện thoại không đúng chuẩn Việt Nam (10 số, đầu 03, 05, 07, 08, 09)!' });
          }
          const duplicate = store.db.users.find(u => u.id !== id && u.phone && normalizePhone(u.phone) === cleanPhone);
          if (duplicate) {
            return sendJson(res, 409, { success: false, message: 'Số điện thoại này đã được liên kết với một tài khoản khác!' });
          }
          user.phone = cleanPhone;
        }

        if (body.dietary !== undefined) {
          user.dietary = String(body.dietary).trim() || 'Ăn được tất cả';
        }

        store.addActivity({
          user: user.fullName,
          role: user.role,
          action: 'Cập nhật hồ sơ & khẩu vị',
          target: user.id,
          details: `Khách hàng ${user.fullName} cập nhật khẩu vị cá nhân: ${user.dietary}`
        });

        store.bumpRevision();
        const safeUser = sanitizeUser(user);
        broadcast('users:updated', { user: safeUser });
        return sendJson(res, 200, {
          success: true,
          user: safeUser,
          message: 'Đã cập nhật hồ sơ cá nhân thành công!',
          revision: store.db.revision
        });
      }

      // --- ACTIVITIES ---
      if (pathname === '/api/activities' && method === 'GET') {
        return sendJson(res, 200, { revision: store.db.revision, activities: store.db.activities });
      }

      if (pathname === '/api/activities' && method === 'POST') {
        const body = await parseJsonBody(req);
        if (!body || !body.action) {
          return sendJson(res, 400, { success: false, message: 'Thiếu nội dung hành động!' });
        }
        const entry = store.addActivity({
          id: body.id,
          user: body.user,
          role: body.role,
          action: body.action,
          target: body.target,
          details: body.details,
          timestamp: body.timestamp
        });
        store.bumpRevision();
        broadcast('activities:created', { activity: entry });
        return sendJson(res, 201, { success: true, activity: entry, revision: store.db.revision });
      }

      if (pathname.startsWith('/api/')) {
        return sendJson(res, 404, { success: false, message: 'API endpoint not found' });
      }

      // =======================================================================
      // STATIC FILE SERVING
      // =======================================================================
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method Not Allowed');
        return;
      }

      let reqPath = (pathname === '/' ? '/index.html' : pathname).replace(/\\/g, '/');
      if (reqPath === '/admin' || reqPath === '/admin/') reqPath = '/admin-login.html';

      const reqPathLower = reqPath.toLowerCase();
      if (
        BLOCKED_STATIC_FILES.has(reqPathLower) ||
        BLOCKED_STATIC_PREFIXES.some(prefix => reqPathLower.startsWith(prefix)) ||
        reqPath.split('/').some(seg => seg.startsWith('.') && seg !== '.')
      ) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      const resolvedPath = path.resolve(rootDir, '.' + reqPath);
      if (resolvedPath !== rootDir && !resolvedPath.startsWith(rootDir + path.sep)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(resolvedPath) || fs.statSync(resolvedPath).isDirectory()) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
      }

      const ext = path.extname(resolvedPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const cacheControl = ['.html', '.js', '.css'].includes(ext) ? 'no-cache' : 'public, max-age=3600';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': cacheControl
      });

      if (method === 'HEAD') {
        res.end();
        return;
      }

      fs.createReadStream(resolvedPath).pipe(res);
    } catch (err) {
      const status = err.statusCode || 500;
      if (!res.headersSent) {
        sendJson(res, status, { success: false, message: err.message || 'Internal Server Error' });
      } else {
        res.end();
      }
    }
  });

  server.on('close', () => {
    clearInterval(heartbeatInterval);
    for (const client of sseClients) {
      try { client.end(); } catch (_) {}
    }
    sseClients.clear();
  });

  return {
    server,
    store,
    host,
    port,
    getNetworkInfo: () => {
      const activePort = (server.address() && typeof server.address() === 'object' && server.address().port) || port;
      return getNetworkInfo(activePort, networkInterfacesFn);
    }
  };
}

if (require.main === module) {
  const { server, host, port, getNetworkInfo: getInfo } = createAppServer();
  server.listen(port, host, () => {
    const info = getInfo();
    console.log('');
    console.log('===============================================================');
    console.log('  CÔ TƯ ALLEY TOUR - SERVER & REAL-TIME SYNC ĐANG CHẠY');
    console.log('===============================================================');
    console.log(`  Local (PC):       ${info.localUrl}`);
    if (info.primaryLanUrl) {
      console.log(`  Wi-Fi / LAN:      ${info.primaryLanUrl}   <-- Dùng link/QR này trên điện thoại`);
      console.log(`  Admin Portal:     ${info.adminLanUrl}`);
      console.log(`  Admin Local:      http://localhost:${info.port}/admin-login.html`);
    } else {
      console.log('  Wi-Fi / LAN:      Chưa phát hiện IP Wi-Fi/Ethernet thực!');
      console.log(`  Admin Local:      http://localhost:${info.port}/admin-login.html`);
    }
    if (info.interfaces.length > 1) {
      console.log('  Các cổng mạng thực khác:');
      info.interfaces.forEach(i => console.log(`    - ${i.name}: ${i.url}`));
    }
    if (info.filteredVirtual.length > 0) {
      console.log('  Đã bỏ qua adapter ảo (VMware/VPN/vEthernet):');
      info.filteredVirtual.forEach(v => console.log(`    - ${v.name}: ${v.address} (${v.reason})`));
    }
    console.log('---------------------------------------------------------------');
    console.log('  Lưu ý mở bằng điện thoại:');
    console.log('  1. Điện thoại và máy tính phải kết nối CÙNG MẠNG Wi-Fi.');
    console.log('  2. Nếu điện thoại không tải được trang, kiểm tra Windows Firewall');
    console.log(`     (cho phép Node.js hoặc TCP port ${info.port}, hoặc chuyển Wi-Fi sang Private).`);
    console.log('===============================================================');
    console.log('');
  });
}

module.exports = {
  createAppServer,
  getNetworkInfo,
  normalizePhone,
  sanitizeUser,
  VIRTUAL_ADAPTER_REGEX
};
