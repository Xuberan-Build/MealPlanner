/**
 * Smart diet type autocomplete (pure).
 *
 * Ranking: exact > alias > prefix > word-start > substring > fuzzy
 * (Damerau-Levenshtein / optimal string alignment, <= 1 edit for terms up to 5 letters,
 * <= 2 for longer ones). A near miss with nothing better ("vegatarian", "glutn free")
 * becomes `didYouMean`, so the UI can offer the existing type instead of creating a
 * duplicate. "Create" is offered only when nothing is close.
 */
import {
  CANONICAL_DIET_TYPES,
  canonicalDietType,
  compactDietText,
  dietTypeKey,
  dietTypeText,
  getDietTypeAliases,
  looseDietText,
} from './normalize';

export const DEFAULT_SUGGESTION_LIMIT = 8;

const SCORES = {
  exact: 100,
  alias: 90,
  prefix: 80,
  aliasPrefix: 75,
  wordStart: 70,
  substring: 60,
  fuzzy: 50,
  fuzzyPrefix: 35,
};

/** Reasons that mean "the user is clearly typing this one" (auto-highlight in the UI). */
export const STRONG_REASONS = Object.freeze(['exact', 'alias', 'prefix']);

/**
 * Damerau-Levenshtein distance (optimal string alignment: insert, delete, substitute,
 * swap adjacent letters).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function damerauLevenshtein(a, b) {
  const s = String(a ?? '');
  const t = String(b ?? '');
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const rows = s.length + 1;
  const cols = t.length + 1;
  const d = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[s.length][t.length];
}

/** Max typo distance allowed for a query of this (compact) length. */
export const maxTypoDistance = (length) => (length < 3 ? 0 : length <= 5 ? 1 : 2);

function buildCandidates(knownTypes, { includeCanonical, canonicalize }) {
  const keyOf = canonicalize ? dietTypeKey : compactDietText;
  const byKey = new Map();
  const add = (raw, source) => {
    const text = dietTypeText(raw).replace(/\s+/g, ' ').trim();
    const name = canonicalize ? canonicalDietType(text) : text;
    if (!name) return;
    const key = keyOf(name);
    if (!key) return;
    const existing = byKey.get(key);
    if (existing) {
      if (source === 'user') existing.fromUser = true;
      return;
    }
    byKey.set(key, {
      name,
      key,
      compact: compactDietText(name),
      loose: looseDietText(name),
      aliases: canonicalize ? getDietTypeAliases(name) : [],
      fromUser: source === 'user',
    });
  };
  // Canonical names first so their spelling wins over a user's variant of the same key.
  if (includeCanonical) CANONICAL_DIET_TYPES.forEach((name) => add(name, 'canonical'));
  (Array.isArray(knownTypes) ? knownTypes : []).forEach((t) => add(t, 'user'));
  return [...byKey.values()];
}

function scoreCandidate(q, cand, useAliases) {
  if (cand.compact === q.compact) return { reason: 'exact', score: SCORES.exact };
  if (useAliases && q.key && q.key === cand.key) return { reason: 'alias', score: SCORES.alias };
  if (cand.loose.startsWith(q.loose) || cand.compact.startsWith(q.compact)) {
    return { reason: 'prefix', score: SCORES.prefix };
  }
  if (useAliases && q.compact.length >= 2 && cand.aliases.some((a) => a.startsWith(q.compact))) {
    return { reason: 'alias', score: SCORES.aliasPrefix };
  }
  if (cand.loose.split(' ').some((w) => w.startsWith(q.loose)) || cand.loose.includes(` ${q.loose}`)) {
    return { reason: 'word-start', score: SCORES.wordStart };
  }
  if (cand.loose.includes(q.loose) || cand.compact.includes(q.compact)) {
    return { reason: 'substring', score: SCORES.substring };
  }
  const max = maxTypoDistance(q.compact.length);
  if (max > 0) {
    const targets = useAliases ? [cand.compact, ...cand.aliases] : [cand.compact];
    let best = Infinity;
    for (const target of targets) {
      if (Math.abs(target.length - q.compact.length) > max) continue;
      best = Math.min(best, damerauLevenshtein(q.compact, target));
    }
    if (best <= max) return { reason: 'fuzzy', score: SCORES.fuzzy - best * 5, distance: best };
    // Typo while still typing: "vegt" -> "vege(tarian)".
    if (q.compact.length >= 4 && cand.compact.length > q.compact.length &&
      damerauLevenshtein(q.compact, cand.compact.slice(0, q.compact.length)) <= 1) {
      return { reason: 'fuzzy', score: SCORES.fuzzyPrefix, distance: 1, partial: true };
    }
  }
  return null;
}

const byRank = (a, b) =>
  b.score - a.score ||
  (b.fromUser ? 1 : 0) - (a.fromUser ? 1 : 0) ||
  a.name.length - b.name.length ||
  a.name.localeCompare(b.name);

