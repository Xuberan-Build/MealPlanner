// src/features/mealPlanner/mealPlanModel.js
//
// Pure, immutable helpers for the weekly meal plan.
//
// Plan shape: { [day]: { [mealType]: { recipe, servings } } }
// Legacy slots stored the recipe object directly (with optional selectedServings);
// getSlot() normalises both shapes so callers never branch on format.

import { DAYS_OF_WEEK } from '../../constants/mealPlanner';
import { parseServings } from '../../utils/quantity';

const DAY_ABBREVIATIONS = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
};

const toPositiveInt = (value) => {
  const n = parseServings(value);
  return n === null ? null : Math.max(1, Math.round(n));
};

/** Normalised slot `{ recipe, servings }`, or null when the slot is empty/invalid. */
export function getSlot(plan, day, meal) {
  const raw = plan?.[day]?.[meal];
  if (!raw || typeof raw !== 'object') return null;

  if (raw.recipe && typeof raw.recipe === 'object') {
    return { recipe: raw.recipe, servings: toPositiveInt(raw.servings) ?? 1 };
  }
  if (raw.title) {
    const { selectedServings, ...recipe } = raw;
    return {
      recipe,
      servings: toPositiveInt(selectedServings) ?? toPositiveInt(raw.servings) ?? 1,
    };
  }
  return null;
}

/** Stable identity for "is this the same recipe?" checks. */
export function recipeIdentity(recipe) {
  return recipe?.id ?? recipe?.title ?? null;
}

/** Returns a new plan with `day/meal` set to `{ recipe, servings }`. */
export function setSlot(plan, day, meal, { recipe, servings }) {
  // Never persist UI-only fields onto the stored recipe snapshot.
  const { selectedServings, ...cleanRecipe } = recipe || {};
  return {
    ...plan,
    [day]: {
      ...(plan?.[day] || {}),
      [meal]: { recipe: cleanRecipe, servings: toPositiveInt(servings) ?? 1 },
    },
  };
}

/** Returns a new plan without `day/meal`; drops the day when it becomes empty. */
export function removeSlot(plan, day, meal) {
  if (!plan?.[day]?.[meal]) return plan;
  const { [meal]: _removed, ...remainingMeals } = plan[day];
  const { [day]: _day, ...remainingDays } = plan;
  return Object.keys(remainingMeals).length > 0 ? { ...remainingDays, [day]: remainingMeals } : remainingDays;
}

/**
 * Slots among `days` that already hold a DIFFERENT recipe for `meal`, in week order.
 * Used to warn before assigning a recipe would replace something.
 */
export function findConflicts(plan, days, meal, recipe) {
  const incoming = recipeIdentity(recipe);
  return DAYS_OF_WEEK.filter((day) => days.includes(day))
    .map((day) => ({ day, slot: getSlot(plan, day, meal) }))
    .filter(({ slot }) => slot && recipeIdentity(slot.recipe) !== incoming)
    .map(({ day, slot }) => ({ day, title: slot.recipe.title || 'a meal' }));
}

/** Assigns one recipe/servings to `meal` on every day in `days`. */
export function assignRecipe(plan, { recipe, servings, days, meal }) {
  return days.reduce((next, day) => setSlot(next, day, meal, { recipe, servings }), plan || {});
}

/** All filled slots in week order, then meal-type insertion order. */
export function listMeals(plan) {
  return DAYS_OF_WEEK.flatMap((day) =>
    Object.keys(plan?.[day] || {})
      .map((meal) => ({ day, meal, slot: getSlot(plan, day, meal) }))
      .filter(({ slot }) => slot),
  );
}

export const countMeals = (plan) => listMeals(plan).length;
export const isPlanEmpty = (plan) => countMeals(plan) === 0;

/** Short, week-ordered preview, e.g. "Mon: Tacos • Tue: Soup • +3 more". */
export function summarizePlan(plan, maxItems = 3) {
  const meals = listMeals(plan);
  if (meals.length === 0) return 'No meals added';
  const shown = meals
    .slice(0, maxItems)
    .map(({ day, slot }) => `${DAY_ABBREVIATIONS[day] || day}: ${slot.recipe.title || 'Meal'}`);
  const hidden = meals.length - shown.length;
  return hidden > 0 ? `${shown.join(' • ')} • +${hidden} more` : shown.join(' • ');
}

/** Structural equality on normalised meals (ignores legacy-vs-new storage format). */
export function plansEqual(a, b) {
  const signature = (plan) =>
    listMeals(plan)
      .map(({ day, meal, slot }) => [day, meal, recipeIdentity(slot.recipe), slot.servings].join('|'))
      .sort();
  const sa = signature(a);
  const sb = signature(b);
  return sa.length === sb.length && sa.every((entry, i) => entry === sb[i]);
}

/* ------------------------------------------------------------------ */
/* Working-session persistence (survives refresh, keeps edit context)  */
/* ------------------------------------------------------------------ */

export const WORKING_PLAN_KEY = 'workingMealPlan';
export const WORKING_SESSION_KEY = 'workingMealPlanSession';

const readJson = (storage, key) => {
  try {
    const value = storage?.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

/**
 * Restores `{ plan, editingPlan, originalPlan }`.
 * editingPlan is `{ id, name }` when the working plan is linked to a saved plan.
 */
export function loadWorkingSession(storage) {
  const plan = readJson(storage, WORKING_PLAN_KEY) || {};
  const session = readJson(storage, WORKING_SESSION_KEY);
  const editingPlan = session?.editingPlan?.id && session.editingPlan.name ? session.editingPlan : null;
  return {
    plan,
    editingPlan,
    originalPlan: editingPlan ? session.originalPlan || {} : null,
  };
}

export function saveWorkingSession(storage, { plan, editingPlan, originalPlan }) {
  try {
    storage?.setItem(WORKING_PLAN_KEY, JSON.stringify(plan || {}));
    if (editingPlan) {
      storage?.setItem(
        WORKING_SESSION_KEY,
        JSON.stringify({ editingPlan: { id: editingPlan.id, name: editingPlan.name }, originalPlan }),
      );
    } else {
      storage?.removeItem(WORKING_SESSION_KEY);
    }
  } catch (error) {
    // Storage can be full or blocked (private mode); the in-memory plan still works.
    console.warn('Could not persist working meal plan:', error);
  }
}

export function clearWorkingSession(storage) {
  try {
    storage?.removeItem(WORKING_PLAN_KEY);
    storage?.removeItem(WORKING_SESSION_KEY);
  } catch {
    /* ignore: nothing to clear */
  }
}
