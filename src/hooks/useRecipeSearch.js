import { useState, useMemo, useCallback } from 'react';
import { searchRecipes, groupSearchResults } from '../utils/search';
import { useDebounce } from './useDebounce';

/**
 * Reusable hook for recipe search with debouncing and memoization
 *
 * @param {Array} recipes - All recipes to search
 * @param {Object} options - Search configuration
 * @param {string} options.context - Search context ('RECIPE_BOOK', 'MEAL_PLANNER', 'SHOPPING_LIST')
 * @param {number} options.debounceDelay - Debounce delay in ms (default: 300)
 * @param {string} options.groupBy - Field to group results by (e.g., 'dietType')
 * @param {string} options.initialSearchTerm - Initial search term
 * @returns {Object} Search state and controls
 *
 * @example
 * const {
 *   searchTerm,
 *   setSearchTerm,
 *   searchResults,
 *   groupedResults,
 *   hasResults,
 *   resultCount
 * } = useRecipeSearch(allRecipes, {
 *   context: 'RECIPE_BOOK',
 *   groupBy: 'dietType'
 * });
 */
export const useRecipeSearch = (recipes, options = {}) => {
  const {
    context = 'RECIPE_BOOK',
    debounceDelay = 300,
    groupBy = null,
    initialSearchTerm = ''
  } = options;

  const [searchTerm, setSearchTerm] = useState(initialSearchTerm);
  const debouncedSearchTerm = useDebounce(searchTerm, debounceDelay);

  // Memoized search results - only recompute when recipes or search term changes
  const searchResults = useMemo(() => {
    if (!recipes || !Array.isArray(recipes)) {
      return [];
    }
    return searchRecipes(recipes, debouncedSearchTerm, { context });
  }, [recipes, debouncedSearchTerm, context]);

  // Memoized grouped results (if groupBy specified)
  const groupedResults = useMemo(() => {
    if (!groupBy) return null;
    return groupSearchResults(searchResults, groupBy);
  }, [searchResults, groupBy]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
  }, []);

  return {
    // Search state
    searchTerm,
    setSearchTerm,
    debouncedSearchTerm,

    // Results
    searchResults,
    groupedResults,

    // Metadata
    hasResults: searchResults.length > 0,
    resultCount: searchResults.length,
    isSearching: searchTerm !== debouncedSearchTerm,

    // Actions
    clearSearch
  };
};

export default useRecipeSearch;
