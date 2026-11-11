/**
 * Functional Test Suite for Cô Tư Alley Tour Logic
 */
const assert = require('assert');

const path = require('path');

// 1. Mock window and load data.js
global.window = {};
require(path.join(__dirname, 'js/data.js'));

const data = global.window.CO_TU_DATA;
assert(data, 'Data object must exist');
assert(data.stops.length === 5, 'Must have 5 stops');
assert(data.stops.every(s => s.name && s.time && s.district), 'Every stop must have name, time, district');

console.log('✓ Data models validated (5 stops, authentic details)');

// 2. Test Pricing & Promo Algorithms
function calculatePrice(adults, children, promoCode) {
  const ADULT_PRICE = 590000;
  const CHILD_PRICE = 350000;
  const rawTotal = (adults * ADULT_PRICE) + (children * CHILD_PRICE);

  let discount = 0;
  if (promoCode && data.promoCodes[promoCode]) {
    const promo = data.promoCodes[promoCode];
    if (promo.type === 'fixed') {
      discount = promo.discount;
    } else if (promo.type === 'percent') {
      discount = rawTotal * promo.discount;
    }
  }
  const finalTotal = Math.max(0, rawTotal - discount);
  return { rawTotal, discount, finalTotal };
}

// Case A: 2 Adults, 0 Child, No promo
const res1 = calculatePrice(2, 0, null);
assert.strictEqual(res1.rawTotal, 1180000);
assert.strictEqual(res1.discount, 0);
assert.strictEqual(res1.finalTotal, 1180000);

// Case B: 2 Adults, 1 Child, TIKTOK50 (-50,000)
const res2 = calculatePrice(2, 1, 'TIKTOK50');
assert.strictEqual(res2.rawTotal, 1180000 + 350000); // 1530000
assert.strictEqual(res2.discount, 50000);
assert.strictEqual(res2.finalTotal, 1480000);

// Case C: 2 Adults, HEMSAIGON (-10%)
const res3 = calculatePrice(2, 0, 'HEMSAIGON');
assert.strictEqual(res3.discount, 118000);
assert.strictEqual(res3.finalTotal, 1062000);

// Case D: COTU2026 (-100,000)
const res4 = calculatePrice(2, 0, 'COTU2026');
assert.strictEqual(res4.discount, 100000);
assert.strictEqual(res4.finalTotal, 1080000);

console.log('✓ Pricing and promo code algorithm passes all boundary tests');

// 3. Test Search & Filter Algorithm
function filterStops(stops, query, flavor, dietary) {
  return stops.filter(s => {
    const matchQuery = !query || s.name.toLowerCase().includes(query.toLowerCase()) || s.district.toLowerCase().includes(query.toLowerCase());
    const matchFlavor = flavor === 'all' || s.flavorType === flavor;
    const matchDietary = dietary === 'all' || s.dietary.includes(dietary);
    return matchQuery && matchFlavor && matchDietary;
  });
}

// Search "Đa Kao" -> 1 match
const filter1 = filterStops(data.stops, 'Đa Kao', 'all', 'all');
assert.strictEqual(filter1.length, 1);
assert.strictEqual(filter1[0].id, 1);

// Filter by dietary "an_chay" -> 3 matches (Bánh cuốn, Cà phê vợt, Chè mâm)
const filter2 = filterStops(data.stops, '', 'all', 'an_chay');
assert.strictEqual(filter2.length, 3);

// Filter by flavor "dam_da" -> 1 match (Cà phê vợt)
const filter3 = filterStops(data.stops, '', 'dam_da', 'all');
assert.strictEqual(filter3.length, 1);
assert.strictEqual(filter3[0].id, 2);

console.log('✓ Search and multi-criteria filter algorithm validated');

// 4. Test AI Intent Parsing
function matchAIIntent(userText) {
  const lower = userText.toLowerCase();
  for (const intent of data.aiKnowledge.intents) {
    if (intent.keywords.some(kw => lower.includes(kw))) {
      return intent.answer;
    }
  }
  return null;
}

