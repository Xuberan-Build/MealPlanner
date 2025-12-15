import { useMemo, useState, useCallback, useEffect } from 'react';
import { useDietTypeContext } from '../contexts/DietTypeContext';

/**
 * Main hook for accessing diet types with various filtering options
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.visibleOnly - Only return non-hidden diet types (default: false)
 * @param {boolean} options.favoritesOnly - Only return favorite diet types (default: false)
 * @param {boolean} options.customOnly - Only return user-created diet types (default: false)
 * @param {boolean} options.systemOnly - Only return system diet types (default: false)
 * @param {string} options.sortBy - Sort method: 'name', 'usage', 'recent' (default: 'name')
 * @param {string} options.search - Search term to filter diet types
 * @returns {Object} Diet types data and methods
 */
export const useDietTypes = (options = {}) => {
  const {
    visibleOnly = false,
    favoritesOnly = false,
    customOnly = false,
    systemOnly = false,
    sortBy = 'name',
    search = ''
  } = options;

  const {
    dietTypes: allDietTypes,
    loading,
    error,
    userPreferences,
    createDietType,
    updateDietType,
    deleteDietType,
    searchDietTypes,
    refresh,
    isFavorite,
    isHidden,
    canEditDietType,
    canDeleteDietType
  } = useDietTypeContext();

  // Filter and sort diet types based on options
  const dietTypes = useMemo(() => {
    let filtered = [...allDietTypes];

    // Apply search filter
    if (search.trim()) {
      filtered = searchDietTypes(search);
    }

    // Apply visibility filter
    if (visibleOnly) {
      filtered = filtered.filter(dt => !isHidden(dt.id));
    }

    // Apply favorites filter
    if (favoritesOnly) {
      filtered = filtered.filter(dt => isFavorite(dt.id));
    }

    // Apply custom/system filters
    if (customOnly) {
      filtered = filtered.filter(dt => dt.createdBy !== 'system');
    }
    if (systemOnly) {
      filtered = filtered.filter(dt => dt.createdBy === 'system');
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.recipeCount || 0) - (a.recipeCount || 0);
        case 'recent':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return filtered;
  }, [
    allDietTypes,
    search,
    visibleOnly,
    favoritesOnly,
    customOnly,
    systemOnly,
    sortBy,
    searchDietTypes,
    isFavorite,
    isHidden
  ]);

  // Computed values
  const totalCount = allDietTypes.length;
  const visibleCount = allDietTypes.filter(dt => !isHidden(dt.id)).length;
  const favoritesCount = allDietTypes.filter(dt => isFavorite(dt.id)).length;
  const customCount = allDietTypes.filter(dt => dt.createdBy !== 'system').length;

  return {
    dietTypes,
    allDietTypes,
    loading,
    error,
    userPreferences,
    totalCount,
    visibleCount,
    favoritesCount,
    customCount,
    createDietType,
    updateDietType,
    deleteDietType,
    refresh,
    isFavorite,
    isHidden,
    canEditDietType,
    canDeleteDietType
  };
};

/**
 * Hook for getting diet type recommendations based on ingredients
 *
 * @param {Array} ingredients - Array of ingredient strings
 * @param {Array} currentDietTypes - Currently assigned diet types
 * @returns {Object} Recommendations data and methods
 */
