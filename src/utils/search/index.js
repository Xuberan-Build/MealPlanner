/**
 * Search Utilities - Main Entry Point
 * Orchestrates search functionality with scoring, ranking, and grouping
 */

import { scoreRecipe, normalizeSearchTerm, matchesSearch } from './searchScorer';
import { SEARCH_CONTEXTS } from '../../constants/search';

/**
 * Search and rank recipes based on relevance
 *
 * @param {Array} recipes - Array of recipe objects
 * @param {string} searchTerm - Search term
 * @param {Object} options - Search options
 * @param {string} options.context - Search context ('RECIPE_BOOK', 'MEAL_PLANNER', 'SHOPPING_LIST')
 * @param {Object} options.weights - Custom scoring weights
 * @param {boolean} options.includeScores - Include score metadata in results
 * @returns {Array} Sorted array of matching recipes
 *
 * @example
 * const results = searchRecipes(allRecipes, 'chicken', {
 *   context: 'MEAL_PLANNER',
 *   includeScores: true
 * });
 */
export const searchRecipes = (recipes, searchTerm, options = {}) => {
  const {
    context = 'RECIPE_BOOK',
    weights = null,
    includeScores = false
  } = options;

  // Validate inputs
  if (!recipes || !Array.isArray(recipes)) {
    return [];
  }

  // Get context-specific configuration
  const config = SEARCH_CONTEXTS[context] || SEARCH_CONTEXTS.RECIPE_BOOK;
  const scoringWeights = weights || config.weights;

  // If no search term, return all recipes unsorted
  const normalizedTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedTerm) {
    return recipes;
  }

  // Score each recipe
  const scoredRecipes = recipes.map(recipe => {
    const { score, matches, matchDetails } = scoreRecipe(
      recipe,
      normalizedTerm,
      scoringWeights
    );

    return {
      ...recipe,
      _searchScore: score,
      _searchMatches: matches,
      _matchDetails: matchDetails
    };
  });

  // Filter out recipes with no matches (score = 0)
  const matchedRecipes = scoredRecipes.filter(r => r._searchScore > 0);

  // Sort by score (highest first), then alphabetically by title as tiebreaker
  matchedRecipes.sort((a, b) => {
    // Primary sort: by score (descending)
    if (b._searchScore !== a._searchScore) {
      return b._searchScore - a._searchScore;
    }

    // Secondary sort: alphabetically by title (ascending)
    const titleA = (a.title || '').toLowerCase();
    const titleB = (b.title || '').toLowerCase();
    return titleA.localeCompare(titleB);
  });

  // Remove score metadata if not requested
  if (!includeScores) {
    matchedRecipes.forEach(recipe => {
      delete recipe._searchScore;
      delete recipe._searchMatches;
      delete recipe._matchDetails;
    });
  }

  return matchedRecipes;
};

/**
 * Group search results by a specified field
 *
 * @param {Array} recipes - Sorted recipes from searchRecipes
 * @param {string} groupByField - Field to group by (e.g., 'dietType')
 * @returns {Object} Grouped recipes as { [groupKey]: [recipes...] }
 *
 * @example
 * const grouped = groupSearchResults(recipes, 'dietType');
 * // Returns: { 'Keto': [...], 'Vegan': [...], ... }
 */
export const groupSearchResults = (recipes, groupByField = 'dietType') => {
  if (!recipes || !Array.isArray(recipes)) {
    return {};
  }

  return recipes.reduce((acc, recipe) => {
    const key = recipe[groupByField] || 'Uncategorized';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(recipe);
    return acc;
  }, {});
};

/**
 * Get search suggestions for autocomplete
 *
 * @param {Array} recipes - All recipes
 * @param {string} searchTerm - Partial search term
 * @param {number} maxSuggestions - Maximum number of suggestions to return
 * @returns {Array<string>} Array of suggested recipe titles
 *
 * @example
 * const suggestions = getSearchSuggestions(allRecipes, 'chick', 5);
 * // Returns: ['Chicken Parmesan', 'Chicken Tikka', 'Chickpea Curry', ...]
 */
export const getSearchSuggestions = (recipes, searchTerm, maxSuggestions = 5) => {
  if (!searchTerm || !searchTerm.trim()) {
    return [];
  }

  const results = searchRecipes(recipes, searchTerm, { includeScores: false });
  return results
    .slice(0, maxSuggestions)
    .map(r => r.title)
    .filter(Boolean); // Remove any null/undefined titles
};

/**
 * Filter recipes by search term (boolean match, no scoring)
 * Useful for simple filtering without relevance ranking
 *
 * @param {Array} recipes - Array of recipes
 * @param {string} searchTerm - Search term
 * @returns {Array} Filtered recipes (unsorted)
 *
 * @example
 * const filtered = filterRecipes(allRecipes, 'chicken');
 */
export const filterRecipes = (recipes, searchTerm) => {
  if (!recipes || !Array.isArray(recipes)) {
    return [];
  }

  const normalizedTerm = normalizeSearchTerm(searchTerm);
  if (!normalizedTerm) {
    return recipes;
  }

  return recipes.filter(recipe => matchesSearch(recipe, normalizedTerm));
};

/**
 * Search with filters and grouping (convenience method)
 *
 * @param {Array} recipes - All recipes
 * @param {string} searchTerm - Search term
 * @param {Object} filters - Additional filters (e.g., { dietTypes: [], mealTypes: [] })
 * @param {Object} options - Search options
 * @returns {Object} { results: [], grouped: {}, resultCount: 0 }
 *
 * @example
 * const { results, grouped, resultCount } = searchAndFilter(
 *   allRecipes,
 *   'chicken',
 *   { dietTypes: ['Keto'], mealTypes: ['Dinner'] },
 *   { context: 'RECIPE_BOOK' }
 * );
 */
export const searchAndFilter = (recipes, searchTerm, filters = {}, options = {}) => {
  // First apply search
  let results = searchRecipes(recipes, searchTerm, options);

  // Then apply additional filters
  if (filters.dietTypes && filters.dietTypes.length > 0) {
    results = results.filter(recipe =>
      filters.dietTypes.includes(recipe.dietType)
    );
  }

  if (filters.mealTypes && filters.mealTypes.length > 0) {
    results = results.filter(recipe =>
      filters.mealTypes.includes(recipe.mealType)
    );
  }

  // Group if context specifies grouping
  const config = SEARCH_CONTEXTS[options.context || 'RECIPE_BOOK'];
  const grouped = config.groupBy
    ? groupSearchResults(results, config.groupBy)
    : null;

  return {
    results,
    grouped,
    resultCount: results.length
  };
};

// Re-export utility functions
export { scoreRecipe, normalizeSearchTerm, matchesSearch } from './searchScorer';
