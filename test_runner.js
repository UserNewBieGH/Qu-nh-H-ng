const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const dir = __dirname;
const jsFiles = [
  'js/data.js',
  'js/auth.js',
  'js/booking.js',
  'js/ai-cotu.js',
  'js/admin.js',
  'js/qr-generator.js',
  'js/app.js'
];

const customerJsFiles = [
  'js/data.js',
  'js/auth.js',
  'js/booking.js',
  'js/ai-cotu.js',
  'js/qr-generator.js',
  'js/app.js'
];

const adminJsFiles = [
  'js/data.js',
  'js/auth.js',
  'js/qr-generator.js',
  'js/admin.js'
];

console.log('Testing JS files syntax...');
let hasError = false;

for (const file of jsFiles) {
  const fullPath = path.join(dir, file);
  try {
    execSync(`node -c "${fullPath}"`);
    console.log(`[PASS] Syntax OK: ${file}`);
  } catch (err) {
    console.error(`[FAIL] Syntax error in: ${file}`, err.message);
    hasError = true;
  }
}

// Check index.html structure & Customer Isolation
console.log('\nTesting index.html structure & customer separation...');
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
const authJs = fs.readFileSync(path.join(dir, 'js/auth.js'), 'utf8');

const customerChecks = [
  { name: 'DOCTYPE html', test: html.includes('<!DOCTYPE html>') },
  { name: 'UTF-8 charset', test: html.includes('<meta charset="utf-8"/>') || html.includes('<meta charset="utf-8">') },
  { name: 'Tailwind CDN & config', test: html.includes('cdn.tailwindcss.com') && html.includes('tailwind.config') },
  { name: 'All 6 Section IDs exist', test: ['section-see', 'section-search', 'section-compare', 'section-book', 'section-experience', 'section-review'].every(id => html.includes(`id="${id}"`)) },
  { name: 'All 5 stops present', test: [1, 2, 3, 4, 5].every(id => html.includes(`id="stop-card-${id}"`)) },
  { name: 'Booking form present', test: html.includes('id="booking-direct-form"') },
  { name: 'AI chat widget present', test: html.includes('id="ai-chat-window"') && html.includes('id="ai-fab-toggle"') },
  { name: 'Customer Auth modal present', test: html.includes('id="auth-modal"') },
  { name: 'Customer portal modal present', test: html.includes('id="customer-portal-modal"') },
  { name: 'Pre-booking form present', test: html.includes('id="form-prebook-tour"') },
  { name: 'Sticky bottom bar present', test: html.includes('class="bottom-sticky-bar"') },
  { name: 'Referral QR modal & high-res inline canvas present', test: html.includes('id="referral-qr-modal"') && html.includes('id="referral-qr-canvas"') && html.includes('id="inline-referral-qr-canvas"') && html.includes('id="inline-referral-qr-canvas" width="240" height="240"') },
  { name: 'Referral QR download & copy controls present', test: html.includes('id="btn-download-referral-qr"') && html.includes('id="btn-inline-download-referral-qr"') && html.includes('data-action="download-referral-qr"') && html.includes('id="btn-copy-referral-link"') && html.includes('data-action="open-referral-qr"') },
  { name: 'Customer isolation: NO admin-dashboard-modal in index.html', test: !html.includes('id="admin-dashboard-modal"') },
  { name: 'Customer isolation: NO btn-quick-login-admin in index.html', test: !html.includes('id="btn-quick-login-admin"') },
  { name: 'Customer isolation: NO public admin footer button in index.html', test: !html.includes('Truy Cập Trang Quản Trị') && !html.includes('data-action="open-admin"') },
  { name: 'Credential hygiene: NO quick-login demo button or leaked credentials in index.html', test: !html.includes('id="btn-quick-login-customer"') && !html.includes('Tài Khoản Khách Hàng Thử Nghiệm Nhanh') && !html.includes('123456') && !html.includes('cotu@2026') && !html.includes('quan.tran@gmail.com') && !html.includes('admin@cotu-saigon.vn') },
  { name: 'Customer isolation: auth.js restricts customer form to role customer & removes demo quick-login', test: authJs.includes("requiredRole: 'customer'") && !authJs.includes('btn-quick-login-customer') && !authJs.includes('123456') },
  { name: 'Customer script tags referenced correctly', test: customerJsFiles.every(f => html.includes(`src="${f}"`)) },
  { name: 'CSS referenced correctly', test: html.includes('href="css/style.css"') }
];

customerChecks.forEach(c => {
  if (c.test) {
    console.log(`[PASS] ${c.name}`);
  } else {
    console.error(`[FAIL] ${c.name}`);
    hasError = true;
  }
});

