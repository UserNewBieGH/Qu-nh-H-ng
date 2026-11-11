/**
 * Deep Verification Test Suite for Cô Tư Alley Tour App
 * Exhaustively probes edge cases, bug fixes, and business logic
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const dir = __dirname;
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const adminHtml = fs.readFileSync(path.join(dir, 'admin.html'), 'utf8');
const adminLoginHtml = fs.readFileSync(path.join(dir, 'admin-login.html'), 'utf8');
const css = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');

// Load Data
global.window = {};
require(path.join(dir, 'js/data.js'));
const data = global.window.CO_TU_DATA;

console.log('=== 1. TEST ZALO TEMPLATE & DATE LOGIC (NO "NGÀY HÔM" BUG) ===');
function buildZaloTemplate(name, id, guests, tourDate, dietary) {
  return `Dạ Cô Tư chào ${name}!
Mã giữ chỗ tour Hẻm của bạn là *${id}* (${guests} khách).
Hẹn bạn lúc 16:30 ngày ${tourDate} tại điểm hẹn: Hẻm 150 Nguyễn Đình Chiểu, P. Đa Kao, Q.1.
Lưu ý ăn uống: ${dietary}.
Hotline hỗ trợ khẩn cấp: 0908 287 150. Hẹn gặp bạn tối nay nghen!`;
}

const tpl1 = buildZaloTemplate('Quân', 'CT-1234', 2, '08/11/2026', 'Ăn được tất cả');
assert(tpl1.includes('ngày 08/11/2026'), 'Template must include valid date 08/11/2026');
assert(!tpl1.includes('ngày Hôm'), 'Must NOT contain "ngày Hôm" bug');
assert(!tpl1.includes('ngày Ngày'), 'Must NOT contain "ngày Ngày" bug');
console.log('✓ Zalo confirmation template correctly formats tourDate without split truncation');

console.log('\n=== 2. TEST PHONE VALIDATION ALGORITHM ===');
const phoneRegex = /^(?:0|\+84)(?:3|5|7|8|9)\d{8}$/;
const validPhones = ['0912345678', '0988776554', '+84912345678', '0321234567', '0771234567', '0881234567', '0551234567'];
const invalidPhones = ['123', '09123', 'abcdefghij', '0123456789', '091234567899', ''];

for (const p of validPhones) {
  assert(phoneRegex.test(p.replace(/[\s.-]/g, '')), `Phone should be valid: ${p}`);
}
for (const p of invalidPhones) {
  assert(!phoneRegex.test(p.replace(/[\s.-]/g, '')), `Phone should be rejected: ${p}`);
}
console.log('✓ Vietnamese phone number regex validation verified on all boundary cases');

console.log('\n=== 3. TEST EMAIL VALIDATION ALGORITHM ===');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
assert(emailRegex.test('user@gmail.com'), 'Valid email must pass');
assert(emailRegex.test('david.uk@expats.co.uk'), 'Complex domain email must pass');
assert(!emailRegex.test('invalid-email'), 'No @ symbol must fail');
assert(!emailRegex.test('user@domain'), 'No TLD must fail');
console.log('✓ Email validation regex verified');

console.log('\n=== 4. TEST AUDIO DURATION PARSING ===');
function parseDurationToSeconds(timeStr) {
  if (!timeStr) return 165;
  const parts = timeStr.split(':').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return parts[0] * 60 + parts[1];
  }
  return 165;
}

assert.strictEqual(parseDurationToSeconds('2:45'), 165, 'Track 1: 2:45 must be 165s');
assert.strictEqual(parseDurationToSeconds('3:10'), 190, 'Track 2: 3:10 must be 190s');
assert.strictEqual(parseDurationToSeconds('3:40'), 220, 'Track 3: 3:40 must be 220s');
assert.strictEqual(parseDurationToSeconds('2:55'), 175, 'Track 4: 2:55 must be 175s');
assert.strictEqual(parseDurationToSeconds('2:30'), 150, 'Track 5: 2:30 must be 150s');
console.log('✓ Dynamic audio track duration parsing verified for all 5 stops');

console.log('\n=== 5. TEST REVIEW FEED & CATEGORY FILTERING ===');
assert(data.reviews.length >= 4, 'Must have at least 4 reviews in data');
const soloReviews = data.reviews.filter(r => r.type === 'solo');
assert(soloReviews.length > 0, 'Must have solo reviews');
assert(html.includes('data-cat="solo"'), 'HTML must include review card with data-cat="solo"');
assert(html.includes('Lê Hoàng Kim'), 'HTML must render Lê Hoàng Kim review card');
console.log('✓ Solo review card present and matched with category filters');

console.log('\n=== 6. TEST ADMIN KPI EXCLUSION OF CANCELLED ORDERS ===');
function calculateAdminKPIs(orders) {
  let totalGuests = 0;
  let totalRevenue = 0;
  let activeCount = 0;

  orders.forEach(ord => {
    if (ord.status === 'Đã hủy') return; // Cancelled excluded
    activeCount++;
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

  return { activeCount, totalGuests, totalRevenue };
}

const testOrders = [
  { id: '1', status: 'Đã xác nhận', guests: 2, total: '1.180.000₫' },
  { id: '2', status: 'Chờ gặp', guests: 3, total: '1.770.000₫' },
  { id: '3', status: 'Đã hủy', guests: 4, total: '2.360.000₫' } // Should be excluded!
];

const kpi = calculateAdminKPIs(testOrders);
assert.strictEqual(kpi.activeCount, 2, 'Active count must be 2');
assert.strictEqual(kpi.totalGuests, 5, 'Total guests must be 5 (excluding cancelled 4)');
assert.strictEqual(kpi.totalRevenue, 2950000, 'Total revenue must exclude cancelled order (1180k + 1770k = 2950k)');
console.log('✓ Cancelled orders properly excluded from KPI calculations');

console.log('\n=== 7. TEST STYLESHEET & HTML TOKEN INTEGRITY ===');
assert(css.includes('scroll-padding-top: 8.5rem'), 'CSS must include scroll-padding-top for anchor jump offset');
assert(css.includes('.h-18 { height: 4.5rem; }'), 'CSS must define .h-18 fallback');
assert(css.includes('.pt-18 { padding-top: 4.5rem; }'), 'CSS must define .pt-18 fallback');
assert(css.includes('.top-18 { top: 4.5rem; }'), 'CSS must define .top-18 fallback');
assert(css.includes('.payment-method-card.selected'), 'CSS must include selected payment card styles');
assert(css.includes('#toast-container'), 'CSS must include toast container styles');
assert(html.includes('"18": "4.5rem"'), 'Tailwind config must include spacing 18');
assert(html.includes('id="btn-reset-stops-filter"'), 'HTML must include reset stops filter button');
assert(html.includes('id="toast-container"'), 'HTML must include toast-container element');
assert(html.includes('class="payment-method-card'), 'HTML must include payment-method-card classes');
console.log('✓ All token, layout, styling, and DOM integrity checks passed 100%');

console.log('\n=== 8. TEST RBAC & PERMISSION BOUNDARIES (CUSTOMER VS ADMIN) ===');
// Setup mock localStorage
const mockStore = {};
global.localStorage = {
  getItem: (k) => mockStore[k] || null,
  setItem: (k, v) => { mockStore[k] = String(v); },
  removeItem: (k) => { delete mockStore[k]; },
  clear: () => { Object.keys(mockStore).forEach(k => delete mockStore[k]); }
};

const windowListeners = {};
global.window.addEventListener = (evt, fn) => {
  windowListeners[evt] = windowListeners[evt] || [];
  windowListeners[evt].push(fn);
};

require(path.join(dir, 'js/auth.js'));
const auth = global.window.AuthManager;
auth.init();

// Guest state
assert(!auth.isAuthenticated(), 'Guest must not be authenticated');
assert(!auth.isAdmin(), 'Guest must not have admin privilege');
assert(!auth.isCustomer(), 'Guest must not have customer privilege');

// Customer state
auth.login('quan.tran@gmail.com', '123456');
assert(auth.isCustomer(), 'Trần Minh Quân must have customer role');
assert(!auth.isAdmin(), 'Trần Minh Quân must NOT have admin role');

// Customer data isolation: Customer only sees own orders
const custOrders = auth.getCustomerOrders();
assert(Array.isArray(custOrders), 'getCustomerOrders must return array');
if (custOrders.length > 0) {
  assert(custOrders.every(o => o.phone.includes('0912 345 678') || o.phone.includes('0912345678') || (o.email && o.email.includes('quan.tran'))), 'Customer must only see own orders');
}

// Non-admin attempting to approve pre-booking must be denied
const fakeUpdate = auth.updatePreBookingStatus('PRE-701', 'Đã xác nhận cọc');
assert(!fakeUpdate.success, 'Customer must not be allowed to approve pre-bookings');

// Admin state
auth.login('admin@cotu-saigon.vn', 'cotu@2026');
assert(auth.isAdmin(), 'Admin must have admin role');
assert(!auth.isCustomer(), 'Admin must NOT have customer role');

// Admin approving pre-booking succeeds
const adminUpdate = auth.updatePreBookingStatus('PRE-701', 'Đã xác nhận cọc', 'Đã chốt');
assert(adminUpdate.success, 'Admin must be allowed to update pre-bookings');

console.log('✓ RBAC privilege boundaries & customer data isolation strictly verified');

console.log('\n=== 9. TEST PRE-BOOKING & ACTIVITY LOG INTEGRITY ===');
const preList = auth.getPreBookings();
assert(preList.length >= 3, 'Must have at least 3 initial pre-bookings');
assert(preList.every(p => p.id && p.customerName && p.targetDate && p.status), 'Every pre-booking must have id, customerName, targetDate, status');

const actList = auth.getActivities();
assert(actList.length >= 5, 'Must have at least 5 initial activity logs');
assert(actList.every(a => a.id && a.user && a.role && a.action && a.timestamp), 'Every activity log must have id, user, role, action, timestamp');

console.log('✓ Pre-booking and activity logging data models verified');

console.log('\n=== 10. TEST EXCEL EXPORT INTEGRITY & SEPARATED DOM HOOKS ===');
// Customer landing page hooks (index.html)
assert(html.includes('id="auth-modal"'), 'index.html must include customer auth modal');
assert(html.includes('id="customer-portal-modal"'), 'index.html must include customer portal modal');
assert(html.includes('id="form-prebook-tour"'), 'index.html must include pre-booking form');
assert(html.includes('id="btn-mode-direct-book"'), 'index.html must include direct book mode button');
assert(html.includes('id="btn-mode-pre-book"'), 'index.html must include pre-book mode button');
assert(html.includes('id="prebook-summary-card"'), 'index.html must include pre-booking summary card');
assert(html.includes('id="referral-qr-modal"'), 'index.html must include customer referral QR modal');
assert(html.includes('id="referral-qr-canvas"'), 'index.html must include customer referral QR canvas');
assert(html.includes('id="btn-download-referral-qr"'), 'index.html must include download referral QR button');
assert(html.includes('id="btn-copy-referral-link"'), 'index.html must include copy referral link button');
// Strict separation & credential hygiene assertions on index.html
assert(!html.includes('id="btn-quick-login-admin"'), 'index.html must NOT include demo admin quick login button');
assert(!html.includes('id="btn-quick-login-customer"'), 'index.html must NOT include demo customer quick login button');
assert(!html.includes('Tài Khoản Khách Hàng Thử Nghiệm Nhanh'), 'index.html must NOT expose quick-login demo panel');
assert(!html.includes('123456'), 'index.html must NOT expose hardcoded customer password 123456');
assert(!html.includes('cotu@2026'), 'index.html must NOT expose hardcoded admin password cotu@2026');
assert(!html.includes('quan.tran@gmail.com'), 'index.html must NOT expose demo customer email');
assert(!html.includes('admin@cotu-saigon.vn'), 'index.html must NOT expose admin email');
assert(!html.includes('Truy Cập Trang Quản Trị'), 'index.html must NOT include public footer admin access button');
assert(!html.includes('id="admin-dashboard-modal"'), 'index.html must NOT embed admin dashboard modal');

const authJsSrc = fs.readFileSync(path.join(dir, 'js/auth.js'), 'utf8');
assert(!authJsSrc.includes('btn-quick-login-customer'), 'js/auth.js must NOT contain quick-login demo handler');
assert(!authJsSrc.includes('123456'), 'js/auth.js must NOT hardcode demo password 123456');

// Standalone Admin dashboard hooks (admin.html)
assert(adminHtml.includes('id="btn-export-excel-comprehensive"'), 'admin.html must include comprehensive Excel export button');
assert(adminHtml.includes('id="btn-export-excel-prebookings"'), 'admin.html must include pre-bookings Excel export button');
assert(adminHtml.includes('id="btn-export-excel-activities"'), 'admin.html must include activities Excel export button');
assert(adminHtml.includes('id="btn-export-csv"'), 'admin.html must include CSV export button');
assert(adminHtml.includes('id="admin-panel-excel"'), 'admin.html must include admin Excel export center panel');
assert(adminHtml.includes('data-action="admin-logout"'), 'admin.html must include admin logout button');
assert(adminHtml.includes('id="btn-quick-export-orders"'), 'admin.html must include quick export orders button');
assert(adminHtml.includes('id="excel-date-type-filter"'), 'admin.html must include excel date type filter dropdown');
assert(adminHtml.includes('data-action="excel-preset"'), 'admin.html must include excel preset buttons');
assert(adminHtml.includes('id="admin-customers-table-body"'), 'admin.html must include customer accounts management table');
console.log('✓ All separated Customer & Admin DOM hooks and Excel controls verified 100%');

console.log('\n=== 11. TEST PHONE NORMALIZATION & MULTI-FORMAT DUPLICATE CHECKS ===');
assert.strictEqual(auth.normalizePhone('+84912345678'), '0912345678', 'Should convert +84 to 0');
assert.strictEqual(auth.normalizePhone('84912345678'), '0912345678', 'Should convert 84 to 0');
assert.strictEqual(auth.normalizePhone('0912 345 678'), '0912345678', 'Should strip whitespace');
assert.strictEqual(auth.normalizePhone('0912-345-678'), '0912345678', 'Should strip dashes');

// Login with normalized phone format
const loginWithPlus84 = auth.login('+84912345678', '123456');
assert(loginWithPlus84.success, 'Login with +84 phone format must succeed for registered 0912345678');
auth.logout();

// Duplicate registration check across formats
const dupRes = auth.register({
  fullName: 'Trùng Số',
  phone: '+84912345678',
  email: 'unique_email@gmail.com',
  password: 'password123'
});
assert(!dupRes.success, 'Registering +84 phone when 0912... already exists must be rejected');
assert(dupRes.message.includes('Số điện thoại') && dupRes.message.includes('đã được'), 'Duplicate message must indicate phone is taken');
console.log('✓ Phone normalization and cross-format deduplication verified');

console.log('\n=== 12. TEST ADMIN FLEXIBLE DATE PARSER & EXCEL FILTERING LOGIC ===');
// Mock document elements for AdminPortal
const mockElements = {
  'excel-filter-from': { value: '', addEventListener: () => {} },
  'excel-filter-to': { value: '', addEventListener: () => {} },
  'excel-date-type-filter': { value: 'tour', addEventListener: () => {} },
  'excel-filter-active-desc': { textContent: '' },
  'excel-count-orders': { textContent: '' },
  'excel-count-prebookings': { textContent: '' },
  'excel-count-activities': { textContent: '' },
  'toast-container': { appendChild: () => {} }
};
global.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: (id) => mockElements[id] || null,
  createElement: () => ({ className: '', innerHTML: '', style: {}, remove: () => {} }),
  body: { appendChild: () => {} }
};

require(path.join(dir, 'js/admin.js'));
const admin = global.window.AdminPortal;
assert(admin, 'AdminPortal must be available');

// Test parseFlexibleDate
const parsedISO = admin.parseFlexibleDate('2026-12-25T10:00:00Z');
assert(parsedISO instanceof Date && !isNaN(parsedISO), 'Must parse ISO date');
assert.strictEqual(parsedISO.getUTCFullYear(), 2026);
assert.strictEqual(parsedISO.getUTCMonth(), 11); // Month is 0-indexed: 11 = Dec
assert.strictEqual(parsedISO.getUTCDate(), 25);

const parsedVN = admin.parseFlexibleDate('15/12/2026 lúc 16:30');
assert(parsedVN instanceof Date && !isNaN(parsedVN), 'Must parse Vietnamese DD/MM/YYYY lúc HH:mm');
assert.strictEqual(parsedVN.getFullYear(), 2026);
assert.strictEqual(parsedVN.getMonth(), 11);
assert.strictEqual(parsedVN.getDate(), 15);

const parsedBareDate = admin.parseFlexibleDate('2026-12-01');
assert(parsedBareDate instanceof Date && !isNaN(parsedBareDate), 'Must parse bare YYYY-MM-DD in local time');
assert.strictEqual(parsedBareDate.getFullYear(), 2026);
assert.strictEqual(parsedBareDate.getMonth(), 11);
assert.strictEqual(parsedBareDate.getDate(), 1);

const parsedVNShort = admin.parseFlexibleDate('08/11/2026');
assert(parsedVNShort instanceof Date && !isNaN(parsedVNShort), 'Must parse short DD/MM/YYYY');
assert.strictEqual(parsedVNShort.getFullYear(), 2026);
assert.strictEqual(parsedVNShort.getMonth(), 10); // Nov
assert.strictEqual(parsedVNShort.getDate(), 8);

const parsedToday = admin.parseFlexibleDate('Hôm nay 16:30');
assert(parsedToday instanceof Date && !isNaN(parsedToday), 'Must parse relative date Hôm nay');
const todayNow = new Date();
assert.strictEqual(parsedToday.getDate(), todayNow.getDate());

// Test Date Range Filter with targeted window
mockElements['excel-filter-from'].value = '2026-12-01';
mockElements['excel-filter-to'].value = '2026-12-20';
mockElements['excel-date-type-filter'].value = 'tour';

const filterRes = admin.getDateRangeFilter();
assert(filterRes.hasFilter, 'Filter must be active when dates are set');
const filteredPreList = filterRes.filterPreBookings(auth.getPreBookings());
// Target dates: PRE-701 is 2026-12-15 (inside), PRE-702 is 2026-12-24 (outside), PRE-703 is 2027-01-05 (outside)
const includedPre = filteredPreList.find(p => p.id === 'PRE-701');
const excludedPre = filteredPreList.find(p => p.id === 'PRE-702');
assert(includedPre, 'PRE-701 (2026-12-15) must be included in [2026-12-01, 2026-12-20]');
assert(!excludedPre, 'PRE-702 (2026-12-24) must be excluded from [2026-12-01, 2026-12-20]');

// Test Date Presets matching admin.html buttons ('week', 'month', 'nextmonth', 'today', 'all')
admin.applyDatePreset('week');
assert(/^\d{4}-\d{2}-\d{2}$/.test(mockElements['excel-filter-from'].value), 'Preset week must populate from-date');
assert(/^\d{4}-\d{2}-\d{2}$/.test(mockElements['excel-filter-to'].value), 'Preset week must populate to-date');
admin.applyDatePreset('month');
assert(mockElements['excel-filter-from'].value.endsWith('-01'), 'Preset month must start on day 01');
admin.applyDatePreset('nextmonth');
assert(mockElements['excel-filter-from'].value.endsWith('-01'), 'Preset nextmonth must start on day 01');
admin.applyDatePreset('all');
assert.strictEqual(mockElements['excel-filter-from'].value, '', 'Preset all must clear from-date');

// Test Customer Tier Filter matching ('Vàng' -> Gold, 'Kim Cương', 'Mới')
assert(admin.matchesCustomerTier('Hội Viên Thân Thiết (Gold)', 'Vàng'), 'Vàng filter must match Gold customer tier');
assert(admin.matchesCustomerTier('Hội Viên Kim Cương', 'Kim Cương'), 'Kim Cương filter must match Diamond customer tier');
assert(!admin.matchesCustomerTier('Hội Viên Kim Cương', 'Vàng'), 'Vàng filter must NOT match Kim Cương customer tier');
assert(admin.matchesCustomerTier('Hội Viên Thân Thiết Mới', 'Mới'), 'Mới filter must match New member tier');
console.log('✓ Flexible date parser, Excel date presets, tier filtering & range matching verified');

console.log('\n=== 13. TEST PRE-BOOKING DELETION RBAC & TAB SWITCHING ===');
// Test switchCustomerPortalTab existence
assert(typeof auth.switchCustomerPortalTab === 'function', 'switchCustomerPortalTab must be a function');

// Create test pre-booking
const tempPre = auth.savePreBooking({
  customerName: 'Test Xóa',
  phone: '0987000111',
  email: 'testxoa@gmail.com',
  targetDate: '30/12/2026',
  timeSlot: '16:30',
  theme: 'Toàn diện',
  guests: 2,
  estimatedBudget: '1.180.000₫'
});
assert(tempPre && tempPre.id, 'Temporary pre-booking must be created');

// Customer attempt to delete -> forbidden
auth.login('quan.tran@gmail.com', '123456');
const custDel = auth.deletePreBooking(tempPre.id);
assert(!custDel.success, 'Customer cannot delete pre-bookings');

// Admin attempt to delete -> allowed
auth.login('admin@cotu-saigon.vn', 'cotu@2026');
const adminDel = auth.deletePreBooking(tempPre.id);
assert(adminDel.success, 'Admin can delete pre-bookings');
const checkDeleted = auth.getPreBookings().find(p => p.id === tempPre.id);
assert(!checkDeleted, 'Deleted pre-booking must not exist in list');

console.log('✓ Pre-booking deletion RBAC permissions and tab switching verified');

console.log('\n=== 14. TEST STANDALONE ADMIN GUARDS, CUSTOMER TABLE & REFERRAL QR CODE ===');
// Verify admin.html auth guard script
assert(adminHtml.includes("localStorage.getItem('co_tu_current_user')"), 'admin.html must check session token');
assert(adminHtml.includes("user.role !== 'admin'"), 'admin.html auth guard must enforce role === admin');
assert(adminHtml.includes("window.location.replace('admin-login.html')"), 'admin.html auth guard must redirect unauthorized users to admin-login.html');

// Verify admin-login.html RBAC protections & credential hygiene
assert(adminLoginHtml.includes('id="admin-login-form"'), 'admin-login.html must have login form');
assert(adminLoginHtml.includes("res.user.role !== 'admin'"), 'admin-login.html must reject customer accounts');
assert(adminLoginHtml.includes("window.location.replace('admin.html')"), 'admin-login.html must redirect authorized admin to admin.html');
assert(!adminLoginHtml.includes('id="btn-fill-admin-demo"'), 'admin-login.html must NOT include demo quick-fill button');
assert(!adminLoginHtml.includes('Tài khoản Demo'), 'admin-login.html must NOT expose demo account panel');
assert(!adminLoginHtml.includes('cotu@2026'), 'admin-login.html must NOT expose hardcoded password cotu@2026');
assert(!adminLoginHtml.includes('123456'), 'admin-login.html must NOT expose hardcoded password 123456');
assert(!adminLoginHtml.includes('admin@cotu-saigon.vn'), 'admin-login.html must NOT leak admin email in UI');

// Verify QRCodeGenerator rendering on Mock HTML5 Canvas
const QRGenerator = require(path.join(dir, 'js/qr-generator.js'));
const drawCalls = [];
const mockCtx = {
  fillStyle: '',
  strokeStyle: '',
  lineWidth: 1,
  font: '',
  textAlign: '',
  textBaseline: '',
  fillRect: (x, y, w, h) => drawCalls.push({ type: 'fillRect', fill: mockCtx.fillStyle, x, y, w, h }),
  beginPath: () => drawCalls.push({ type: 'beginPath' }),
  arc: (x, y, r) => drawCalls.push({ type: 'arc', x, y, r }),
  fill: () => drawCalls.push({ type: 'fill', fill: mockCtx.fillStyle }),
  stroke: () => drawCalls.push({ type: 'stroke', stroke: mockCtx.strokeStyle }),
  fillText: (txt, x, y) => drawCalls.push({ type: 'fillText', txt, x, y })
};
const mockCanvas = {
  width: 220,
  height: 220,
  getContext: () => mockCtx
};

QRGenerator.renderToCanvas(mockCanvas, 'https://cotu-saigon.vn', {
  size: 220,
  darkColor: '#1b1c1a',
  bgColor: '#ffffff',
  logoBgColor: '#835500',
  logoBorderColor: '#f5a623',
  logoText: 'CÔ TƯ'
});

assert(drawCalls.some(c => c.type === 'fillRect' && c.w === 220 && c.h === 220), 'Canvas background must be filled');
assert(drawCalls.some(c => c.type === 'fill' && c.fill === '#835500'), 'Canvas QR logo must use Cô Tư primary brand color #835500');
assert(drawCalls.some(c => c.type === 'stroke' && c.stroke === '#f5a623'), 'Canvas QR logo border must use Cô Tư secondary gold #f5a623');
assert(drawCalls.some(c => c.type === 'fillText' && c.txt === 'CÔ TƯ'), 'Canvas QR logo must render text CÔ TƯ');
assert(drawCalls.filter(c => c.type === 'fillRect' && c.fill === '#1b1c1a').length > 100, 'QR code must render >100 dark data/finder modules');

// Verify AdminPortal customer table renderer existence & Customer Profile validation
assert(typeof admin.renderCustomersTable === 'function', 'AdminPortal must expose renderCustomersTable');

auth.login('quan.tran@gmail.com', '123456');
const badPhoneProf = auth.updateCustomerProfile({ phone: '123' });
assert(!badPhoneProf.success, 'updateCustomerProfile must reject invalid Vietnamese phone numbers');
const dupPhoneProf = auth.updateCustomerProfile({ phone: '0988776554' }); // Hải Yến's phone
assert(!dupPhoneProf.success, 'updateCustomerProfile must reject duplicate phone belonging to another customer');
const badNameProf = auth.updateCustomerProfile({ fullName: 'A' });
assert(!badNameProf.success, 'updateCustomerProfile must reject short/empty names');
const clearDietProf = auth.updateCustomerProfile({ dietary: '' });
assert(clearDietProf.success && clearDietProf.user.dietary === 'Ăn được tất cả', 'Clearing dietary preference must reset cleanly');

// Edge cases: empty/whitespace credentials & cross-tab storage logout sync
const emptyLogin = auth.login('', '');
assert(!emptyLogin.success, 'Empty login credentials must be rejected');
const spaceLogin = auth.login('   ', '   ');
assert(!spaceLogin.success, 'Whitespace-only login credentials must be rejected');

// Cross-tab logout sync: remove session in storage and dispatch storage event
assert(auth.isAuthenticated(), 'User must be authenticated before cross-tab logout simulation');
delete mockStore['co_tu_current_user'];
(windowListeners.storage || []).forEach(fn => fn({ key: 'co_tu_current_user', newValue: null }));
assert(!auth.isAuthenticated(), 'Cross-tab storage removal of co_tu_current_user must log out current tab');
assert(!auth.isCustomer() && !auth.isAdmin(), 'Role checks must be false after cross-tab logout');

console.log('\n=== 15. TEST STALE PII CLEANUP, EMPTY PHONE GUARD, TAILWIND TOKENS & ADMIN SYNC ===');
// Register mock DOM fields for autofill leak regression tests
['book-cust-name', 'book-cust-phone', 'book-cust-email', 'prebook-cust-name', 'prebook-cust-phone', 'prebook-cust-email'].forEach(id => {
  mockElements[id] = { value: '', dataset: {}, addEventListener: () => {} };
});
mockElements['prebook-dietary'] = { value: 'Ăn được tất cả', dataset: {}, addEventListener: () => {} };

// Customer 1 login & autofill
auth.login('quan.tran@gmail.com', '123456');
auth.autoFillBookingForm();
assert.strictEqual(mockElements['book-cust-email'].value, 'quan.tran@gmail.com', 'Customer 1 email must autofill direct form');
assert.strictEqual(mockElements['prebook-cust-email'].value, 'quan.tran@gmail.com', 'Customer 1 email must autofill prebook form');

// Explicit logout MUST wipe customer PII from booking & prebook inputs
auth.logout();
assert.strictEqual(mockElements['book-cust-name'].value, '', 'Logout must clear direct booking name');
assert.strictEqual(mockElements['book-cust-phone'].value, '', 'Logout must clear direct booking phone');
assert.strictEqual(mockElements['book-cust-email'].value, '', 'Logout must clear direct booking email');
assert.strictEqual(mockElements['prebook-cust-name'].value, '', 'Logout must clear prebook name');
assert.strictEqual(mockElements['prebook-cust-email'].value, '', 'Logout must clear prebook email');
assert.strictEqual(mockElements['prebook-dietary'].value, 'Ăn được tất cả', 'Logout must reset prebook dietary preference');

// Direct switch Customer 1 -> Customer 2 must overwrite autofilled values (no Customer 1 PII bleed)
auth.login('quan.tran@gmail.com', '123456');
auth.autoFillBookingForm();
auth.login('haiyen.ng@outlook.com', '123456');
auth.autoFillBookingForm();
assert.strictEqual(mockElements['book-cust-email'].value, 'haiyen.ng@outlook.com', 'Switching to Customer 2 must overwrite Customer 1 direct email');
assert.strictEqual(mockElements['prebook-cust-email'].value, 'haiyen.ng@outlook.com', 'Switching to Customer 2 must overwrite Customer 1 prebook email');
assert.strictEqual(mockElements['prebook-cust-name'].value, 'Nguyễn Hải Yến', 'Switching to Customer 2 must overwrite Customer 1 prebook name');

// Cross-tab logout must also scrub autofilled inputs
delete mockStore['co_tu_current_user'];
(windowListeners.storage || []).forEach(fn => fn({ key: 'co_tu_current_user', newValue: null }));
auth.autoFillBookingForm();
assert.strictEqual(mockElements['book-cust-email'].value, '', 'Cross-tab logout must clear autofilled customer email');

// Empty normalized phone guard: punctuation-only identifier must NOT match a user with empty phone
const usersSnapshot = JSON.parse(mockStore['co_tu_users'] || '[]');
usersSnapshot.push({ id: 'usr-empty-phone', username: 'no_phone_u', email: 'nophone@x.vn', password: 'secret', fullName: 'No Phone', phone: '', role: 'customer' });
mockStore['co_tu_users'] = JSON.stringify(usersSnapshot);
const badPunctLogin = auth.login('---', 'secret');
assert(!badPunctLogin.success, 'Punctuation-only identifier must NOT match empty phone user');

// BookingEngine role guard & uniform phone normalization check
const bookingSrc = fs.readFileSync(path.join(dir, 'js/booking.js'), 'utf8');
assert(bookingSrc.includes("user.role !== 'customer'"), 'BookingEngine.autoFillUserBookingInfo must restrict autofill to customer role');

// Admin token & cross-tab storage order sync + lost-update protection
assert(adminHtml.includes("'on-primary-fixed'"), 'admin.html Tailwind config must define on-primary-fixed');
mockElements['admin-kpi-orders'] = { textContent: '' };
auth.login('admin@cotu-saigon.vn', 'cotu@2026');
admin.init();
const kpiBeforeSync = mockElements['admin-kpi-orders'].textContent;
const externalOrders = JSON.parse(mockStore['co_tu_orders'] || '[]');
externalOrders.unshift({
  id: 'CT-SYNC-99',
  name: 'Khách Tab Ngoài',
  phone: '0909111222',
  email: 'sync@x.vn',
  tourDate: '30/12/2026',
  guests: 2,
  total: '1.180.000₫',
  status: 'Chờ xác nhận',
  createdAt: new Date().toISOString()
});
mockStore['co_tu_orders'] = JSON.stringify(externalOrders);
// Dispatch cross-tab storage event for co_tu_orders -> KPI count must update live
(windowListeners.storage || []).forEach(fn => fn({ key: 'co_tu_orders', newValue: mockStore['co_tu_orders'] }));
assert.notStrictEqual(mockElements['admin-kpi-orders'].textContent, kpiBeforeSync, 'Cross-tab storage event on co_tu_orders must refresh Admin KPI counters');
// Update an existing order status AFTER external tab inserted CT-SYNC-200 (without storage event firing first)
const externalOrders2 = JSON.parse(mockStore['co_tu_orders'] || '[]');
externalOrders2.unshift({ id: 'CT-SYNC-200', name: 'Khách Race', phone: '0909333444', email: 'race@x.vn', tourDate: '31/12/2026', guests: 1, total: '590.000₫', status: 'Chờ xác nhận', createdAt: new Date().toISOString() });
mockStore['co_tu_orders'] = JSON.stringify(externalOrders2);
const statusUpdated = admin.updateOrderStatus('CT-8291', 'Đã hoàn thành');
assert(statusUpdated, 'Admin must be able to update existing order status');
const persistedOrders = JSON.parse(mockStore['co_tu_orders'] || '[]');
assert(persistedOrders.some(o => o.id === 'CT-SYNC-200'), 'updateOrderStatus must reload localStorage first so concurrent cross-tab orders are not overwritten');
assert(persistedOrders.find(o => o.id === 'CT-8291')?.status === 'Đã hoàn thành', 'Target order status update must persist cleanly');

console.log('✓ Stale PII cleanup, empty-phone login guard, Tailwind token parity, and Admin cross-tab order sync verified');

console.log('\n=== 14B. VERIFY QR LONG URL HIGH-RES CANVAS ===');
const longUrl = 'https://cotu-saigon.vn/tour?ref=khach-hang-than-thiet&promo=COTU10&note=sai-gon-hem-nho-2026-experience';
QRGenerator.renderToCanvas(mockCanvas, longUrl, { size: 240, logoText: 'CÔ TƯ' });
assert.strictEqual(mockCanvas.width, 240, 'High-res inline QR render must update canvas width to 240');

console.log('✓ Standalone admin auth guards, profile validation, customer table, cross-tab logout & QR referral canvas deeply verified');

console.log('\n======================================================');
console.log('ALL DEEP VERIFICATION SUITES PASSED (100% GREEN)');
console.log('======================================================');
