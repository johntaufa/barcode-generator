const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  L_PATTERNS, R_PATTERNS, G_PATTERNS, PARITY_PATTERNS,
  cleanISBN, isbn10to13, validateISBN13, validateISBN10, encodeEAN13
} = require('./barcode.js');

// ---------------------------------------------------------------------------
// Reference EAN-13 encoding tables (from ISO/IEC 7093 / GS1 General Spec)
// ---------------------------------------------------------------------------
const SPEC_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011'
];
const SPEC_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100'
];
const SPEC_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111'
];
const SPEC_PARITY = [
  'LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG',
  'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'
];

// ---------------------------------------------------------------------------
// Helper: decode an EAN-13 bar array back to its 13 digits
// ---------------------------------------------------------------------------
function decodeEAN13(bars) {
  assert.equal(bars.length, 95, 'EAN-13 must be 95 modules');

  // Start guard
  assert.deepEqual(bars.slice(0, 3), [1, 0, 1], 'start guard');
  // Center guard
  assert.deepEqual(bars.slice(45, 50), [0, 1, 0, 1, 0], 'center guard');
  // End guard
  assert.deepEqual(bars.slice(92, 95), [1, 0, 1], 'end guard');

  // Decode right side first (always R-encoded) to get digits 7-12
  const rightDigits = [];
  for (let i = 0; i < 6; i++) {
    const pattern = bars.slice(50 + i * 7, 50 + i * 7 + 7);
    const key = pattern.join('');
    const digit = SPEC_R.indexOf(key);
    assert.notEqual(digit, -1, `right digit ${i} pattern ${key} must be valid R-code`);
    rightDigits.push(digit);
  }

  // Decode left side — each can be L or G encoded
  const leftDigits = [];
  const paritySeq = [];
  for (let i = 0; i < 6; i++) {
    const pattern = bars.slice(3 + i * 7, 3 + i * 7 + 7);
    const key = pattern.join('');
    let digit = SPEC_L.indexOf(key);
    if (digit !== -1) {
      paritySeq.push('L');
    } else {
      digit = SPEC_G.indexOf(key);
      assert.notEqual(digit, -1, `left digit ${i} pattern ${key} must be valid L or G code`);
      paritySeq.push('G');
    }
    leftDigits.push(digit);
  }

  // Derive the leading digit from the parity pattern
  const parityStr = paritySeq.join('');
  const leadDigit = SPEC_PARITY.indexOf(parityStr);
  assert.notEqual(leadDigit, -1, `parity pattern ${parityStr} must be valid`);

  return [leadDigit, ...leftDigits, ...rightDigits].join('');
}

// =====================================================================
// Tests
// =====================================================================

describe('encoding tables match EAN-13 / GS1 specification', () => {
  it('L-code patterns match spec', () => {
    for (let d = 0; d <= 9; d++) {
      assert.equal(L_PATTERNS[d].join(''), SPEC_L[d],
        `L-pattern for digit ${d}`);
    }
  });

  it('R-code patterns match spec', () => {
    for (let d = 0; d <= 9; d++) {
      assert.equal(R_PATTERNS[d].join(''), SPEC_R[d],
        `R-pattern for digit ${d}`);
    }
  });

  it('G-code patterns match spec', () => {
    for (let d = 0; d <= 9; d++) {
      assert.equal(G_PATTERNS[d].join(''), SPEC_G[d],
        `G-pattern for digit ${d}`);
    }
  });

  it('parity patterns match spec', () => {
    assert.deepEqual(PARITY_PATTERNS, SPEC_PARITY);
  });

  it('R = bitwise complement of L', () => {
    for (let d = 0; d <= 9; d++) {
      const flipped = L_PATTERNS[d].map(b => b ^ 1);
      assert.deepEqual(R_PATTERNS[d], flipped, `R[${d}] = ~L[${d}]`);
    }
  });

  it('G = reverse of R', () => {
    for (let d = 0; d <= 9; d++) {
      const reversed = [...R_PATTERNS[d]].reverse();
      assert.deepEqual(G_PATTERNS[d], reversed, `G[${d}] = reverse(R[${d}])`);
    }
  });

  it('every L-code starts with 0, every R-code starts with 1', () => {
    for (let d = 0; d <= 9; d++) {
      assert.equal(L_PATTERNS[d][0], 0, `L[${d}] starts with 0`);
      assert.equal(R_PATTERNS[d][0], 1, `R[${d}] starts with 1`);
    }
  });

  it('each pattern is exactly 7 modules', () => {
    for (let d = 0; d <= 9; d++) {
      assert.equal(L_PATTERNS[d].length, 7);
      assert.equal(R_PATTERNS[d].length, 7);
      assert.equal(G_PATTERNS[d].length, 7);
    }
  });
});