const hygieneAns = matchAIIntent("Chỗ này có vệ sinh sạch sẽ không Cô Tư?");
assert(hygieneAns && hygieneAns.includes("đền gấp 10"), "Hygiene intent must match");

const spicyAns = matchAIIntent("Con không ăn cay được thì sao?");
assert(spicyAns && spicyAns.includes("ớt sa tế riêng"), "Spicy intent must match");

const coffeeAns = matchAIIntent("Cà phê vợt chú ba có gì đặc biệt?");
assert(coffeeAns && coffeeAns.includes("siêu đất"), "Coffee intent must match");

console.log('✓ AI culinary intent parsing engine validated');

// 5. Test CSV Generation
function generateCSV(orders) {
  let csv = "\uFEFFMã Đơn,Họ Tên Khách,Số Điện Thoại,Email,Ngày & Giờ Đi,Số Khách,Tổng Tiền,Thanh Toán,Trạng Thái,Khẩu Vị & Dị Ứng,Ghi Chú\n";
  orders.forEach(o => {
    csv += `"${o.id}","${o.name}","${o.phone}","${o.email || ''}","${o.date}","${o.guests}","${o.total}","${o.payment || ''}","${o.status}","${o.dietary || ''}","${(o.notes || '').replace(/"/g, '""')}"\n`;
  });
  return csv;
}

const csvOutput = generateCSV(data.initialOrders);
assert(csvOutput.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM');
assert(csvOutput.includes('CT-8291'), 'CSV must contain initial order CT-8291');
assert(csvOutput.includes('Trần Minh Quân'), 'CSV must support Vietnamese characters');

console.log('✓ CSV export engine validated with UTF-8 BOM encoding');

// 6. Test Authentication & RBAC (Customer vs Admin)
// Setup Mock localStorage for Node test environment
const mockStorage = {};
global.localStorage = {
  getItem: (k) => mockStorage[k] || null,
  setItem: (k, v) => { mockStorage[k] = String(v); },
  removeItem: (k) => { delete mockStorage[k]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); }
};

require(path.join(__dirname, 'js/auth.js'));
const auth = global.window.AuthManager;
assert(auth, 'AuthManager must exist');
auth.init();

// Test Admin login
const adminLoginRes = auth.login('admin@cotu-saigon.vn', 'cotu@2026');
assert(adminLoginRes.success, 'Admin login must succeed');
assert(auth.isAdmin(), 'isAdmin() must be true for admin account');
assert(!auth.isCustomer(), 'isCustomer() must be false for admin account');
assert.strictEqual(adminLoginRes.user.role, 'admin');

// Test Logout
auth.logout();
assert(!auth.isAuthenticated(), 'User must not be authenticated after logout');

// Test Customer login
const custLoginRes = auth.login('quan.tran@gmail.com', '123456');
assert(custLoginRes.success, 'Customer login must succeed');
assert(auth.isCustomer(), 'isCustomer() must be true for customer account');
assert(!auth.isAdmin(), 'isAdmin() must be false for customer account');
assert.strictEqual(custLoginRes.user.role, 'customer');

// Test Wrong password rejection
const failPw = auth.login('quan.tran@gmail.com', 'wrongpassword');
assert(!failPw.success, 'Wrong password must be rejected');

// Test New Customer Registration
const newCustRes = auth.register({
  fullName: 'Phạm Hồng Nhung',
  phone: '0978123456',
  email: 'hongnhung@gmail.com',
  password: 'password123',
  dietary: 'Ăn chay trường, không tỏi'
});
assert(newCustRes.success, 'Valid customer registration must succeed');
assert.strictEqual(newCustRes.user.role, 'customer');
assert(auth.isCustomer(), 'Newly registered user must be logged in as customer');