// Check admin.html standalone dashboard
console.log('\nTesting admin.html standalone management dashboard...');
const adminHtmlPath = path.join(dir, 'admin.html');
if (!fs.existsSync(adminHtmlPath)) {
  console.error('[FAIL] admin.html does not exist!');
  hasError = true;
} else {
  const adminHtml = fs.readFileSync(adminHtmlPath, 'utf8');
  const adminChecks = [
    { name: 'admin.html DOCTYPE html', test: adminHtml.includes('<!DOCTYPE html>') },
    { name: 'admin.html strict RBAC auth guard redirecting to admin-login.html', test: adminHtml.includes("user.role !== 'admin'") && adminHtml.includes('admin-login.html') },
    { name: 'admin.html sidebar navigation present', test: adminHtml.includes('id="admin-sidebar"') },
    { name: 'admin.html KPI cards present', test: ['admin-kpi-orders', 'admin-kpi-guests', 'admin-kpi-revenue', 'admin-kpi-prebookings'].every(id => adminHtml.includes(`id="${id}"`)) },
    { name: 'admin.html Orders table present', test: adminHtml.includes('id="admin-orders-table-body"') },
    { name: 'admin.html Pre-bookings table present', test: adminHtml.includes('id="admin-prebookings-table-body"') },
    { name: 'admin.html Customers accounts table & all tier filters present', test: adminHtml.includes('id="admin-customers-table-body"') && adminHtml.includes('value="Kim Cương"') && adminHtml.includes('value="Vàng"') },
    { name: 'admin.html cross-tab storage auth guard present', test: adminHtml.includes("addEventListener('storage'") },
    { name: 'admin.html defines on-primary-fixed Tailwind color token', test: adminHtml.includes("'on-primary-fixed'") },
    { name: 'admin.html Activity logs table present', test: adminHtml.includes('id="admin-activities-table-body"') },
    { name: 'admin.html Visual Excel Export Center present', test: adminHtml.includes('id="admin-panel-excel"') && adminHtml.includes('id="btn-export-excel-comprehensive"') },
    { name: 'admin.html Logout control present', test: adminHtml.includes('data-action="admin-logout"') },
    { name: 'admin.html script tags referenced correctly', test: adminJsFiles.every(f => adminHtml.includes(`src="${f}"`)) }
  ];

  adminChecks.forEach(c => {
    if (c.test) {
      console.log(`[PASS] ${c.name}`);
    } else {
      console.error(`[FAIL] ${c.name}`);
      hasError = true;
    }
  });
}

// Check admin-login.html gateway
console.log('\nTesting admin-login.html dedicated admin gateway...');
const adminLoginPath = path.join(dir, 'admin-login.html');
if (!fs.existsSync(adminLoginPath)) {
  console.error('[FAIL] admin-login.html does not exist!');
  hasError = true;
} else {
  const adminLoginHtml = fs.readFileSync(adminLoginPath, 'utf8');
  const loginChecks = [
    { name: 'admin-login.html DOCTYPE html', test: adminLoginHtml.includes('<!DOCTYPE html>') },
    { name: 'admin-login.html form present', test: adminLoginHtml.includes('id="admin-login-form"') && adminLoginHtml.includes('id="admin-login-identifier"') && adminLoginHtml.includes('id="admin-login-password"') },
    { name: 'admin-login.html redirects valid admin to admin.html', test: adminLoginHtml.includes('admin.html') },
    { name: 'admin-login.html rejects non-admin customers cleanly', test: adminLoginHtml.includes("requiredRole: 'admin'") && adminLoginHtml.includes("res.user.role !== 'admin'") && adminLoginHtml.includes('AuthManager.logout()') },
    { name: 'Credential hygiene: admin-login.html does NOT expose demo credentials or quick-fill panel', test: !adminLoginHtml.includes('id="btn-fill-admin-demo"') && !adminLoginHtml.includes('Tài khoản Demo') && !adminLoginHtml.includes('cotu@2026') && !adminLoginHtml.includes('123456') && !adminLoginHtml.includes('admin@cotu-saigon.vn') }
  ];

  loginChecks.forEach(c => {
    if (c.test) {
      console.log(`[PASS] ${c.name}`);
    } else {
      console.error(`[FAIL] ${c.name}`);
      hasError = true;
    }
  });
}

// Check css/style.css integrity
console.log('\nTesting css/style.css structure...');
const css = fs.readFileSync(path.join(dir, 'css/style.css'), 'utf8');
const cssChecks = [
  { name: 'CSS Variables defined', test: css.includes('--color-primary') && css.includes('--color-secondary') },
  { name: 'Floating FAB container styling', test: css.includes('.ai-fab-container') },
  { name: 'Bottom sticky bar styling', test: css.includes('.bottom-sticky-bar') },
  { name: 'Waveform animation styling', test: css.includes('.waveform-bar') }
];

cssChecks.forEach(c => {
  if (c.test) {
    console.log(`[PASS] ${c.name}`);
  } else {
    console.error(`[FAIL] ${c.name}`);
    hasError = true;
  }
});

if (hasError) {
  process.exit(1);
} else {
  console.log('\nAll verification checks passed successfully!');
}
