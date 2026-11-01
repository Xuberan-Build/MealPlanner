// src/features/mealPlanner/recipePicker.js
//
// Which recipes the meal-slot picker offers. Recipes saved for this meal come first, but
// any recipe can be planned for any meal (a lunch for dinner), so the rest are offered too.

import { searchRecipes } from '../../utils/search';
import { isPlateRecipe } from './plateBuilder/plateModel';

const PREP_RANGES = {
  quick: ['15', '20', '25'],
  medium: ['30', '45', '60'],
  long: ['90', '120', '2 hour'],
};

const matchesPrep = (recipe, prepFilter) => {
  if (!prepFilter || prepFilter === 'all') return true;
  const prepTime = String(recipe.prepTime || '');
  return (PREP_RANGES[prepFilter] || []).some((token) => prepTime.includes(token));
};

const lower = (value) => String(value || '').toLowerCase();

/**
 * pickRecipesForSlot(recipes, { mealType, searchTerm, dietFilter, prepFilter })
 *   -> { matching, others }
 * matching: recipes saved for this meal; others: every other recipe (lunch, breakfast,
 * no meal type). Saved plates are excluded (they have their own tab). Search keeps its
 * relevance order; otherwise both lists are alphabetical.
 */
export function pickRecipesForSlot(recipes, { mealType = '', searchTerm = '', dietFilter = 'all', prepFilter = 'all' } = {}) {
  let list = (Array.isArray(recipes) ? recipes : []).filter((r) => r && !isPlateRecipe(r));
  const searching = searchTerm.trim().length > 0;
  if (searching) list = searchRecipes(list, searchTerm, { context: 'MEAL_PLANNER' });
  if (dietFilter && dietFilter !== 'all') list = list.filter((r) => lower(r.dietType) === lower(dietFilter));
  list = list.filter((r) => matchesPrep(r, prepFilter));
  if (!searching) list = [...list].sort((a, b) => String(a.title || '').localeCompare(String(b.title || '')));

  const meal = lower(mealType);
  return {
    matching: list.filter((r) => lower(r.mealType) === meal),
    others: list.filter((r) => lower(r.mealType) !== meal),
  };
}
