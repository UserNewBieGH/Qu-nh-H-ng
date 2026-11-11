/**
 * Real-Time Backend & LAN Network Detection Integration Tests
 * Verifies server.js virtual-adapter filtering, security guards, REST CRUD,
 * SSE real-time push notifications, and persistent disk storage across restarts.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { createAppServer, getNetworkInfo } = require('./server');

async function requestJson(baseUrl, method, urlPath, body = undefined) {
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { status: res.status, ok: res.ok, text, json, headers: res.headers };
}

function listenServer(app) {
  return new Promise((resolve, reject) => {
    app.server.listen(0, '127.0.0.1', () => {
      const addr = app.server.address();
      resolve(addr.port);
    });
    app.server.on('error', reject);
  });
}

function closeServer(app) {
  return new Promise((resolve) => {
    try {
      if (typeof app.server.closeAllConnections === 'function') {
        app.server.closeAllConnections();
      }
      app.server.close(() => resolve());
    } catch (_) {
      resolve();
    }
  });
}

async function runTests() {
  console.log('=== 1. TEST LAN IP DETECTION & VIRTUAL ADAPTER FILTERING ===');
  const mockIfaces = () => ({
    'VMware Network Adapter VMnet1': [
      { address: '192.168.133.1', family: 'IPv4', internal: false }
    ],
    'VMware Network Adapter VMnet8': [
      { address: '192.168.255.1', family: 'IPv4', internal: false }
    ],
    'vEthernet (WSL)': [
      { address: '172.24.0.1', family: 'IPv4', internal: false }
    ],
    'VirtualBox Host-Only Network': [
      { address: '192.168.56.1', family: 'IPv4', internal: false }
    ],
    'Bluetooth Network Connection': [
      { address: '169.254.10.2', family: 'IPv4', internal: false }
    ],
    'Wi-Fi': [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '192.168.1.168', family: 'IPv4', internal: false }
    ],
    'Loopback Pseudo-Interface 1': [
      { address: '127.0.0.1', family: 'IPv4', internal: true }
    ]
  });

  const netInfo = getNetworkInfo(3000, mockIfaces);
  assert.strictEqual(netInfo.primaryLanIp, '192.168.1.168', 'Must prefer real Wi-Fi LAN IP over VMware/WSL/VirtualBox adapters');
  assert.strictEqual(netInfo.primaryLanUrl, 'http://192.168.1.168:3000/', 'Primary LAN URL must include exact port');
  assert.strictEqual(netInfo.adminLanUrl, 'http://192.168.1.168:3000/admin-login.html');
  assert.strictEqual(netInfo.interfaces.length, 1, 'Only non-virtual external IPv4 interfaces should be exposed');
  assert(netInfo.filteredVirtual.some(v => v.address === '192.168.255.1'), 'VMnet8 must appear in filteredVirtual');
  assert(netInfo.filteredVirtual.some(v => v.address === '192.168.133.1'), 'VMnet1 must appear in filteredVirtual');

  const ethFallback = getNetworkInfo(3000, () => ({
    'VMware Network Adapter VMnet8': [{ address: '192.168.255.1', family: 'IPv4', internal: false }],
    'Ethernet': [{ address: '10.0.0.45', family: 'IPv4', internal: false }]
  }));
  assert.strictEqual(ethFallback.primaryLanIp, '10.0.0.45', 'Should fall back to Ethernet when Wi-Fi is unavailable');

  const noLan = getNetworkInfo(3000, () => ({
    'VMware Network Adapter VMnet8': [{ address: '192.168.255.1', family: 'IPv4', internal: false }]
  }));
  assert.strictEqual(noLan.primaryLanIp, null, 'Should return null if only virtual adapters exist');
  console.log('✓ Virtual adapters (VMnet1/VMnet8/WSL/VirtualBox/link-local) filtered; real Wi-Fi/Ethernet selected cleanly');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cotu-sync-test-'));
  const dbPath = path.join(tmpDir, 'db.json');

  let app1 = null;
  let app2 = null;
  let sseReq = null;

  try {
    console.log('\n=== 2. TEST STATIC SECURITY GUARDS & AUTO-SEED ===');
    app1 = createAppServer({ rootDir: __dirname, dbPath, host: '127.0.0.1', port: 0 });
    const port1 = await listenServer(app1);
    const baseUrl1 = `http://127.0.0.1:${port1}`;

    const indexRes = await fetch(`${baseUrl1}/`);
    assert.strictEqual(indexRes.status, 200, 'Root / must serve index.html');
    const adminHtmlRes = await fetch(`${baseUrl1}/admin.html`);
    assert.strictEqual(adminHtmlRes.status, 200, '/admin.html must serve 200');
    const networkApi = await requestJson(baseUrl1, 'GET', '/api/network-info');
    assert.strictEqual(networkApi.status, 200);
    assert.strictEqual(networkApi.json.port, port1);

    // Security blocks against reading db.json or backend source
    for (const blockedPath of ['/server.js', '/Server.js', '/%5Cserver.js', '//server.js', '/package.json', '/data/db.json', '/DATA/db.json', '/..%2fpackage.json']) {
      const r = await fetch(`${baseUrl1}${blockedPath}`);
      assert(r.status === 403 || r.status === 404, `Blocked path ${blockedPath} must not serve 200 (got ${r.status})`);
    }
    const backslashCheck = await new Promise((resolve, reject) => {
      const r = http.request({ host: '127.0.0.1', port: port1, path: '/\\server.js', method: 'GET', agent: false }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      r.on('error', reject);
      r.end();
    });
    assert(backslashCheck === 403 || backslashCheck === 404, `Backslash path /\\server.js must be blocked (got ${backslashCheck})`);

    const state1 = await requestJson(baseUrl1, 'GET', '/api/state');
    assert.strictEqual(state1.status, 200);
    assert(Array.isArray(state1.json.orders) && state1.json.orders.length > 0, 'Initial orders must be auto-seeded');
    assert(Array.isArray(state1.json.prebookings) && state1.json.prebookings.length > 0, 'Initial prebookings must be auto-seeded');
    assert(Array.isArray(state1.json.users) && state1.json.users.length > 0, 'Initial users must be auto-seeded');
    assert(state1.json.users.every(u => u.password === undefined), 'GET /api/state MUST sanitize user passwords');
    console.log('✓ Static serving, case/backslash path blocking, and password-sanitized seed verified');

    console.log('\n=== 3. TEST SSE REAL-TIME STREAM + ORDERS / PRE-BOOKINGS / USERS CRUD ===');
    const receivedEvents = [];
    await new Promise((resolve, reject) => {
      let buffer = '';
      sseReq = http.get(`${baseUrl1}/api/events`, (res) => {
        assert.strictEqual(res.statusCode, 200);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buffer += chunk;
          const frames = buffer.split('\n\n');
          buffer = frames.pop();
          for (const frame of frames) {
            const lines = frame.split('\n');
            const dataLine = lines.find(l => l.startsWith('data:'));
            if (dataLine) {
              try {
                const payload = JSON.parse(dataLine.slice(5).trim());
                receivedEvents.push(payload);
                if (payload.type === 'connected') resolve();
              } catch (_) {}
            }
          }
        });
      });
      sseReq.on('error', reject);
    });
    assert(receivedEvents.some(e => e.type === 'connected'), 'SSE stream must emit connected handshake');

    // Validation & create order
    const badOrder = await requestJson(baseUrl1, 'POST', '/api/orders', { name: 'Missing Phone' });
    assert.strictEqual(badOrder.status, 400);

    const newOrderRes = await requestJson(baseUrl1, 'POST', '/api/orders', {
      name: 'Khách Kiểm Thử LAN',
      phone: '+84 919 888 777',
      tourDate: '25/12/2026',
      guests: 3,
      total: '1.770.000₫',
      payment: 'VIETQR'
    });
    assert.strictEqual(newOrderRes.status, 201);
    const createdOrderId = newOrderRes.json.order.id;
    assert.strictEqual(newOrderRes.json.order.phone, '0919888777', 'Server must normalize +84 phone format');

    // Update order status
    const patchOrderRes = await requestJson(baseUrl1, 'PATCH', `/api/orders/${createdOrderId}`, { status: 'Đã hoàn thành' });
    assert.strictEqual(patchOrderRes.status, 200);
    assert.strictEqual(patchOrderRes.json.order.status, 'Đã hoàn thành');

    const missingPatch = await requestJson(baseUrl1, 'PATCH', '/api/orders/CT-NOTFOUND', { status: 'Đã hủy' });
    assert.strictEqual(missingPatch.status, 404);

    // Nested slash path must 404 instead of matching ID
    const nestedPatch = await requestJson(baseUrl1, 'PATCH', `/api/orders/${createdOrderId}/extra`, { status: 'Đã hủy' });
    assert.strictEqual(nestedPatch.status, 404);

    // Colliding ID from a different customer must NOT overwrite existing order!
    const collisionRes = await requestJson(baseUrl1, 'POST', '/api/orders', {
      id: createdOrderId,
      name: 'Khách Trùng Mã',
      phone: '0977665544',
      tourDate: '29/12/2026',
      guests: 1
    });
    assert.strictEqual(collisionRes.status, 201);
    assert.notStrictEqual(collisionRes.json.order.id, createdOrderId, 'Colliding order ID from different customer must receive a fresh unique ID');
    const checkOrigOrder = await requestJson(baseUrl1, 'GET', '/api/orders');
    assert.strictEqual(checkOrigOrder.json.orders.find(o => o.id === createdOrderId)?.name, 'Khách Kiểm Thử LAN', 'Original order must NOT be overwritten');

    // Create & update pre-booking
    const newPreRes = await requestJson(baseUrl1, 'POST', '/api/prebookings', {
      customerName: 'Đoàn Công Ty ABC',
      phone: '0918777666',
      targetDate: '28/12/2026',
      guests: 10
    });
    assert.strictEqual(newPreRes.status, 201);
    const createdPreId = newPreRes.json.preBooking.id;

    const patchPreRes = await requestJson(baseUrl1, 'PATCH', `/api/prebookings/${createdPreId}`, {
      status: 'Đã xác nhận cọc',
      adminNotes: 'Đã cọc 50% qua VietQR'
    });
    assert.strictEqual(patchPreRes.status, 200);
    assert.strictEqual(patchPreRes.json.preBooking.status, 'Đã xác nhận cọc');
    assert.strictEqual(patchPreRes.json.preBooking.adminNotes, 'Đã cọc 50% qua VietQR');

    // Register, duplicate phone block, RBAC login, and profile update
    const regUserRes = await requestJson(baseUrl1, 'POST', '/api/users/register', {
      fullName: 'Phạm Thùy Linh',
      phone: '0933445566',
      email: 'linh.pham@example.com',
      password: 'secretpassword',
      dietary: 'Ít cay'
    });
    assert.strictEqual(regUserRes.status, 201);
    assert.strictEqual(regUserRes.json.user.password, undefined);
    const regUserId = regUserRes.json.user.id;

    const dupPhoneRes = await requestJson(baseUrl1, 'POST', '/api/users/register', {
      fullName: 'Trùng Số',
      phone: '+84 933 445 566',
      email: 'linh2@example.com',
      password: 'secretpassword'
    });
    assert.strictEqual(dupPhoneRes.status, 409);

    const custAsAdminLogin = await requestJson(baseUrl1, 'POST', '/api/users/login', {
      identifier: 'linh.pham@example.com',
      password: 'secretpassword',
      requiredRole: 'admin'
    });
    assert.strictEqual(custAsAdminLogin.status, 403);
    assert.strictEqual(custAsAdminLogin.json.code, 'role_mismatch');

    const validCustLogin = await requestJson(baseUrl1, 'POST', '/api/users/login', {
      identifier: '+84 933 445 566',
      password: 'secretpassword',
      requiredRole: 'customer'
    });
    assert.strictEqual(validCustLogin.status, 200);
    assert.strictEqual(validCustLogin.json.user.password, undefined);

    const patchProfileRes = await requestJson(baseUrl1, 'PATCH', `/api/users/${regUserId}`, {
      dietary: 'Không ăn hải sản'
    });
    assert.strictEqual(patchProfileRes.status, 200);
    assert.strictEqual(patchProfileRes.json.user.dietary, 'Không ăn hải sản');

    // Allow SSE events to flush
    await new Promise(r => setTimeout(r, 120));
    const eventTypes = receivedEvents.map(e => e.type);
    for (const expected of ['orders:created', 'orders:updated', 'prebookings:created', 'prebookings:updated', 'users:created', 'users:updated']) {
      assert(eventTypes.includes(expected), `SSE stream missing real-time event: ${expected}`);
    }
    console.log('✓ REST API CRUD, RBAC checks, phone normalization, and real-time SSE broadcasts verified');

    console.log('\n=== 4. TEST PERSISTENCE ACROSS SERVER RESTART & DELETE ENDPOINTS ===');
    if (sseReq) sseReq.destroy();
    await closeServer(app1);
    app1 = null;

    // Start fresh server pointing to same db.json
    app2 = createAppServer({ rootDir: __dirname, dbPath, host: '127.0.0.1', port: 0 });
    const port2 = await listenServer(app2);
    const baseUrl2 = `http://127.0.0.1:${port2}`;

    const state2 = await requestJson(baseUrl2, 'GET', '/api/state');
    assert.strictEqual(state2.status, 200);
    const persistedOrder = state2.json.orders.find(o => o.id === createdOrderId);
    assert(persistedOrder && persistedOrder.status === 'Đã hoàn thành', 'Updated order must survive server restart');
    const persistedPre = state2.json.prebookings.find(p => p.id === createdPreId);
    assert(persistedPre && persistedPre.status === 'Đã xác nhận cọc' && persistedPre.adminNotes === 'Đã cọc 50% qua VietQR', 'Updated pre-booking must survive server restart');
    const persistedUser = state2.json.users.find(u => u.id === regUserId);
    assert(persistedUser && persistedUser.dietary === 'Không ăn hải sản', 'Updated user profile must survive server restart');

    // Delete endpoints
    const delOrderRes = await requestJson(baseUrl2, 'DELETE', `/api/orders/${createdOrderId}`);
    assert.strictEqual(delOrderRes.status, 200);
    const delPreRes = await requestJson(baseUrl2, 'DELETE', `/api/prebookings/${createdPreId}`);
    assert.strictEqual(delPreRes.status, 200);

    const stateAfterDel = await requestJson(baseUrl2, 'GET', '/api/state');
    assert(!stateAfterDel.json.orders.some(o => o.id === createdOrderId), 'Deleted order must stay deleted');
    assert(!stateAfterDel.json.prebookings.some(p => p.id === createdPreId), 'Deleted pre-booking must stay deleted');
    console.log('✓ Disk persistence across server restart and DELETE APIs verified');

    console.log('\n========================================');
    console.log('ALL SERVER SYNC & NETWORK TESTS PASSED (100% GREEN)');
    console.log('========================================');
  } finally {
    if (sseReq) try { sseReq.destroy(); } catch (_) {}
    if (app1) await closeServer(app1);
    if (app2) await closeServer(app2);
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runTests().catch((err) => {
  console.error('❌ SERVER SYNC TEST FAILED:', err);
  process.exitCode = 1;
});