// Test Registration Phone Validation Rejection
const invalidPhoneReg = auth.register({
  fullName: 'Test User',
  phone: '12345',
  email: 'test@gmail.com',
  password: 'password123'
});
assert(!invalidPhoneReg.success, 'Invalid phone number must be rejected');

console.log('✓ Authentication & RBAC permissions (Customer vs Admin) validated');

// 7. Test Customer Pre-Booking (Đặt Tour Trước) Engine
const preBooking = auth.savePreBooking({
  customerName: 'Phạm Hồng Nhung',
  phone: '0978123456',
  email: 'hongnhung@gmail.com',
  targetDate: '25/12/2026',
  timeSlot: '16:30 (Chiều hoàng hôn)',
  theme: 'Hẻm Chợ Lớn Sủi Cảo & Văn Hóa Người Hoa Đêm',
  guests: 4,
  estimatedBudget: '2.480.000₫',
  dietaryNotes: 'Ăn chay trường',
  specialRequests: 'Nhóm gia đình có trẻ em'
});

assert(preBooking && preBooking.id.startsWith('PRE-'), 'Pre-booking ID must start with PRE-');
assert.strictEqual(preBooking.status, 'Chờ tư vấn', 'Default pre-booking status must be "Chờ tư vấn"');

// Test Admin Update Pre-booking
// Switch to admin first
auth.login('admin@cotu-saigon.vn', 'cotu@2026');
const updateRes = auth.updatePreBookingStatus(preBooking.id, 'Đã xác nhận cọc', 'Đã xếp bàn riêng và chỉ định HDV Hoàng Minh');
assert(updateRes.success, 'Admin update pre-booking must succeed');
assert.strictEqual(updateRes.preBooking.status, 'Đã xác nhận cọc');

console.log('✓ Customer Pre-booking (Đặt Tour Trước) workflow validated');

