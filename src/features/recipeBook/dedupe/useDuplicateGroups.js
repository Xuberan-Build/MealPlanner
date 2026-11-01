// src/features/recipeBook/dedupe/useDuplicateGroups.js
//
// Duplicate groups for the Recipe Book, minus the ones the user said are "Not duplicates".
// Dismissals are remembered in localStorage by the group's sorted ids, so a group comes
// back only if its membership changes (e.g. a third copy appears).

import { useCallback, useMemo, useState } from 'react';
import { findDuplicateRecipes } from './findDuplicateRecipes';

export const DISMISSED_DUPLICATES_KEY = 'recipeBook.dismissedDuplicateGroups';

export function loadDismissedGroups() {
  try {
    const raw = window.localStorage.getItem(DISMISSED_DUPLICATES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [];
  } catch {
    return [];
  }
}

export function saveDismissedGroups(keys) {
  try {
    window.localStorage.setItem(DISMISSED_DUPLICATES_KEY, JSON.stringify(keys));
  } catch {
    // storage blocked: the dismissal lasts for this session only
  }
}

export function useDuplicateGroups(recipes) {
  const [dismissed, setDismissed] = useState(loadDismissedGroups);
  const allGroups = useMemo(() => findDuplicateRecipes(recipes), [recipes]);
  const groups = useMemo(() => {
    const hidden = new Set(dismissed);
    return allGroups.filter((group) => !hidden.has(group.key));
  }, [allGroups, dismissed]);

  const dismiss = useCallback((key) => {
    setDismissed((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      saveDismissedGroups(next);
      return next;
    });
  }, []);

  return { groups, dismiss };
}

export default useDuplicateGroups;
