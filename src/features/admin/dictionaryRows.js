// src/features/admin/dictionaryRows.js
//
// One row per alias for the admin table: built-ins and shared dictionary entries combined,
// showing what is actually in effect.

import { aliasKey } from '../../utils/ingredientAliases';

/**
 * buildDictionaryRows(builtIns, entries) -> rows sorted by alias:
 *   { alias, canonical, source: 'built-in' | 'shared', enabled, changedBuiltIn, note }
 * changedBuiltIn: a built-in that the shared dictionary overrides or switches off.
 */
export function buildDictionaryRows(builtIns, entries) {
  const rows = new Map();
  Object.entries(builtIns || {}).forEach(([alias, canonical]) => {
    rows.set(alias, { alias, canonical, source: 'built-in', enabled: true, changedBuiltIn: false, note: '' });
  });
  (Array.isArray(entries) ? entries : []).forEach((entry) => {
    const alias = aliasKey(entry?.alias);
    if (!alias) return;
    const builtIn = rows.get(alias);
    rows.set(alias, {
      alias,
      canonical: aliasKey(entry.canonical) || builtIn?.canonical || '',
      source: builtIn && builtIn.source === 'built-in' ? 'built-in' : 'shared',
      enabled: entry.enabled !== false,
      changedBuiltIn: Boolean(builtIn),
      note: entry.note || '',
    });
  });
  return Array.from(rows.values()).sort((a, b) => a.alias.localeCompare(b.alias));
}

/** Rows whose alias or canonical name contains the search text. */
export function filterRows(rows, search) {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => r.alias.includes(q) || r.canonical.includes(q));
}
