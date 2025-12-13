/**
 * Search Configuration Constants
 * Centralized configuration for search functionality across the app
 */

/**
 * Scoring weights for different types of matches
 * Higher scores = more relevant matches
 */
export const SEARCH_SCORING_WEIGHTS = {
  // Title matches (highest priority)
  EXACT_TITLE_MATCH: 100,        // "chicken" matches "Chicken" exactly
  TITLE_STARTS_WITH: 75,         // "chick" matches "Chicken Parmesan"
  TITLE_WORD_STARTS_WITH: 50,    // "parm" matches "Chicken Parmesan"
  TITLE_CONTAINS: 25,            // "ese" matches "Chicken Parmesan"

  // Content matches (medium priority)
  INGREDIENT_MATCH: 15,          // Search term found in ingredients

  // Metadata matches (lower priority)
  DIET_TYPE_MATCH: 10,          // Search term matches diet type
  MEAL_TYPE_MATCH: 10           // Search term matches meal type
};

/**
 * General search configuration
 */
export const SEARCH_CONFIG = {
  MIN_SEARCH_LENGTH: 1,         // Minimum characters before searching
  DEBOUNCE_DELAY: 300,          // Milliseconds to wait before searching
  MAX_SUGGESTIONS: 5,           // Maximum autocomplete suggestions
  CASE_SENSITIVE: false         // Case-sensitive search
};

/**
 * Context-specific search configurations
 * Different parts of the app can have different search behaviors
 */
export const SEARCH_CONTEXTS = {
  /**
   * Recipe Book search configuration
   * - Searches title, meal type, and diet type
   * - Groups results by diet type
   */
  RECIPE_BOOK: {
    searchFields: ['title', 'mealType', 'dietType'],
    weights: { ...SEARCH_SCORING_WEIGHTS },
    groupBy: 'dietType',
    includeMetadata: true
  },

  /**
   * Meal Planner search configuration
   * - Searches title and ingredients
   * - Higher weight for ingredient matches
   * - No grouping (flat list)
   */
  MEAL_PLANNER: {
    searchFields: ['title', 'ingredients'],
    weights: {
      ...SEARCH_SCORING_WEIGHTS,
      INGREDIENT_MATCH: 20  // Boost ingredient matches
    },
    groupBy: null,
    includeMetadata: true
  },

  /**
   * Shopping List search configuration
   * - Searches name and description only
   * - No grouping
   */
  SHOPPING_LIST: {
    searchFields: ['name', 'description'],
    weights: { ...SEARCH_SCORING_WEIGHTS },
    groupBy: null,
    includeMetadata: false
  }
};

/**
 * Match type identifiers for tracking how results were matched
 */
export const MATCH_TYPES = {
  EXACT: 'exact',
  STARTS_WITH: 'starts_with',
  WORD_STARTS: 'word_starts',
  CONTAINS: 'contains',
  INGREDIENT: 'ingredient',
  METADATA: 'metadata'
};

/**
 * Search field names
 */
export const SEARCH_FIELDS = {
  TITLE: 'title',
  INGREDIENTS: 'ingredients',
  DIET_TYPE: 'dietType',
  MEAL_TYPE: 'mealType',
  DESCRIPTION: 'description',
  NAME: 'name'
};