export const useDietTypeRecommendations = (ingredients = [], currentDietTypes = []) => {
  const { getSuggestedDietTypes, clearRecommendations, recommendations } = useDietTypeContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Get suggestions
  const getSuggestions = useCallback(async () => {
    if (!ingredients || ingredients.length === 0) {
      clearRecommendations();
      return [];
    }

    try {
      setLoading(true);
      setError(null);
      const suggestions = await getSuggestedDietTypes(ingredients, currentDietTypes);
      return suggestions;
    } catch (err) {
      console.error('Error getting diet type suggestions:', err);
      setError(err.message);
      return [];
    } finally {
      setLoading(false);
    }
  }, [ingredients, currentDietTypes, getSuggestedDietTypes, clearRecommendations]);

  // Auto-fetch on ingredient change
  useEffect(() => {
    if (ingredients && ingredients.length > 0) {
      getSuggestions();
    } else {
      clearRecommendations();
    }
  }, [ingredients, currentDietTypes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Categorize recommendations by confidence
  const highConfidence = useMemo(() =>
    recommendations.filter(r => r.confidence === 'high'),
    [recommendations]
  );

  const mediumConfidence = useMemo(() =>
    recommendations.filter(r => r.confidence === 'medium'),
    [recommendations]
  );

  const lowConfidence = useMemo(() =>
    recommendations.filter(r => r.confidence === 'low'),
    [recommendations]
  );

  return {
    recommendations,
    highConfidence,
    mediumConfidence,
    lowConfidence,
    loading,
    error,
    getSuggestions,
    clearRecommendations
  };
};

/**
 * Hook for managing user diet type preferences
 *
 * @returns {Object} Preference data and methods
 */
export const useDietTypePreferences = () => {
  const {
    userPreferences,
    addFavorite,
    removeFavorite,
    hideDietType,
    unhideDietType,
    setDefaultDietTypes,
    getFavoriteDietTypes,
    getVisibleDietTypes,
    isFavorite,
    isHidden
  } = useDietTypeContext();

  const toggleFavorite = useCallback(async (dietTypeId) => {
    if (isFavorite(dietTypeId)) {
      await removeFavorite(dietTypeId);
    } else {
      await addFavorite(dietTypeId);
    }
  }, [isFavorite, addFavorite, removeFavorite]);

  const toggleHidden = useCallback(async (dietTypeId) => {
    if (isHidden(dietTypeId)) {
      await unhideDietType(dietTypeId);
    } else {
      await hideDietType(dietTypeId);
    }
  }, [isHidden, hideDietType, unhideDietType]);

  return {
    preferences: userPreferences,
    favorites: userPreferences.favorites,
    hidden: userPreferences.hidden,
    defaults: userPreferences.defaultDietTypes,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    hideDietType,
    unhideDietType,
    toggleHidden,
    setDefaultDietTypes,
    getFavoriteDietTypes,
    getVisibleDietTypes,
    isFavorite,
    isHidden
  };
};

/**
 * Hook for managing diet types on a specific recipe
 *
 * @param {string} recipeId - Recipe ID
 * @param {Array} initialDietTypes - Initial diet types for the recipe
 * @returns {Object} Recipe diet type data and methods
 */
export const useRecipeDietTypes = (recipeId, initialDietTypes = []) => {
  const {
    addDietTypeToRecipe,
    removeDietTypeFromRecipe,
    getSuggestedDietTypes
  } = useDietTypeContext();

  const [recipeDietTypes, setRecipeDietTypes] = useState(initialDietTypes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Update local state when initial diet types change
  useEffect(() => {
    setRecipeDietTypes(initialDietTypes);
  }, [initialDietTypes]);

  // Add diet type to recipe
  const addDietType = useCallback(async (dietTypeName) => {
    if (!recipeId) {
      throw new Error('Recipe ID is required');
    }

    try {
      setLoading(true);
      setError(null);
      await addDietTypeToRecipe(recipeId, dietTypeName);

      // Optimistically update local state
      setRecipeDietTypes(prev => {
        if (prev.includes(dietTypeName)) return prev;
        return [...prev, dietTypeName].sort();
      });
    } catch (err) {
      console.error('Error adding diet type to recipe:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [recipeId, addDietTypeToRecipe]);

  // Remove diet type from recipe
  const removeDietType = useCallback(async (dietTypeName) => {
    if (!recipeId) {
      throw new Error('Recipe ID is required');
    }

    try {
      setLoading(true);
      setError(null);
      await removeDietTypeFromRecipe(recipeId, dietTypeName);

      // Optimistically update local state
      setRecipeDietTypes(prev => prev.filter(dt => dt !== dietTypeName));
    } catch (err) {
      console.error('Error removing diet type from recipe:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [recipeId, removeDietTypeFromRecipe]);

  // Toggle diet type
  const toggleDietType = useCallback(async (dietTypeName) => {
    if (recipeDietTypes.includes(dietTypeName)) {
      await removeDietType(dietTypeName);
    } else {
      await addDietType(dietTypeName);
    }
  }, [recipeDietTypes, addDietType, removeDietType]);

  // Check if diet type is assigned
  const hasDietType = useCallback((dietTypeName) => {
    return recipeDietTypes.includes(dietTypeName);
  }, [recipeDietTypes]);

  // Get suggestions for this recipe
  const getSuggestions = useCallback(async (ingredients) => {
    try {
      return await getSuggestedDietTypes(ingredients, recipeDietTypes);
    } catch (err) {
      console.error('Error getting suggestions:', err);
      return [];
    }
  }, [recipeDietTypes, getSuggestedDietTypes]);

  return {
    dietTypes: recipeDietTypes,
    loading,
    error,
    addDietType,
    removeDietType,
    toggleDietType,
    hasDietType,
    getSuggestions
  };
};

/**
 * Hook for searching diet types with debouncing
 *
 * @param {number} debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns {Object} Search state and methods
 */
export const useDietTypeSearch = (debounceMs = 300) => {
  const { searchDietTypes, dietTypes: allDietTypes } = useDietTypeContext();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [results, setResults] = useState([]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchTerm, debounceMs]);

  // Perform search when debounced term changes
  useEffect(() => {
    if (debouncedSearchTerm.trim()) {
      const searchResults = searchDietTypes(debouncedSearchTerm);
      setResults(searchResults);
    } else {
      setResults(allDietTypes);
    }
  }, [debouncedSearchTerm, searchDietTypes, allDietTypes]);

  const clearSearch = useCallback(() => {
    setSearchTerm('');
    setDebouncedSearchTerm('');
    setResults(allDietTypes);
  }, [allDietTypes]);

  return {
    searchTerm,
    setSearchTerm,
    results,
    isSearching: searchTerm !== debouncedSearchTerm,
    hasResults: results.length > 0,
    clearSearch
  };
};

/**
 * Hook for bulk operations on diet types
 *
 * @returns {Object} Bulk operation methods
 */
export const useDietTypeBulkOperations = () => {
  const { bulkUpdateRecipeDietTypes } = useDietTypeContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const renameDietType = useCallback(async (oldName, newName) => {
    try {
      setLoading(true);
      setError(null);
      setProgress({ current: 0, total: 0 });

      const result = await bulkUpdateRecipeDietTypes(oldName, newName);

      setProgress({ current: result.updatedCount, total: result.updatedCount });
      return result;
    } catch (err) {
      console.error('Error renaming diet type:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [bulkUpdateRecipeDietTypes]);

  return {
    renameDietType,
    loading,
    error,
    progress
  };
};

// Default export for convenience
export default useDietTypes;
