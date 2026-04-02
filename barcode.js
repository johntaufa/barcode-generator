const L_PATTERNS = [
  [0,0,0,1,1,0,1], [0,0,1,1,0,0,1], [0,0,1,0,0,1,1], [0,1,1,1,1,0,1],
  [0,1,0,0,0,1,1], [0,1,1,0,0,0,1], [0,1,0,1,1,1,1], [0,1,1,1,0,1,1],
  [0,1,1,0,1,1,1], [0,0,0,1,0,1,1]
];
const R_PATTERNS = L_PATTERNS.map(p => p.map(b => b ^ 1));
const G_PATTERNS = R_PATTERNS.map(p => [...p].reverse());

const PARITY_PATTERNS = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

function cleanISBN(raw) {
  return raw.replace(/[\s-]/g, '');
}

function isbn10to13(isbn10) {
  const base = '978' + isbn10.substring(0, 9);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return base + check;
}

function validateISBN13(isbn) {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(isbn[i]) * (i % 2 === 0 ? 1 : 3);
  }
  const check = (10 - (sum % 10)) % 10;
  return check === parseInt(isbn[12]);
}

function validateISBN10(isbn) {
  if (!/^\d{9}[\dXx]$/.test(isbn)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(isbn[i]) * (10 - i);
  }
  const last = isbn[9].toUpperCase() === 'X' ? 10 : parseInt(isbn[9]);
  sum += last;
  return sum % 11 === 0;
}

function encodeEAN13(digits) {
  const bars = [];
  // Start guard
  bars.push(1, 0, 1);

  const parityPattern = PARITY_PATTERNS[parseInt(digits[0])];
  // Left 6 digits
  for (let i = 0; i < 6; i++) {
    const d = parseInt(digits[i + 1]);
    const pattern = parityPattern[i] === 'L' ? L_PATTERNS[d] : G_PATTERNS[d];
    bars.push(...pattern);
  }

  // Center guard
  bars.push(0, 1, 0, 1, 0);

  // Right 6 digits
  for (let i = 0; i < 6; i++) {
    const d = parseInt(digits[i + 7]);
    bars.push(...R_PATTERNS[d]);
  }

  // End guard
  bars.push(1, 0, 1);

  return bars;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    L_PATTERNS, R_PATTERNS, G_PATTERNS, PARITY_PATTERNS,
    cleanISBN, isbn10to13, validateISBN13, validateISBN10, encodeEAN13
  };
}