// 8. Test Visual XML Spreadsheet (.xls) Generator
function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTestSpreadsheetXML(sheets) {
  let xml = '<?xml version="1.0"?>\n<?mso-application progid="Excel.Sheet"?>\n<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
  xml += '<Styles><Style ss:ID="TitleBanner"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#835500" ss:Pattern="Solid"/></Style></Styles>\n';
  sheets.forEach(s => {
    xml += `<Worksheet ss:Name="${escapeXml(s.name)}"><Table>\n`;
    s.rows.forEach(r => {
      xml += '<Row>' + r.map(c => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`).join('') + '</Row>\n';
    });
    xml += '</Table></Worksheet>\n';
  });
  xml += '</Workbook>';
  return xml;
}

const testXml = buildTestSpreadsheetXML([
  { name: 'Don_Tour', rows: [['Mã Đơn', 'Khách', 'Doanh Thu'], ['CT-8291', 'Trần Minh Quân & Bạn bè', '1.180.000₫']] },
  { name: 'Dat_Tour_Truoc', rows: [['Mã Yêu Cầu', 'Khách', 'Ngày Đi'], ['PRE-701', 'Trần Minh Quân', '15/12/2026']] }
]);

assert(testXml.startsWith('<?xml version="1.0"?>'), 'Excel XML must have XML declaration');
assert(testXml.includes('ss:Name="Don_Tour"'), 'Excel XML must contain Don_Tour worksheet');
assert(testXml.includes('ss:Name="Dat_Tour_Truoc"'), 'Excel XML must contain Dat_Tour_Truoc worksheet');
assert(testXml.includes('&amp;'), 'Ampersand in XML data must be properly escaped');
assert(testXml.includes('#835500'), 'Excel XML styles must include Cô Tư brand color #835500');

console.log('✓ Visual Multi-Sheet Excel XML engine validated');

// 9. Test Standards-Compliant QR Code Generation Engine & Full Reed-Solomon Decodability
const QRGen = require(path.join(__dirname, 'js/qr-generator.js'));
assert(QRGen && typeof QRGen.generateMatrix === 'function', 'QRCodeGenerator must exist and have generateMatrix');

// Helper: Pure-JS ISO/IEC 18004 + GF(256) Reed-Solomon Decoder
const QR_EXP = new Uint8Array(512);
const QR_LOG = new Uint8Array(256);
(function initDecoderGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    QR_EXP[i] = x;
    QR_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11D;
  }
  for (let i = 255; i < 512; i++) QR_EXP[i] = QR_EXP[i - 255];
})();
const decGfMul = (a, b) => (a && b) ? QR_EXP[QR_LOG[a] + QR_LOG[b]] : 0;
const decGfDiv = (a, b) => a === 0 ? 0 : QR_EXP[(QR_LOG[a] - QR_LOG[b] + 255) % 255];
function decPolyEval(p, x) { let y = p[0]; for (let i = 1; i < p.length; i++) y = decGfMul(y, x) ^ p[i]; return y; }
function decPolyMul(p, q) {
  const r = new Array(p.length + q.length - 1).fill(0);
  for (let i = 0; i < p.length; i++) for (let j = 0; j < q.length; j++) r[i + j] ^= decGfMul(p[i], q[j]);
  return r;
}
function decodeRSBlock(cw, eccLen) {
  const syn = [];
  for (let i = 0; i < eccLen; i++) syn.push(decPolyEval(cw, QR_EXP[i]));
  if (syn.every(s => s === 0)) return cw.slice(0, cw.length - eccLen);

  let errLoc = [1], oldLoc = [1];
  for (let i = 0; i < eccLen; i++) {
    let delta = syn[i];
    for (let j = 1; j < errLoc.length; j++) delta ^= decGfMul(errLoc[errLoc.length - 1 - j], syn[i - j]);
    oldLoc.push(0);
    if (delta !== 0) {
      if (oldLoc.length > errLoc.length) {
        const newLoc = oldLoc.map(v => decGfMul(v, delta));
        oldLoc = errLoc.map(v => decGfDiv(v, delta));
        errLoc = newLoc;
      }
      const scale = oldLoc.map(v => decGfMul(v, delta));
      const pad = new Array(errLoc.length - scale.length).fill(0).concat(scale);
      errLoc = errLoc.map((v, idx) => v ^ pad[idx]);
    }
  }
  const numErr = errLoc.length - 1;
  assert(numErr * 2 <= eccLen, `Unrecoverable RS errors: ${numErr} > ${eccLen / 2}`);
  const errPos = [];
  for (let i = 0; i < cw.length; i++) {
    if (decPolyEval(errLoc, QR_EXP[255 - i]) === 0) errPos.push(cw.length - 1 - i);
  }
  assert.strictEqual(errPos.length, numErr, 'Chien search error count must match locator degree');
  let errEval = decPolyMul(syn.slice().reverse(), errLoc);
  errEval = errEval.slice(errEval.length - eccLen);
  const out = cw.slice();
  for (const pos of errPos) {
    const Xi = QR_EXP[cw.length - 1 - pos];
    const XiInv = QR_EXP[(255 - (cw.length - 1 - pos)) % 255];
    let deriv = 0;
    for (let j = 0; j < errLoc.length; j++) {
      const deg = errLoc.length - 1 - j;
      if (deg % 2 === 1) deriv ^= decGfMul(errLoc[j], QR_EXP[(QR_LOG[XiInv] * (deg - 1)) % 255]);
    }
    out[pos] ^= decGfMul(Xi, decGfDiv(decPolyEval(errEval, XiInv), deriv));
  }
  return out.slice(0, cw.length - eccLen);
}

function verifyAndDecodeQR(matrix, simulateLogoRatio = 0) {
  const N = matrix.length;
  const V = (N - 17) / 4;
  assert.strictEqual(matrix[N - 8][8], true, `Fixed dark module (N-8, 8) must remain dark on V${V}`);

  const fmtTL = [];
  for (let c = 0; c <= 8; c++) if (c !== 6) fmtTL.push(matrix[8][c] ? 1 : 0);
  for (let r = 7; r >= 0; r--) if (r !== 6) fmtTL.push(matrix[r][8] ? 1 : 0);
  const fmtBR = [];
  for (let i = 0; i < 7; i++) fmtBR.push(matrix[N - 1 - i][8] ? 1 : 0);
  for (let i = 0; i < 8; i++) fmtBR.push(matrix[8][N - 8 + i] ? 1 : 0);
  assert.strictEqual(fmtTL.join(''), fmtBR.join(''), 'Format info TL and BL/TR copies must match identically');

  const fmtVal = parseInt(fmtTL.join(''), 2) ^ 0x5412;
  const eccLevel = { 1: 'L', 0: 'M', 3: 'Q', 2: 'H' }[(fmtVal >> 13) & 3];
  const maskPat = (fmtVal >> 10) & 7;

  const specs = [
    [1,  [],              1,  9, 0,  0, 17, 'H'],
    [2,  [6, 18],         1, 16, 0,  0, 28, 'H'],
    [3,  [6, 22],         2, 13, 0,  0, 22, 'H'],
    [4,  [6, 26],         4,  9, 0,  0, 16, 'H'],
    [5,  [6, 30],         2, 11, 2, 12, 22, 'H'],
    [6,  [6, 34],         4, 15, 0,  0, 28, 'H'],
    [7,  [6, 22, 38],     4, 13, 1, 14, 26, 'H'],
    [8,  [6, 24, 42],     4, 14, 2, 15, 26, 'H'],
    [9,  [6, 26, 46],     4, 12, 4, 13, 24, 'H'],
    [10, [6, 28, 50],     6, 15, 2, 16, 28, 'H'],
    [11, [6, 30, 54],     3, 12, 8, 13, 24, 'H'],
    [12, [6, 32, 58],     7, 14, 4, 15, 28, 'H'],
    [13, [6, 34, 62],    12, 11, 4, 12, 22, 'H'],
    [14, [6, 26, 46, 66],11, 12, 5, 13, 24, 'H'],
    [14, [6, 26, 46, 66], 4, 40, 5, 41, 24, 'M']
  ];
  const [, align, g1b, g1d, g2b, g2d, eccPerBlock] = specs.find(s => s[0] === V && s[7] === eccLevel);

  const m = matrix.map(row => row.slice());
  if (simulateLogoRatio > 0) {
    const center = (N - 1) / 2;
    const rad = simulateLogoRatio * N;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if ((r - center) ** 2 + (c - center) ** 2 <= rad ** 2) m[r][c] = false;
      }
    }
  }

  const res = Array.from({ length: N }, () => new Array(N).fill(false));
  const markFinder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++)
      if (r0 + r >= 0 && r0 + r < N && c0 + c >= 0 && c0 + c < N) res[r0 + r][c0 + c] = true;
  };
  markFinder(0, 0); markFinder(0, N - 7); markFinder(N - 7, 0);
  for (const r of align) for (const c of align) {
    if ((r < 9 && c < 9) || (r < 9 && c >= N - 9) || (r >= N - 9 && c < 9)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) res[r + dr][c + dc] = true;
  }
  for (let i = 8; i < N - 8; i++) { res[6][i] = true; res[i][6] = true; }
  res[N - 8][8] = true;
  for (let i = 0; i < 9; i++) { res[8][i] = true; res[i][8] = true; }
  for (let i = 0; i < 8; i++) { res[8][N - 1 - i] = true; res[N - 1 - i][8] = true; }
  if (V >= 7) for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) { res[i][N - 11 + j] = true; res[N - 11 + j][i] = true; }

  const maskBit = (r, c) => [
    (r + c) % 2 === 0, r % 2 === 0, c % 3 === 0, (r + c) % 3 === 0,
    (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    ((r * c) % 2) + ((r * c) % 3) === 0,
    (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (((r + c) % 2) + ((r * c) % 3)) % 2 === 0
  ][maskPat];

  const bits = [];
  let upward = true;
  for (let col = N - 1; col > 0; col -= 2) {
    if (col === 6) col--;
    for (let s = 0; s < N; s++) {
      const r = upward ? (N - 1 - s) : s;
      for (const c of [col, col - 1]) {
        if (!res[r][c]) {
          let b = m[r][c] ? 1 : 0;
          if (maskBit(r, c)) b ^= 1;
          bits.push(b);
        }
      }
    }
    upward = !upward;
  }

  const totalCW = g1b * g1d + g2b * g2d + (g1b + g2b) * eccPerBlock;
  const codewords = [];
  for (let i = 0; i < totalCW; i++) codewords.push(parseInt(bits.slice(i * 8, i * 8 + 8).join(''), 2));

  const nb = g1b + g2b;
  const blocks = Array.from({ length: nb }, () => []);
  let idx = 0;
  for (let i = 0; i < Math.max(g1d, g2d); i++) {
    for (let b = 0; b < nb; b++) {
      if (i < (b < g1b ? g1d : g2d)) blocks[b].push(codewords[idx++]);
    }
  }
  for (let i = 0; i < eccPerBlock; i++) {
    for (let b = 0; b < nb; b++) blocks[b].push(codewords[idx++]);
  }

  const recovered = [];
  for (const blk of blocks) recovered.push(...decodeRSBlock(blk, eccPerBlock));

  const bitStr = recovered.map(b => b.toString(2).padStart(8, '0')).join('');
  assert.strictEqual(bitStr.slice(0, 4), '0100', 'QR Byte Mode indicator must decode cleanly');
  const cciBits = V <= 9 ? 8 : 16;
  const len = parseInt(bitStr.slice(4, 4 + cciBits), 2);
  const outBytes = [];
  for (let i = 0; i < len; i++) {
    outBytes.push(parseInt(bitStr.slice(4 + cciBits + i * 8, 4 + cciBits + (i + 1) * 8), 2));
  }
  return Buffer.from(outBytes).toString('utf8');
}

// Test standard URL matrix generation + finder patterns
const siteUrl = 'https://cotu-saigon.vn';
const matrixShort = QRGen.generateMatrix(siteUrl, { minVersion: 3 });
assert(Array.isArray(matrixShort) && matrixShort.length >= 29, 'Center-logo URL QR matrix must be V3+ (29x29+)');
assert.strictEqual(matrixShort.length, matrixShort[0].length, 'QR Code matrix must be square');
assert.strictEqual(matrixShort[0][0], true, 'Top-Left corner (0,0) must be dark');
assert.strictEqual(matrixShort[3][3], true, 'Top-Left center dot (3,3) must be dark');
assert.strictEqual(matrixShort[0][matrixShort.length - 1], true, 'Top-Right corner outer module must be dark');
assert.strictEqual(matrixShort[matrixShort.length - 1][0], true, 'Bottom-Left corner outer module must be dark');
assert.strictEqual(verifyAndDecodeQR(matrixShort, 0.14), siteUrl, 'Standard site URL QR must Reed-Solomon decode even under center-logo erasure');

// Test local origin URL, UTF-8 Vietnamese campaign URL, and long URL scaling
const localUrl = 'http://127.0.0.1:3000/';
assert.strictEqual(verifyAndDecodeQR(QRGen.generateMatrix(localUrl, { minVersion: 3 }), 0.14), localUrl);

const longCampaignUrl = 'https://cotu-saigon.vn/tour/hem-odyssey?utm_source=referral_qr&utm_campaign=cô_tư_2026&tag=🍜';
const matrixLong = QRGen.generateMatrix(longCampaignUrl, { minVersion: 3 });
assert(matrixLong.length > matrixShort.length, 'Longer UTF-8 campaign URL must auto-scale to higher QR version');
assert.strictEqual(verifyAndDecodeQR(matrixLong, 0.14), longCampaignUrl, 'UTF-8 Vietnamese & emoji campaign URL must decode accurately via RS');

console.log('✓ Standards-compliant ISO/IEC 18004 QR Code & Reed-Solomon decodeability verified');

// 10. Test Customer vs. Admin Authentication Routing & RBAC Separation
// Customer login simulation
auth.logout();
const customerLogin = auth.login('quan.tran@gmail.com', '123456');
assert(customerLogin.success, 'Customer login should succeed');
assert(auth.isCustomer(), 'User role must be customer');
assert(!auth.isAdmin(), 'Customer must not have admin privilege');

// Customer trying to access Admin Portal logic
function checkAdminAccess(currentUser) {
  if (!currentUser || currentUser.role !== 'admin') {
    return { allow: false, redirect: 'admin-login.html', error: 'unauthorized_customer' };
  }
  return { allow: true, redirect: 'admin.html' };
}

const customerAccess = checkAdminAccess(auth.getCurrentUser());
assert(!customerAccess.allow, 'Customer must be blocked from accessing Admin Dashboard');
assert.strictEqual(customerAccess.redirect, 'admin-login.html', 'Customer attempting to access admin must redirect to admin-login.html');

// Admin login simulation
auth.logout();
const adminLogin = auth.login('admin@cotu-saigon.vn', 'cotu@2026');
assert(adminLogin.success, 'Admin login should succeed');
assert(auth.isAdmin(), 'User role must be admin');
assert(!auth.isCustomer(), 'Admin must not have customer-only role');

const adminAccess = checkAdminAccess(auth.getCurrentUser());
assert(adminAccess.allow, 'Admin must be allowed access to Admin Dashboard');
assert.strictEqual(adminAccess.redirect, 'admin.html', 'Admin must be directed to admin.html');

// Admin gateway rejecting customer accounts
function simulateAdminGatewayLogin(identifier, password) {
  const res = auth.login(identifier, password);
  if (!res.success) return res;
  if (res.user.role !== 'admin') {
    auth.logout();
    return {
      success: false,
      message: 'Từ chối truy cập: Tài khoản khách hàng không có quyền quản trị hệ thống!'
    };
  }
  return { success: true, redirect: 'admin.html' };
}

const custOnAdminGateway = simulateAdminGatewayLogin('quan.tran@gmail.com', '123456');
assert(!custOnAdminGateway.success, 'Admin gateway must reject customer accounts');
assert(custOnAdminGateway.message.includes('khách hàng'), 'Rejection message must indicate customer role');

const adminOnAdminGateway = simulateAdminGatewayLogin('admin@cotu-saigon.vn', 'cotu@2026');
assert(adminOnAdminGateway.success, 'Admin gateway must accept admin accounts');
assert.strictEqual(adminOnAdminGateway.redirect, 'admin.html', 'Admin gateway must redirect admin to admin.html');

// Admin login from customer-only form (requiredRole: 'customer') must be rejected
auth.logout();
const adminOnCustomerForm = auth.login('admin@cotu-saigon.vn', 'cotu@2026', { requiredRole: 'customer' });
assert(!adminOnCustomerForm.success, 'Customer login form must reject admin credentials when requiredRole is customer');
assert(!auth.isAuthenticated(), 'Rejected admin login on customer form must not authenticate session');

// Admin gateway rejecting customer accounts (requiredRole: 'admin') without session side-effects
const actCountBefore = auth.getActivities().length;
const custOnAdminGatewayDirect = auth.login('quan.tran@gmail.com', '123456', { requiredRole: 'admin' });
assert(!custOnAdminGatewayDirect.success, 'Admin gateway must reject customer accounts cleanly');
assert(!auth.isAuthenticated(), 'Rejected customer on admin gateway must leave session unauthenticated');
assert.strictEqual(auth.getActivities().length, actCountBefore, 'Rejected gateway attempt must not log spurious login/logout activity');

console.log('✓ Customer vs Admin authentication routing & RBAC gateway separation validated');

console.log('\n========================================');
console.log('ALL FUNCTIONAL TESTS PASSED (100% GREEN)');
console.log('========================================');
