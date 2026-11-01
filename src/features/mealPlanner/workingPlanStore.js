// src/features/mealPlanner/workingPlanStore.js
//
// The one place the working meal plan is read and written, so the Recipe Book and the
// Meal Planner always agree. Persists through mealPlanModel's session helpers
// (localStorage), notifies subscribers, and follows changes made in other tabs.

import { useCallback, useSyncExternalStore } from 'react';
import { loadWorkingSession, saveWorkingSession } from './mealPlanModel';

const storage = () => {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null; // storage blocked (privacy mode): the store still works in memory
  }
};

const listeners = new Set();
let snapshot = null; // stable object between changes (required by useSyncExternalStore)

const emit = () => listeners.forEach((listener) => listener());

/** Current session: { plan, editingPlan, originalPlan, workingId }. */
export function getWorkingSession() {
  if (!snapshot) snapshot = loadWorkingSession(storage());
  return snapshot;
}

/** Replace the whole session (used by the Meal Planner, which owns edit/save state). */
export function setWorkingSession(session) {
  snapshot = { ...getWorkingSession(), ...session };
  saveWorkingSession(storage(), snapshot);
  emit();
}

/** Apply a pure plan update, e.g. `plan => removeSlot(plan, day, meal)`. */
export function updateWorkingPlan(updater) {
  const current = getWorkingSession();
  const plan = updater(current.plan);
  if (plan === current.plan) return current;
  setWorkingSession({ plan });
  return snapshot;
}

export function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (!event.key || event.key.startsWith('workingMealPlan')) {
      snapshot = null; // another tab changed the plan: re-read it
      listener();
    }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

/** Test helper: forget the cached session so the next read comes from storage. */
export function resetWorkingPlanStoreForTests() {
  snapshot = null;
  listeners.clear();
}

/** React hook: the working session plus an `update(updater)` function. */
export function useWorkingPlan() {
  const session = useSyncExternalStore(subscribe, getWorkingSession, getWorkingSession);
  const update = useCallback((updater) => updateWorkingPlan(updater), []);
  return { ...session, update };
}
