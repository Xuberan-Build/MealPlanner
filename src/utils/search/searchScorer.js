/**
 * Search Scoring Utilities
 * Core algorithms for calculating search relevance scores
 */

import { SEARCH_SCORING_WEIGHTS, MATCH_TYPES } from '../../constants/search';

/**
 * Calculate relevance score for a recipe based on search term
 *
 * @param {Object} recipe - Recipe object to score
 * @param {string} searchTerm - Search term to match against
 * @param {Object} weights - Custom scoring weights (optional)
 * @returns {Object} Score result with { score, matches, matchDetails }
 *
 * @example
 * const result = scoreRecipe(
 *   { title: 'Chicken Parmesan', ingredients: ['chicken', 'cheese'] },
 *   'chicken'
 * );
 * // Returns: { score: 75, matches: [...], matchDetails: {...} }
 */
export const scoreRecipe = (recipe, searchTerm, weights = SEARCH_SCORING_WEIGHTS) => {
  // Return zero score for empty search
  if (!searchTerm || !searchTerm.trim()) {
    return { score: 0, matches: [], matchDetails: {} };
  }

  // Validate recipe object
  if (!recipe || typeof recipe !== 'object') {
    return { score: 0, matches: [], matchDetails: {} };
  }

  const term = searchTerm.toLowerCase().trim();
  let score = 0;
  const matches = [];
  const matchDetails = {};

  // Score title matches
  const titleScore = scoreTitleMatch(recipe.title, term, weights);
  if (titleScore.score > 0) {
    score += titleScore.score;
    matches.push(titleScore.match);
    matchDetails.titleMatch = titleScore.matchType;
  }

  // Score ingredient matches
  const ingredientScore = scoreIngredientMatch(recipe.ingredients, term, weights);
  if (ingredientScore.score > 0) {
    score += ingredientScore.score;
    matches.push(ingredientScore.match);
    matchDetails.ingredientMatches = ingredientScore.count;
  }

  // Score diet type matches
  const dietScore = scoreFieldMatch(recipe.dietType, term, weights.DIET_TYPE_MATCH, 'dietType');
  if (dietScore.score > 0) {
    score += dietScore.score;
    matches.push(dietScore.match);
    matchDetails.dietTypeMatch = true;
  }

  // Score meal type matches
  const mealScore = scoreFieldMatch(recipe.mealType, term, weights.MEAL_TYPE_MATCH, 'mealType');
  if (mealScore.score > 0) {
    score += mealScore.score;
    matches.push(mealScore.match);
    matchDetails.mealTypeMatch = true;
  }

  return { score, matches, matchDetails };
};

/**
 * Score title field with multi-level matching
 * Higher scores for more precise matches
 *
 * @param {string} title - Recipe title
 * @param {string} searchTerm - Search term (already lowercase)
 * @param {Object} weights - Scoring weights
 * @returns {Object} Title score result
 * @private
 */
const scoreTitleMatch = (title, searchTerm, weights) => {
  if (!title || typeof title !== 'string') {
    return { score: 0, match: null, matchType: null };
  }

  const titleLower = title.toLowerCase();

  // Level 1: Exact match (highest score)
  if (titleLower === searchTerm) {
    return {
      score: weights.EXACT_TITLE_MATCH,
      match: { field: 'title', type: MATCH_TYPES.EXACT },
      matchType: MATCH_TYPES.EXACT
    };
  }

  // Level 2: Title starts with search term
  if (titleLower.startsWith(searchTerm)) {
    return {
      score: weights.TITLE_STARTS_WITH,
      match: { field: 'title', type: MATCH_TYPES.STARTS_WITH },
      matchType: MATCH_TYPES.STARTS_WITH
    };
  }

  // Level 3: Any word in title starts with search term
  const titleWords = titleLower.split(/\s+/);
  const wordMatch = titleWords.some(word => word.startsWith(searchTerm));

  if (wordMatch) {
    return {
      score: weights.TITLE_WORD_STARTS_WITH,
      match: { field: 'title', type: MATCH_TYPES.WORD_STARTS },
      matchType: MATCH_TYPES.WORD_STARTS
    };
  }

  // Level 4: Title contains search term anywhere
  if (titleLower.includes(searchTerm)) {
    return {
      score: weights.TITLE_CONTAINS,
      match: { field: 'title', type: MATCH_TYPES.CONTAINS },
      matchType: MATCH_TYPES.CONTAINS
    };
  }

  // No match
  return { score: 0, match: null, matchType: null };
};

/**
 * Score ingredient matches
 * Supports both string arrays and object arrays
 *
 * @param {Array} ingredients - Array of ingredients (strings or objects)
 * @param {string} searchTerm - Search term (already lowercase)
 * @param {Object} weights - Scoring weights
 * @returns {Object} Ingredient score result
 * @private
 */
const scoreIngredientMatch = (ingredients, searchTerm, weights) => {
  if (!ingredients || !Array.isArray(ingredients)) {
    return { score: 0, match: null, count: 0 };
  }

  let matchCount = 0;

  ingredients.forEach(ingredient => {
    // Handle both string and object ingredient formats
    const ingredientText = typeof ingredient === 'string'
      ? ingredient
      : (ingredient.ingredientId || ingredient.name || '');

    if (ingredientText.toLowerCase().includes(searchTerm)) {
      matchCount++;
    }
  });

  if (matchCount > 0) {
    return {
      score: weights.INGREDIENT_MATCH,
      match: {
        field: 'ingredients',
        type: MATCH_TYPES.INGREDIENT,
        count: matchCount
      },
      count: matchCount
    };
  }

  return { score: 0, match: null, count: 0 };
};

/**
 * Score a generic text field match
 *
 * @param {string} fieldValue - Field value to check
 * @param {string} searchTerm - Search term (already lowercase)
 * @param {number} weight - Score weight for this field
 * @param {string} fieldName - Name of the field
 * @returns {Object} Field score result
 * @private
 */
const scoreFieldMatch = (fieldValue, searchTerm, weight, fieldName) => {
  if (!fieldValue || typeof fieldValue !== 'string') {
    return { score: 0, match: null };
  }

  if (fieldValue.toLowerCase().includes(searchTerm)) {
    return {
      score: weight,
      match: { field: fieldName, type: MATCH_TYPES.METADATA }
    };
  }

  return { score: 0, match: null };
};

/**
 * Normalize search term for consistent matching
 *
 * @param {string} searchTerm - Raw search term
 * @returns {string} Normalized search term
 *
 * @example
 * normalizeSearchTerm('  Chicken  ') // Returns: 'chicken'
 */
export const normalizeSearchTerm = (searchTerm) => {
  if (!searchTerm || typeof searchTerm !== 'string') {
    return '';
  }
  return searchTerm.toLowerCase().trim();
};

/**
 * Check if a recipe matches a search term (boolean)
 * Useful for simple filtering without scoring
 *
 * @param {Object} recipe - Recipe to check
 * @param {string} searchTerm - Search term
 * @returns {boolean} True if recipe matches
 *
 * @example
 * const matches = matchesSearch(recipe, 'chicken');
 */
export const matchesSearch = (recipe, searchTerm) => {
  const { score } = scoreRecipe(recipe, searchTerm);
  return score > 0;
};
