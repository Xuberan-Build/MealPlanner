/**
 * parseAmount(value) -> { value, min?, max?, isToTaste, raw, rest }
 *
 * - value: number|null. Never NaN/Infinity. For ranges value = max (min/max also set).
 * - isToTaste: true for "", null, "to taste", "a pinch", "as needed", "optional", ...
 *   (value is null in that case).
 * - raw: the original input as a string.
 * - rest: lowercased text that followed the leading amount ("3/4 cup" -> rest "cup").
 *
 * An input that is non-empty, not a to-taste phrase and not parseable ("abc", "1/0")
 * yields { value: null, isToTaste: false } - consumers should display `raw` for it.
 */

export const UNICODE_FRACTIONS = {
  '¼': '1/4', '½': '1/2', '¾': '3/4',
  '⅐': '1/7', '⅑': '1/9', '⅒': '1/10',
  '⅓': '1/3', '⅔': '2/3',
  '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
  '⅙': '1/6', '⅚': '5/6',
  '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8',
  '↉': '0/3',
};

const UNICODE_FRACTION_RE = new RegExp(`[${Object.keys(UNICODE_FRACTIONS).join('')}]`, 'g');

const TO_TASTE_LEADING_RE = /^(to taste|as needed|as desired|as required|if desired|optional|a pinch|pinch|a dash|dash|a few|few|some|a handful|handful|a little|little|a splash|splash|a drizzle|drizzle|for garnish|garnish|for serving|to serve|for frying|q ?s|n\/a|na)(\b|$)|^-+$/;
const TO_TASTE_ANYWHERE_RE = /\b(to taste|as needed|as desired|optional|pinch|dash|handful|splash|drizzle|garnish)\b/;

const LEADING_QUALIFIER_RE = /^(about|approximately|approx|around|roughly|scant|heaping|heaped|generous|up to|~|≈)\s*/;

const NUM = '(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d*\\.\\d+|\\d+)';
const LEADING_AMOUNT_RE = new RegExp(`^${NUM}(?:\\s*(?:-|\\bto\\b|\\bor\\b)\\s*${NUM})?`);

const NUMBER_WORDS = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, fifteen: 15, twenty: 20,
};

function round6(n) {
  return Math.round(n * 1e6) / 1e6;
}

/** Converts a single numeric token ("2", "1.5", "1/2", "2 1/2") to a number or null. */
function tokenToNumber(token) {
  const t = token.trim();
  const mixed = t.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const den = Number(mixed[3]);
    if (den === 0) return null;
    return Number(mixed[1]) + Number(mixed[2]) / den;
  }
  const frac = t.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const den = Number(frac[2]);
    if (den === 0) return null;
    return Number(frac[1]) / den;
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function preprocess(str) {
  let s = String(str)
    .replace(UNICODE_FRACTION_RE, (ch) => ` ${UNICODE_FRACTIONS[ch]} `)
    .replace(/⁄/g, '/') // fraction slash
    .replace(/[‒–—―−]/g, '-') // dashes / minus
    .toLowerCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
  // Thousands separators: "1,000" -> "1000", "12,500,000" -> "12500000".
  s = s.replace(/(^|[^\d.,])(\d{1,3}(?:,\d{3})+)(?![\d,])/g, (m, pre, num) => `${pre}${num.replace(/,/g, '')}`);
  // Decimal comma: "1,5 kg" -> "1.5 kg" (one or two digits after the comma).
  s = s.replace(/(^|[^\d.,])(\d+),(\d{1,2})(?![\d,])/g, '$1$2.$3');
  // "1 and 1/2" -> mixed number "1 1/2".
  s = s.replace(/(\d+)\s+and\s+(\d+\/\d+)/g, '$1 $2');
  // "2-1/2" (whole-hyphen-proper-fraction) is a mixed number, not a range.
  s = s.replace(/(^|[^/\d.])(\d+)\s*-\s*(\d+)\/(\d+)/g, (m, pre, w, n, d) =>
    (Number(n) < Number(d) ? `${pre}${w} ${n}/${d}` : m));
  return s;
}

/** Parses leading number words. Returns { value, consumed } or null. */
function parseNumberWords(s) {
  const words = s.split(' ');
  let i = 0;
  let val = null;

  if (NUMBER_WORDS[words[i]] !== undefined) {
    val = NUMBER_WORDS[words[i]];
    i += 1;
  }
  // "one and a half", "two and a half"
  if (val !== null && words[i] === 'and' && (words[i + 1] === 'a' || words[i + 1] === 'an') && words[i + 2] === 'half') {
    val += 0.5;
    i += 3;
  }
  if (words[i] === 'half' || words[i] === 'quarter') {
    const f = words[i] === 'half' ? 0.5 : 0.25;
    // "a half" / "half" -> 0.5 ; "two half" is nonsense -> still f * val
    val = val === null || words[i - 1] === 'a' || words[i - 1] === 'an' ? f : val * f;
    i += 1;
    if (words[i] === 'a' || words[i] === 'an' || words[i] === 'of') i += 1;
  }
  if (words[i] === 'couple') {
    val = 2;
    i += 1;
    if (words[i] === 'of') i += 1;
  }
  if (words[i] === 'dozen') {
    val = (val === null ? 1 : val) * 12;
    i += 1;
  }
  if (val === null) return null;
  return { value: val, consumed: words.slice(0, i).join(' ').length };
}

export function parseAmount(input) {
  // Already-parsed object (idempotent)
  if (input && typeof input === 'object' && 'isToTaste' in input && 'raw' in input) {
    return input;
  }

  if (typeof input === 'number') {
    const ok = Number.isFinite(input) && input >= 0;
    return {
      value: ok ? round6(input) : null,
      isToTaste: false,
      raw: String(input),
      rest: '',
    };
  }

  const raw = input === null || input === undefined ? '' : String(input);
  const s0 = preprocess(raw);

  if (s0 === '') {
    return { value: null, isToTaste: true, raw, rest: '' };
  }
  if (TO_TASTE_LEADING_RE.test(s0)) {
    return { value: null, isToTaste: true, raw, rest: s0 };
  }

  const s = s0.replace(LEADING_QUALIFIER_RE, '');

  const m = s.match(LEADING_AMOUNT_RE);
  if (m) {
    let rest = s.slice(m[0].length).trim();
    let a = tokenToNumber(m[1]);
    let b = m[2] !== undefined ? tokenToNumber(m[2]) : undefined;

    let multiplier = 1;
    if (/^dozen\b/.test(rest)) {
      multiplier = 12;
      rest = rest.replace(/^dozen\b\s*/, '');
    }

    if (a === null || b === null) {
      return { value: null, isToTaste: false, raw, rest };
    }
    a *= multiplier;
    if (b !== undefined) {
      b *= multiplier;
      const min = round6(Math.min(a, b));
      const max = round6(Math.max(a, b));
      return { value: max, min, max, isToTaste: false, raw, rest };
    }
    return { value: round6(a), isToTaste: false, raw, rest };
  }

  const words = parseNumberWords(s);
  if (words) {
    const rest = s.slice(words.consumed).trim();
    return { value: round6(words.value), isToTaste: false, raw, rest };
  }

  if (TO_TASTE_ANYWHERE_RE.test(s)) {
    return { value: null, isToTaste: true, raw, rest: s };
  }

  return { value: null, isToTaste: false, raw, rest: s };
}
