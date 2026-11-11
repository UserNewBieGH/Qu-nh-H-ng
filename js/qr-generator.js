/**
 * Standalone Standards-Compliant QR Code Generator for Cô Tư Web
 * Generates ISO/IEC 18004 compliant QR Codes (Byte Mode, Version 1-14, ECC Level H & M fallback)
 * Full GF(256) Reed-Solomon ECC, 8-mask ISO penalty scoring, UTF-8 encoding, zero external dependencies.
 */
(function(global) {
  'use strict';

  // GF(256) arithmetic with primitive polynomial 0x11D
  const EXP_TABLE = new Uint8Array(512);
  const LOG_TABLE = new Uint8Array(256);
  (function initGaloisField() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP_TABLE[i] = x;
      LOG_TABLE[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11D;
    }
    for (let i = 255; i < 512; i++) {
      EXP_TABLE[i] = EXP_TABLE[i - 255];
    }
  })();

  function gfMul(x, y) {
    if (x === 0 || y === 0) return 0;
    return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
  }

  // Descending generator polynomial: poly[0] === 1 (x^degree term first)
  function rsGeneratorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const root = EXP_TABLE[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function rsCalculateECC(dataBytes, eccCount) {
    const gen = rsGeneratorPoly(eccCount);
    const result = new Array(eccCount).fill(0);
    for (let i = 0; i < dataBytes.length; i++) {
      const factor = dataBytes[i] ^ result[0];
      result.shift();
      result.push(0);
      if (factor !== 0) {
        for (let j = 0; j < eccCount; j++) {
          result[j] ^= gfMul(gen[j + 1], factor);
        }
      }
    }
    return result;
  }

  // ISO/IEC 18004 Version 1..14, Level H (30% recovery - ideal for branded center logo)
  // Format: [version, alignCoords, g1Blocks, g1DataCW, g2Blocks, g2DataCW, eccPerBlock]
  const SPECS_H = [
    { version: 1,  size: 21, align: [],                g1b: 1,  g1d: 9,  g2b: 0, g2d: 0,  eccPerBlock: 17, level: 'H' },
    { version: 2,  size: 25, align: [6, 18],           g1b: 1,  g1d: 16, g2b: 0, g2d: 0,  eccPerBlock: 28, level: 'H' },
    { version: 3,  size: 29, align: [6, 22],           g1b: 2,  g1d: 13, g2b: 0, g2d: 0,  eccPerBlock: 22, level: 'H' },
    { version: 4,  size: 33, align: [6, 26],           g1b: 4,  g1d: 9,  g2b: 0, g2d: 0,  eccPerBlock: 16, level: 'H' },
    { version: 5,  size: 37, align: [6, 30],           g1b: 2,  g1d: 11, g2b: 2, g2d: 12, eccPerBlock: 22, level: 'H' },
    { version: 6,  size: 41, align: [6, 34],           g1b: 4,  g1d: 15, g2b: 0, g2d: 0,  eccPerBlock: 28, level: 'H' },
    { version: 7,  size: 45, align: [6, 22, 38],       g1b: 4,  g1d: 13, g2b: 1, g2d: 14, eccPerBlock: 26, level: 'H' },
    { version: 8,  size: 49, align: [6, 24, 42],       g1b: 4,  g1d: 14, g2b: 2, g2d: 15, eccPerBlock: 26, level: 'H' },
    { version: 9,  size: 53, align: [6, 26, 46],       g1b: 4,  g1d: 12, g2b: 4, g2d: 13, eccPerBlock: 24, level: 'H' },
    { version: 10, size: 57, align: [6, 28, 50],       g1b: 6,  g1d: 15, g2b: 2, g2d: 16, eccPerBlock: 28, level: 'H' },
    { version: 11, size: 61, align: [6, 30, 54],       g1b: 3,  g1d: 12, g2b: 8, g2d: 13, eccPerBlock: 24, level: 'H' },
    { version: 12, size: 65, align: [6, 32, 58],       g1b: 7,  g1d: 14, g2b: 4, g2d: 15, eccPerBlock: 28, level: 'H' },
    { version: 13, size: 69, align: [6, 34, 62],       g1b: 12, g1d: 11, g2b: 4, g2d: 12, eccPerBlock: 22, level: 'H' },
    { version: 14, size: 73, align: [6, 26, 46, 66],   g1b: 11, g1d: 12, g2b: 5, g2d: 13, eccPerBlock: 24, level: 'H' }
  ].map(s => ({ ...s, dataCap: s.g1b * s.g1d + s.g2b * s.g2d }));

  // Level M fallback for ultra-long URLs (195..362 UTF-8 bytes)
  const SPEC_V14_M = {
    version: 14, size: 73, align: [6, 26, 46, 66],
    g1b: 4, g1d: 40, g2b: 5, g2d: 41, eccPerBlock: 24, level: 'M',
    dataCap: 4 * 40 + 5 * 41
  };

  const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function toUTF8Bytes(str) {
    const s = String(str ?? '');
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(s));
    }
    const encoded = encodeURIComponent(s);
    const bytes = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === '%') {
        bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16));
        i += 2;
      } else {
        bytes.push(encoded.charCodeAt(i));
      }
    }
    return bytes;
  }

  function getBestSpec(byteCount, minVersion) {
    const minVer = minVersion || 1;
    for (const spec of SPECS_H) {
      if (spec.version < minVer) continue;
      // Overhead: 4 bits mode + (8 or 16 bits count) + 4 bits terminator <= 2 or 3 bytes
      const cciBits = spec.version <= 9 ? 8 : 16;
      const totalBits = 4 + cciBits + byteCount * 8;
      if (totalBits <= spec.dataCap * 8) {
        return spec;
      }
    }
    // Check Level M V14 fallback
    if (4 + 16 + byteCount * 8 <= SPEC_V14_M.dataCap * 8) {
      return SPEC_V14_M;
    }
    throw new Error(`QR payload (${byteCount} bytes) vượt quá dung lượng tối đa (362 bytes). Vui lòng rút gọn URL.`);
  }

  function encodeData(utf8Bytes, spec) {
    const cciBits = spec.version <= 9 ? 8 : 16;
    let bits = '0100'; // Byte Mode (0100)
    bits += utf8Bytes.length.toString(2).padStart(cciBits, '0');
    for (let i = 0; i < utf8Bytes.length; i++) {
      bits += utf8Bytes[i].toString(2).padStart(8, '0');
    }

    const maxBits = spec.dataCap * 8;
    const termLen = Math.min(4, maxBits - bits.length);
    for (let i = 0; i < termLen; i++) bits += '0';

    while (bits.length % 8 !== 0 && bits.length < maxBits) {
      bits += '0';
    }

    const dataBytes = [];
    for (let i = 0; i < bits.length; i += 8) {
      dataBytes.push(parseInt(bits.slice(i, i + 8), 2));
    }

    const padBytes = [0xEC, 0x11];
    let padIdx = 0;
    while (dataBytes.length < spec.dataCap) {
      dataBytes.push(padBytes[padIdx]);
      padIdx ^= 1;
    }

    // Split into blocks (Group 1 + Group 2)
    const dataBlocks = [];
    const eccBlocks = [];
    let offset = 0;

    for (let b = 0; b < spec.g1b; b++) {
      const blk = dataBytes.slice(offset, offset + spec.g1d);
      offset += spec.g1d;
      dataBlocks.push(blk);
      eccBlocks.push(rsCalculateECC(blk, spec.eccPerBlock));
    }
    for (let b = 0; b < spec.g2b; b++) {
      const blk = dataBytes.slice(offset, offset + spec.g2d);
      offset += spec.g2d;
      dataBlocks.push(blk);
      eccBlocks.push(rsCalculateECC(blk, spec.eccPerBlock));
    }

    // Interleave data codewords, then ECC codewords
    const finalCodewords = [];
    const maxDataLen = Math.max(spec.g1d, spec.g2d);
    for (let i = 0; i < maxDataLen; i++) {
      for (let b = 0; b < dataBlocks.length; b++) {
        if (i < dataBlocks[b].length) {
          finalCodewords.push(dataBlocks[b][i]);
        }
      }
    }
    for (let i = 0; i < spec.eccPerBlock; i++) {
      for (let b = 0; b < eccBlocks.length; b++) {
        finalCodewords.push(eccBlocks[b][i]);
      }
    }

    return finalCodewords;
  }

  function computeFormatBits(eccLevel, maskPattern) {
    const data = (ECC_FORMAT_BITS[eccLevel] << 3) | (maskPattern & 7);
    let rem = data << 10;
    const poly = 0x537;
    for (let bit = 14; bit >= 10; bit--) {
      if ((rem >> bit) & 1) {
        rem ^= (poly << (bit - 10));
      }
    }
    const raw = ((data << 10) | rem) ^ 0x5412;
    const out = new Array(15);
    for (let i = 0; i < 15; i++) {
      out[i] = (raw >> (14 - i)) & 1;
    }
    return out;
  }

  function computeVersionInfo(version) {
    let rem = version << 12;
    const poly = 0x1F25;
    for (let bit = 17; bit >= 12; bit--) {
      if ((rem >> bit) & 1) {
        rem ^= (poly << (bit - 12));
      }
    }
    return (version << 12) | rem;
  }

  function buildBaseMatrix(spec) {
    const size = spec.size;
    const matrix = Array.from({ length: size }, () => new Array(size).fill(null));
    const reserved = Array.from({ length: size }, () => new Array(size).fill(false));

    function setFunc(r, c, val) {
      matrix[r][c] = !!val;
      reserved[r][c] = true;
    }

    // 1. Finder Patterns (7x7) + White Separators
    function drawFinder(row, col) {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const nr = row + r;
          const nc = col + c;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark = r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setFunc(nr, nc, isDark);
          } else {
            setFunc(nr, nc, false);
          }
        }
      }
    }

    drawFinder(0, 0);
    drawFinder(0, size - 7);
    drawFinder(size - 7, 0);

    // 2. Alignment Patterns
    if (spec.align && spec.align.length >= 2) {
      const pos = spec.align;
      for (const r of pos) {
        for (const c of pos) {
          if ((r < 9 && c < 9) || (r < 9 && c >= size - 9) || (r >= size - 9 && c < 9)) continue;
          for (let dr = -2; dr <= 2; dr++) {
            for (let dc = -2; dc <= 2; dc++) {
              setFunc(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
            }
          }
        }
      }
    }

    // 3. Timing Patterns
    for (let i = 8; i < size - 8; i++) {
      if (matrix[6][i] === null) setFunc(6, i, i % 2 === 0);
      if (matrix[i][6] === null) setFunc(i, 6, i % 2 === 0);
    }

    // 4. Fixed Dark Module
    setFunc(size - 8, 8, true);

    // 5. Reserve Format Information Modules
    for (let i = 0; i < 9; i++) {
      if (i !== 6) {
        reserved[8][i] = true;
        reserved[i][8] = true;
      }
    }
    for (let i = 0; i < 8; i++) {
      reserved[8][size - 1 - i] = true;
      reserved[size - 1 - i][8] = true;
    }

    // 6. Version Information (Version >= 7)
    if (spec.version >= 7) {
      const vBits = computeVersionInfo(spec.version);
      for (let k = 0; k < 18; k++) {
        const bit = ((vBits >> k) & 1) === 1;
        const a = Math.floor(k / 3);
        const b = size - 11 + (k % 3);
        setFunc(b, a, bit);
        setFunc(a, b, bit);
      }
    }

    return { matrix, reserved };
  }

  function placeDataBits(matrix, reserved, codewords) {
    const size = matrix.length;
    const bits = [];
    for (const byte of codewords) {
      for (let i = 7; i >= 0; i--) {
        bits.push((byte >> i) & 1);
      }
    }

    let bitIdx = 0;
    let upward = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;
      for (let step = 0; step < size; step++) {
        const row = upward ? (size - 1 - step) : step;
        for (const c of [col, col - 1]) {
          if (!reserved[row][c]) {
            const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
            matrix[row][c] = bit === 1;
          }
        }
      }
      upward = !upward;
    }
  }

  function maskCondition(pattern, r, c) {
    switch (pattern) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return false;
    }
  }

  function writeFormatBits(matrix, eccLevel, maskPattern) {
    const size = matrix.length;
    const formatBits = computeFormatBits(eccLevel, maskPattern);

    // Top-left copy (0..14)
    let idx = 0;
    for (let c = 0; c <= 8; c++) {
      if (c !== 6) matrix[8][c] = formatBits[idx++] === 1;
    }
    for (let r = 7; r >= 0; r--) {
      if (r !== 6) matrix[r][8] = formatBits[idx++] === 1;
    }

    // Bottom-left (0..6) & Top-right (7..14); preserve dark module at (size - 8, 8)
    for (let i = 0; i < 7; i++) {
      matrix[size - 1 - i][8] = formatBits[i] === 1;
    }
    matrix[size - 8][8] = true;
    for (let i = 0; i < 8; i++) {
      matrix[8][size - 8 + i] = formatBits[7 + i] === 1;
    }
  }

  function scoreMaskPenalty(matrix) {
    const size = matrix.length;
    let penalty = 0;

    // Rule 1: 5+ consecutive modules in a line
    for (let r = 0; r < size; r++) {
      let runLen = 1;
      for (let c = 1; c < size; c++) {
        if (matrix[r][c] === matrix[r][c - 1]) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }
    for (let c = 0; c < size; c++) {
      let runLen = 1;
      for (let r = 1; r < size; r++) {
        if (matrix[r][c] === matrix[r - 1][c]) {
          runLen++;
        } else {
          if (runLen >= 5) penalty += 3 + (runLen - 5);
          runLen = 1;
        }
      }
      if (runLen >= 5) penalty += 3 + (runLen - 5);
    }

    // Rule 2: 2x2 blocks of same color
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = matrix[r][c];
        if (v === matrix[r][c + 1] && v === matrix[r + 1][c] && v === matrix[r + 1][c + 1]) {
          penalty += 3;
        }
      }
    }

    // Rule 3: Finder-like 1:1:3:1:1 pattern followed or preceded by 4 light modules
    function hasFinderPattern(arr, i) {
      return (
        i + 10 < arr.length &&
        ((arr[i] && !arr[i + 1] && arr[i + 2] && arr[i + 3] && arr[i + 4] && !arr[i + 5] && arr[i + 6] && !arr[i + 7] && !arr[i + 8] && !arr[i + 9] && !arr[i + 10]) ||
         (!arr[i] && !arr[i + 1] && !arr[i + 2] && !arr[i + 3] && arr[i + 4] && !arr[i + 5] && arr[i + 6] && arr[i + 7] && arr[i + 8] && !arr[i + 9] && arr[i + 10]))
      );
    }
    for (let r = 0; r < size; r++) {
      for (let c = 0; c <= size - 11; c++) {
        if (hasFinderPattern(matrix[r], c)) penalty += 40;
      }
    }
    const colBuf = new Array(size);
    for (let c = 0; c < size; c++) {
      for (let r = 0; r < size; r++) colBuf[r] = matrix[r][c];
      for (let r = 0; r <= size - 11; r++) {
        if (hasFinderPattern(colBuf, r)) penalty += 40;
      }
    }

    // Rule 4: Dark/Light ratio balance
    let darkCount = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (matrix[r][c]) darkCount++;
      }
    }
    const darkPercent = (darkCount * 100) / (size * size);
    const fiveStep = Math.floor(Math.abs(darkPercent - 50) / 5);
    penalty += fiveStep * 10;

    return penalty;
  }

  function createMatrix(spec, codewords) {
    const { matrix: base, reserved } = buildBaseMatrix(spec);
    placeDataBits(base, reserved, codewords);

    let bestMatrix = null;
    let bestScore = Infinity;
    const size = spec.size;

    for (let mask = 0; mask < 8; mask++) {
      const candidate = base.map((row, r) =>
        row.map((val, c) => (reserved[r][c] ? val : (maskCondition(mask, r, c) ? !val : val)))
      );
      writeFormatBits(candidate, spec.level, mask);
      const score = scoreMaskPenalty(candidate);
      if (score < bestScore) {
        bestScore = score;
        bestMatrix = candidate;
      }
    }

    return bestMatrix;
  }

  const QRCodeGenerator = {
    generateMatrix: function(text, options = {}) {
      const utf8Bytes = toUTF8Bytes(text);
      const minVersion = options.minVersion || 1;
      const spec = getBestSpec(utf8Bytes.length, minVersion);
      const codewords = encodeData(utf8Bytes, spec);
      return createMatrix(spec, codewords);
    },

    getSpecForText: function(text, options = {}) {
      const utf8Bytes = toUTF8Bytes(text);
      return getBestSpec(utf8Bytes.length, options.minVersion || 1);
    },

    renderToCanvas: function(canvas, text, options = {}) {
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      const utf8Bytes = toUTF8Bytes(text);
      const wantLogo = options.includeLogo !== false;

      // For branded center logo, require Version >= 3 (29x29) with ECC Level H
      const spec = getBestSpec(utf8Bytes.length, wantLogo ? 3 : 1);
      const codewords = encodeData(utf8Bytes, spec);
      const matrix = createMatrix(spec, codewords);
      const moduleCount = matrix.length;

      const size = options.size || canvas.width || 220;
      canvas.width = size;
      canvas.height = size;

      // ISO/IEC 18004 standard minimum quiet zone is 4 modules
      const quietZone = options.quietZone !== undefined ? options.quietZone : 4;
      const totalModules = moduleCount + quietZone * 2;

      // Crisp white/light background
      ctx.fillStyle = options.bgColor || '#ffffff';
      ctx.fillRect(0, 0, size, size);

      // Use uniform integer pixel module size when canvas fits cleanly, eliminating alternating 3px/4px jitter
      const useIntegerGrid = size >= totalModules;
      const modPx = useIntegerGrid ? Math.floor(size / totalModules) : 0;
      const usedSize = useIntegerGrid ? modPx * moduleCount : 0;
      const margin = useIntegerGrid ? Math.floor((size - usedSize) / 2) : 0;

      ctx.fillStyle = options.darkColor || '#1b1c1a';
      if (useIntegerGrid) {
        for (let r = 0; r < moduleCount; r++) {
          const y = margin + r * modPx;
          for (let c = 0; c < moduleCount; c++) {
            if (matrix[r][c]) {
              ctx.fillRect(margin + c * modPx, y, modPx, modPx);
            }
          }
        }
      } else {
        const cellSize = size / totalModules;
        for (let r = 0; r < moduleCount; r++) {
          const y0 = Math.floor((r + quietZone) * cellSize);
          const y1 = Math.floor((r + quietZone + 1) * cellSize);
          const h = Math.max(1, y1 - y0);
          for (let c = 0; c < moduleCount; c++) {
            if (matrix[r][c]) {
              const x0 = Math.floor((c + quietZone) * cellSize);
              const x1 = Math.floor((c + quietZone + 1) * cellSize);
              const w = Math.max(1, x1 - x0);
              ctx.fillRect(x0, y0, w, h);
            }
          }
        }
      }

      // Draw compact center badge only when Level H is active and matrix is >= 29x29
      if (wantLogo && spec.level === 'H' && moduleCount >= 29) {
        const refSize = useIntegerGrid ? usedSize : size;
        const logoRadius = Math.max(10, Math.floor(refSize * 0.095));
        const haloPad = Math.max(2, Math.round(refSize * 0.012));
        const centerX = useIntegerGrid ? (margin + usedSize / 2) : (size / 2);
        const centerY = useIntegerGrid ? (margin + usedSize / 2) : (size / 2);

        // Clean white halo
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoRadius + haloPad, 0, Math.PI * 2);
        ctx.fill();

        // Branded circle (#835500)
        ctx.fillStyle = options.logoBgColor || '#835500';
        ctx.beginPath();
        ctx.arc(centerX, centerY, logoRadius, 0, Math.PI * 2);
        ctx.fill();

        // Gold border (#f5a623)
        ctx.strokeStyle = options.logoBorderColor || '#f5a623';
        ctx.lineWidth = Math.max(1.5, refSize * 0.01);
        ctx.stroke();

        // Center emblem text
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(7, Math.round(logoRadius * 0.6))}px "Be Vietnam Pro", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(options.logoText || 'CÔ TƯ', centerX, centerY + 0.5);
      }

      return canvas;
    }
  };

  global.QRCodeGenerator = QRCodeGenerator;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QRCodeGenerator;
  }
})(typeof window !== 'undefined' ? window : global);
