import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import dietTypeService from '../services/dietTypeService';

const DietTypeContext = createContext();

export const useDietTypeContext = () => {
  const context = useContext(DietTypeContext);
  if (!context) {
    throw new Error('useDietTypeContext must be used within a DietTypeProvider');
  }
  return context;
};

export const DietTypeProvider = ({ children }) => {
  const { user } = useAuth();

  // State
  const [dietTypes, setDietTypes] = useState([]);
  const [userPreferences, setUserPreferences] = useState({
    favorites: [],
    hidden: [],
    defaultDietTypes: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recommendations, setRecommendations] = useState([]);

  // Load diet types and user preferences
  const loadDietTypes = useCallback(async () => {
    if (!user) {
      setDietTypes([]);
      setUserPreferences({ favorites: [], hidden: [], defaultDietTypes: [] });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Load diet types and preferences in parallel
      const [types, prefs] = await Promise.all([
        dietTypeService.getDietTypes(user.uid, {
          includeCounts: true,
          includeUserPreferences: true
        }),
        dietTypeService.getUserPreferences(user.uid)
      ]);

      setDietTypes(types);
      setUserPreferences(prefs);
    } catch (err) {
      console.error('Error loading diet types:', err);
      setError(err.message || 'Failed to load diet types');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    loadDietTypes();
  }, [loadDietTypes]);

  // CRUD Operations

  /**
   * Create a new custom diet type
   */
  const createDietType = useCallback(async (dietTypeData) => {
    if (!user) {
      throw new Error('User must be logged in to create diet types');
    }

    try {
      const newDietType = await dietTypeService.createDietType(dietTypeData, user.uid);

      // Optimistically update local state
      setDietTypes(prev => [...prev, newDietType].sort((a, b) =>
        a.name.localeCompare(b.name)
      ));

      return newDietType;
    } catch (err) {
      console.error('Error creating diet type:', err);
      throw err;
    }
  }, [user]);

  /**
   * Update an existing diet type
   */
  const updateDietType = useCallback(async (dietTypeId, updates) => {
    if (!user) {
      throw new Error('User must be logged in to update diet types');
    }

    try {
      const updated = await dietTypeService.updateDietType(dietTypeId, updates, user.uid);

      // Optimistically update local state
      setDietTypes(prev => prev.map(dt =>
        dt.id === dietTypeId ? { ...dt, ...updated } : dt
      ).sort((a, b) => a.name.localeCompare(b.name)));

      return updated;
    } catch (err) {
      console.error('Error updating diet type:', err);
      throw err;
    }
  }, [user]);

  /**
   * Delete a diet type (soft delete)
   */
  const deleteDietType = useCallback(async (dietTypeId) => {
    if (!user) {
      throw new Error('User must be logged in to delete diet types');
    }

    try {
      const result = await dietTypeService.deleteDietType(dietTypeId, user.uid);

      // Remove from local state
      setDietTypes(prev => prev.filter(dt => dt.id !== dietTypeId));

      return result;
    } catch (err) {
      console.error('Error deleting diet type:', err);
      throw err;
    }
  }, [user]);

  /**
   * Search diet types with fuzzy matching
   */
  const searchDietTypes = useCallback((searchTerm) => {
    return dietTypeService.searchDietTypes(searchTerm, dietTypes);
  }, [dietTypes]);

  // Multi-Diet Recipe Operations

  /**
   * Add a diet type to a recipe
   */
  const addDietTypeToRecipe = useCallback(async (recipeId, dietTypeName) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      return await dietTypeService.addDietTypeToRecipe(recipeId, dietTypeName, user.uid);
    } catch (err) {
      console.error('Error adding diet type to recipe:', err);
      throw err;
    }
  }, [user]);

  /**
   * Remove a diet type from a recipe
   */
  const removeDietTypeFromRecipe = useCallback(async (recipeId, dietTypeName) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      return await dietTypeService.removeDietTypeFromRecipe(recipeId, dietTypeName, user.uid);
    } catch (err) {
      console.error('Error removing diet type from recipe:', err);
      throw err;
    }
  }, [user]);

  // Recommendation System

  /**
   * Get diet type recommendations based on ingredients
   */
  const getSuggestedDietTypes = useCallback(async (ingredients, currentDietTypes = []) => {
    try {
      const suggestions = await dietTypeService.suggestDietTypes(ingredients, currentDietTypes);
      setRecommendations(suggestions);
      return suggestions;
    } catch (err) {
      console.error('Error getting diet type suggestions:', err);
      return [];
    }
  }, []);

  /**
   * Clear recommendations
   */
  const clearRecommendations = useCallback(() => {
    setRecommendations([]);
  }, []);

  // User Preference Operations

  /**
   * Add a diet type to favorites
   */
  const addFavorite = useCallback(async (dietTypeId) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await dietTypeService.addFavorite(user.uid, dietTypeId);

      // Optimistically update local state
      setUserPreferences(prev => ({
        ...prev,
        favorites: [...prev.favorites, dietTypeId]
      }));
    } catch (err) {
      console.error('Error adding favorite:', err);
      throw err;
    }
  }, [user]);

  /**
   * Remove a diet type from favorites
   */
  const removeFavorite = useCallback(async (dietTypeId) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await dietTypeService.removeFavorite(user.uid, dietTypeId);

      // Optimistically update local state
      setUserPreferences(prev => ({
        ...prev,
        favorites: prev.favorites.filter(id => id !== dietTypeId)
      }));
    } catch (err) {
      console.error('Error removing favorite:', err);
      throw err;
    }
  }, [user]);

  /**
   * Hide a diet type from the UI
   */
  const hideDietType = useCallback(async (dietTypeId) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await dietTypeService.hideDietType(user.uid, dietTypeId);

      // Optimistically update local state
      setUserPreferences(prev => ({
        ...prev,
        hidden: [...prev.hidden, dietTypeId]
      }));
    } catch (err) {
      console.error('Error hiding diet type:', err);
      throw err;
    }
  }, [user]);

  /**
   * Unhide a diet type
   */
  const unhideDietType = useCallback(async (dietTypeId) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await dietTypeService.unhideDietType(user.uid, dietTypeId);

      // Optimistically update local state
      setUserPreferences(prev => ({
        ...prev,
        hidden: prev.hidden.filter(id => id !== dietTypeId)
      }));
    } catch (err) {
      console.error('Error unhiding diet type:', err);
      throw err;
    }
  }, [user]);

  /**
   * Set default diet types for new recipes
   */
  const setDefaultDietTypes = useCallback(async (dietTypeIds) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      await dietTypeService.setDefaultDietTypes(user.uid, dietTypeIds);

      // Optimistically update local state
      setUserPreferences(prev => ({
        ...prev,
        defaultDietTypes: dietTypeIds
      }));
    } catch (err) {
      console.error('Error setting default diet types:', err);
      throw err;
    }
  }, [user]);

  // Utility Functions

  /**
   * Get diet types filtered by user preferences
   */
  const getVisibleDietTypes = useCallback(() => {
    return dietTypes.filter(dt => !userPreferences.hidden.includes(dt.id));
  }, [dietTypes, userPreferences]);

  /**
   * Get favorite diet types
   */
  const getFavoriteDietTypes = useCallback(() => {
    return dietTypes.filter(dt => userPreferences.favorites.includes(dt.id));
  }, [dietTypes, userPreferences]);

  /**
   * Check if a diet type is a favorite
   */
  const isFavorite = useCallback((dietTypeId) => {
    return userPreferences.favorites.includes(dietTypeId);
  }, [userPreferences]);

  /**
   * Check if a diet type is hidden
   */
  const isHidden = useCallback((dietTypeId) => {
    return userPreferences.hidden.includes(dietTypeId);
  }, [userPreferences]);

  /**
   * Get diet type by name (case-insensitive)
   */
  const getDietTypeByName = useCallback((name) => {
    return dietTypes.find(dt =>
      dt.name.toLowerCase() === name.toLowerCase()
    );
  }, [dietTypes]);

  /**
   * Get diet type by ID
   */
  const getDietTypeById = useCallback((id) => {
    return dietTypes.find(dt => dt.id === id);
  }, [dietTypes]);

  /**
   * Check if user can edit a diet type
   */
  const canEditDietType = useCallback((dietType) => {
    if (!user || !dietType) return false;
    return dietType.createdBy === user.uid;
  }, [user]);

  /**
   * Check if user can delete a diet type
   */
  const canDeleteDietType = useCallback((dietType) => {
    if (!user || !dietType) return false;
    return dietType.createdBy === user.uid && dietType.createdBy !== 'system';
  }, [user]);

  /**
   * Refresh diet types from server
   */
  const refresh = useCallback(async () => {
    await loadDietTypes();
  }, [loadDietTypes]);

  /**
   * Clear cache and reload
   */
  const clearCacheAndReload = useCallback(async () => {
    dietTypeService.clearCache();
    await loadDietTypes();
  }, [loadDietTypes]);

  // Bulk Operations

  /**
   * Bulk update recipe diet types (e.g., when renaming)
   */
  const bulkUpdateRecipeDietTypes = useCallback(async (oldDietTypeName, newDietTypeName) => {
    if (!user) {
      throw new Error('User must be logged in');
    }

    try {
      return await dietTypeService.bulkUpdateRecipeDietTypes(
        oldDietTypeName,
        newDietTypeName,
        user.uid
      );
    } catch (err) {
      console.error('Error bulk updating recipes:', err);
      throw err;
    }
  }, [user]);

  const value = {
    // State
    dietTypes,
    userPreferences,
    loading,
    error,
    recommendations,

    // CRUD Operations
    createDietType,
    updateDietType,
    deleteDietType,
    searchDietTypes,

    // Multi-Diet Recipe Operations
    addDietTypeToRecipe,
    removeDietTypeFromRecipe,

    // Recommendations
    getSuggestedDietTypes,
    clearRecommendations,

    // User Preferences
    addFavorite,
    removeFavorite,
    hideDietType,
    unhideDietType,
    setDefaultDietTypes,

    // Utility Functions
    getVisibleDietTypes,
    getFavoriteDietTypes,
    isFavorite,
    isHidden,
    getDietTypeByName,
    getDietTypeById,
    canEditDietType,
    canDeleteDietType,
    refresh,
    clearCacheAndReload,

    // Bulk Operations
    bulkUpdateRecipeDietTypes
  };

  return (
    <DietTypeContext.Provider value={value}>
      {children}
    </DietTypeContext.Provider>
  );
};

export default DietTypeContext;
