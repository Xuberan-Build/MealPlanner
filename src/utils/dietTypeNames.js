/**
 * Display names from diet types, which arrive either as strings (legacy) or as
 * diet-type objects from dietTypeService.getDietTypes() ({ id, name, ... }).
 * Blank and duplicate names are dropped; order is preserved.
 * @param {Array<string|{name?: string}>} types
 * @returns {string[]}
 */
export function dietTypeNames(types) {
  if (!Array.isArray(types)) return [];
  const seen = new Set();
  return types
    .map((t) => (typeof t === 'string' ? t : t && typeof t.name === 'string' ? t.name : ''))
    .map((name) => name.trim())
    .filter((name) => name && !seen.has(name) && seen.add(name));
}