describe('cleanISBN', () => {
  it('removes hyphens', () => {
    assert.equal(cleanISBN('978-0-306-40615-7'), '9780306406157');
  });

  it('removes spaces', () => {
    assert.equal(cleanISBN('978 0 306 40615 7'), '9780306406157');
  });

  it('removes mixed hyphens and spaces', () => {
    assert.equal(cleanISBN('978-0 306-40615 7'), '9780306406157');
  });

  it('returns unchanged string with no separators', () => {
    assert.equal(cleanISBN('9780306406157'), '9780306406157');
  });

  it('returns empty string for empty input', () => {
    assert.equal(cleanISBN(''), '');
  });
});

describe('validateISBN10', () => {
  it('accepts valid ISBN-10 numbers', () => {
    // "The C Programming Language" — Kernighan & Ritchie
    assert.equal(validateISBN10('0131103628'), true);
    // "Design Patterns" — Gang of Four
    assert.equal(validateISBN10('0201633612'), true);
    // ISBN-10 ending in X (check digit = 10)
    assert.equal(validateISBN10('080442957X'), true);
    // lowercase x
    assert.equal(validateISBN10('080442957x'), true);
  });

  it('rejects ISBN-10 with wrong checksum', () => {
    assert.equal(validateISBN10('0131103629'), false);
  });

  it('rejects strings that are not 10 characters', () => {
    assert.equal(validateISBN10('978030640'), false);
    assert.equal(validateISBN10('01311036281'), false);
  });

  it('rejects non-numeric characters (except trailing X)', () => {
    assert.equal(validateISBN10('01311X3628'), false);
    assert.equal(validateISBN10('abcdefghij'), false);
  });
});

describe('validateISBN13', () => {
  it('accepts valid ISBN-13 numbers', () => {
    assert.equal(validateISBN13('9780306406157'), true);
    // "Sapiens" by Yuval Noah Harari
    assert.equal(validateISBN13('9780062316097'), true);
    // 979 prefix
    assert.equal(validateISBN13('9791034206681'), true);
  });

  it('rejects ISBN-13 with wrong checksum', () => {
    assert.equal(validateISBN13('9780306406158'), false);
    assert.equal(validateISBN13('9780306406150'), false);
  });

  it('rejects strings that are not 13 digits', () => {
    assert.equal(validateISBN13('978030640615'), false);
    assert.equal(validateISBN13('97803064061571'), false);
  });

  it('rejects non-numeric input', () => {
    assert.equal(validateISBN13('978030640615X'), false);
  });
});

describe('isbn10to13', () => {
  it('converts known ISBN-10 to correct ISBN-13', () => {
    // 0306406152 -> 9780306406157
    assert.equal(isbn10to13('0306406152'), '9780306406157');
    assert.equal(isbn10to13('0131103628'), '9780131103627');
    assert.equal(isbn10to13('0201633612'), '9780201633610');
  });

  it('converts ISBN-10 ending in X', () => {
    // Only the first 9 digits are used; the check digit is recalculated
    assert.equal(isbn10to13('080442957X'), '9780804429573');
  });

  it('produces a valid ISBN-13', () => {
    const inputs = ['0306406152', '0131103628', '080442957X', '0201633612'];
    for (const isbn10 of inputs) {
      const isbn13 = isbn10to13(isbn10);
      assert.equal(isbn13.length, 13, `${isbn10} -> length 13`);
      assert.equal(validateISBN13(isbn13), true, `${isbn10} -> valid ISBN-13`);
      assert.ok(isbn13.startsWith('978'), `${isbn10} -> starts with 978`);
    }
  });
});