/**
 * Autocomplete diet types.
 *
 * @param {string} query - What the user typed.
 * @param {Array<string|{name: string}>} knownTypes - The user's types (strings or objects).
 * @param {object} [options]
 * @param {number} [options.limit=8] - Max matched suggestions (the create item is extra).
 * @param {boolean} [options.includeCanonical=true] - Also suggest the curated diet list.
 * @param {boolean} [options.canonicalize=true] - Canonical names + alias matching. Pass
 *   false for non-diet lists (e.g. meal types) to get plain ranked autocomplete.
 * @returns {{
 *   suggestions: Array<{name: string, reason: string, isNew: boolean}>,
 *   didYouMean: string|null,
 *   exactMatch: string|null,
 *   showCreate: boolean,
 *   createName: string|null,
 * }}
 *   `suggestions` ends with a `{ isNew: true, reason: 'new' }` item when `showCreate`.
 */
export function suggestDietTypes(query, knownTypes = [], options = {}) {
  const {
    limit = DEFAULT_SUGGESTION_LIMIT,
    includeCanonical = true,
    canonicalize = true,
  } = options;
  const candidates = buildCandidates(knownTypes, { includeCanonical, canonicalize });
  const text = String(query ?? '').replace(/\s+/g, ' ').trim();
  const max = Number.isFinite(limit) && limit >= 0 ? limit : Infinity;

  const empty = { suggestions: [], didYouMean: null, exactMatch: null, showCreate: false, createName: null };
  if (!text) {
    return {
      ...empty,
      suggestions: candidates
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, max)
        .map((c) => ({ name: c.name, reason: 'all', isNew: false })),
    };
  }

  const q = {
    compact: compactDietText(text),
    loose: looseDietText(text) || text.toLowerCase(),
    key: canonicalize ? dietTypeKey(text) : compactDietText(text),
  };
  const createName = canonicalize ? canonicalDietType(text) : text;

  const ranked = [];
  for (const cand of candidates) {
    const match = scoreCandidate(q, cand, canonicalize);
    if (match) ranked.push({ ...cand, ...match });
  }
  ranked.sort(byRank);

  const exact = ranked.find((r) => r.reason === 'exact' || (r.reason === 'alias' && r.score === SCORES.alias));
  const hasPrefix = ranked.some((r) => r.reason === 'prefix' || r.reason === 'alias');
  const typo = !exact && !hasPrefix ? ranked.find((r) => r.reason === 'fuzzy' && !r.partial) : null;
  const isClose = Boolean(exact || hasPrefix || typo);
  const showCreate = Boolean(createName) && !isClose;

  const suggestions = ranked.slice(0, max).map((r) => ({ name: r.name, reason: r.reason, isNew: false }));
  if (showCreate) suggestions.push({ name: createName, reason: 'new', isNew: true });

  return {
    suggestions,
    didYouMean: typo ? typo.name : null,
    exactMatch: exact ? exact.name : null,
    showCreate,
    createName: createName || null,
  };
}

/**
 * Rank and filter a list of diet types (strings or { name } objects) by a search term,
 * returning the original items (best first). Empty term returns the list unchanged.
 * Used by dietTypeService.searchDietTypes.
 * @param {string} term
 * @param {Array<string|{name: string}>} items
 * @returns {Array}
 */
export function searchDietTypeItems(term, items) {
  const list = Array.isArray(items) ? items : [];
  if (!String(term ?? '').trim()) return list;
  const { suggestions } = suggestDietTypes(term, list, { limit: Infinity, includeCanonical: false });
  const order = new Map(suggestions.filter((s) => !s.isNew).map((s, i) => [dietTypeKey(s.name), i]));
  return list
    .map((item) => ({ item, rank: order.get(dietTypeKey(item)) }))
    .filter((x) => x.rank !== undefined)
    .sort((a, b) => a.rank - b.rank)
    .map((x) => x.item);
}

/**
 * Split a name into highlighted / plain segments for the part matching the query
 * (case- and accent-insensitive; hyphens and spaces are interchangeable).
 * @param {string} name
 * @param {string} query
 * @returns {Array<{text: string, match: boolean}>}
 */
export function highlightMatch(name, query) {
  const text = String(name ?? '');
  const q = looseDietText(query);
  if (!q || !text) return [{ text, match: false }];
  // Map each char of the loose form back to an index in `text`.
  const looseChars = [];
  const map = [];
  for (let i = 0; i < text.length; i++) {
    let ch = text[i].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (ch === '-' || ch === '_' || ch === '/') ch = ' ';
    for (const c of ch) {
      looseChars.push(c);
      map.push(i);
    }
  }
  const loose = looseChars.join('');
  let at = -1;
  // Prefer a word-start match ("free" in "Gluten-Free"), then any.
  for (let i = loose.indexOf(q); i !== -1; i = loose.indexOf(q, i + 1)) {
    if (i === 0 || loose[i - 1] === ' ') { at = i; break; }
    if (at === -1) at = i;
  }
  if (at === -1) return [{ text, match: false }];
  const start = map[at];
  const end = map[at + q.length - 1] + 1;
  return [
    { text: text.slice(0, start), match: false },
    { text: text.slice(start, end), match: true },
    { text: text.slice(end), match: false },
  ].filter((s) => s.text);
}