describe('encodeEAN13 — structural validity', () => {
  it('produces exactly 95 modules', () => {
    assert.equal(encodeEAN13('9780306406157').length, 95);
  });

  it('has correct start guard [1,0,1]', () => {
    const bars = encodeEAN13('9780306406157');
    assert.deepEqual(bars.slice(0, 3), [1, 0, 1]);
  });

  it('has correct center guard [0,1,0,1,0]', () => {
    const bars = encodeEAN13('9780306406157');
    assert.deepEqual(bars.slice(45, 50), [0, 1, 0, 1, 0]);
  });

  it('has correct end guard [1,0,1]', () => {
    const bars = encodeEAN13('9780306406157');
    assert.deepEqual(bars.slice(92, 95), [1, 0, 1]);
  });

  it('contains only 0s and 1s', () => {
    const bars = encodeEAN13('9780306406157');
    assert.ok(bars.every(b => b === 0 || b === 1));
  });
});

describe('encodeEAN13 — round-trip decoding', () => {
  const testISBNs = [
    '9780306406157',  // standard 978 ISBN
    '9780131103627',  // leading digit 9, different parity
    '9780201633610',  // another 978
    '9791034206681',  // 979 prefix
    '9780062316097',  // "Sapiens"
    '9780000000000',  // edge: all zeros after prefix
    '9780123456786',  // sequential digits
  ];

  for (const isbn of testISBNs) {
    it(`encode then decode recovers ${isbn}`, () => {
      const bars = encodeEAN13(isbn);
      const decoded = decodeEAN13(bars);
      assert.equal(decoded, isbn);
    });
  }
});

describe('encodeEAN13 — reference barcode verification', () => {
  // Known-good EAN-13 encoding for "5901234123457" from GS1 spec examples.
  // This is the classic reference barcode used in EAN-13 documentation.
  it('encodes 5901234123457 correctly per GS1 reference', () => {
    const isbn = '5901234123457';
    const bars = encodeEAN13(isbn);

    // First digit is 5 → parity LGGLLG
    // Digits: 5 | 9 0 1 2 3 4 | 1 2 3 4 5 7
    // Left side: 9(L) 0(G) 1(G) 2(L) 3(L) 4(G)
    // Right side: 1(R) 2(R) 3(R) 4(R) 5(R) 7(R)

    const expected =
      '101' +                   // start
      SPEC_L[9] +               // 9 L-code
      SPEC_G[0] +               // 0 G-code
      SPEC_G[1] +               // 1 G-code
      SPEC_L[2] +               // 2 L-code
      SPEC_L[3] +               // 3 L-code
      SPEC_G[4] +               // 4 G-code
      '01010' +                 // center
      SPEC_R[1] +               // 1 R-code
      SPEC_R[2] +               // 2 R-code
      SPEC_R[3] +               // 3 R-code
      SPEC_R[4] +               // 4 R-code
      SPEC_R[5] +               // 5 R-code
      SPEC_R[7] +               // 7 R-code
      '101';                    // end

    assert.equal(bars.join(''), expected);
  });

  // Another well-known reference: "4006381333931" (common GS1 test EAN)
  it('encodes 4006381333931 correctly', () => {
    const bars = encodeEAN13('4006381333931');
    const decoded = decodeEAN13(bars);
    assert.equal(decoded, '4006381333931');
    assert.equal(bars.length, 95);
  });
});

describe('encodeEAN13 — leading digit determines parity', () => {
  // For each possible leading digit (0-9), verify the left-side
  // encoding uses the correct L/G parity pattern
  for (let lead = 0; lead <= 9; lead++) {
    it(`leading digit ${lead} uses parity ${SPEC_PARITY[lead]}`, () => {
      // Build a dummy valid-structure EAN (checksum doesn't matter for encoding)
      const digits = lead + '000000000000';
      // Recalculate check digit so it's valid
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(digits[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      const ean = digits.slice(0, 12) + check;

      const bars = encodeEAN13(ean);
      // Decode to verify the parity pattern was applied correctly
      const decoded = decodeEAN13(bars);
      assert.equal(decoded, ean);
    });
  }
});

describe('encodeEAN13 — every digit 0-9 encodes correctly in each position', () => {
  // Verify each digit encodes/decodes correctly in right-side positions
  for (let d = 0; d <= 9; d++) {
    it(`digit ${d} round-trips in right-side position`, () => {
      // Place digit d at position 12 (last data digit before check)
      const base = '978000000' + d.toString().padStart(2, '0') + '0';
      let sum = 0;
      for (let i = 0; i < 12; i++) {
        sum += parseInt(base[i]) * (i % 2 === 0 ? 1 : 3);
      }
      const check = (10 - (sum % 10)) % 10;
      const ean = base.slice(0, 12) + check;
      const bars = encodeEAN13(ean);
      assert.equal(decodeEAN13(bars), ean);
    });
  }
});
