import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getRecipes, addRecipe, updateRecipe, deleteRecipe } from '../../../services/recipeService';
import { auth } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { searchRecipes, groupSearchResults } from '../../../utils/search';

const RecipeContext = createContext(null);

export const useRecipes = () => {
  const context = useContext(RecipeContext);
  if (!context) {
    throw new Error('useRecipes must be used within a RecipeProvider');
  }
  return context;
};

export const RecipeProvider = ({ children }) => {
  // Core recipe state
  const [allRecipes, setAllRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ dietTypes: [], mealTypes: [] });

  // Cache for ingredients (fetch once, reuse everywhere)
  const [ingredientsCache, setIngredientsCache] = useState(null);

  // Wait for auth state, then fetch recipes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      if (user) {
        // User is logged in, fetch data
        fetchAllRecipes();
      } else {
        // User logged out, clear data
        setAllRecipes([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchAllRecipes = async () => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const recipeList = await getRecipes();
      setAllRecipes(recipeList);
    } catch (err) {
      console.error('Failed to fetch recipes:', err);
      setError('Failed to load recipes. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  // Get unique diet types from all recipes (memoized)
  const availableDietTypes = useMemo(() => {
    const types = new Set();
    allRecipes.forEach(recipe => {
      if (recipe.dietType && recipe.dietType !== 'Not Specified') {
        types.add(recipe.dietType);
      }
    });
    return Array.from(types).sort();
  }, [allRecipes]);

  // Get unique meal types from all recipes (memoized)
  const availableMealTypes = useMemo(() => {
    const types = new Set();
    allRecipes.forEach(recipe => {
      if (recipe.mealType && recipe.mealType !== 'Not Specified') {
        types.add(recipe.mealType);
      }
    });
    return Array.from(types).sort();
  }, [allRecipes]);

  // Filter and group recipes using new search utilities (memoized)
  const recipesByDiet = useMemo(() => {
    // First, apply search with relevance ranking
    let results = searchRecipes(allRecipes, searchTerm, {
      context: 'RECIPE_BOOK'
    });

    // Then apply additional filters
    if (filters.dietTypes.length > 0) {
      results = results.filter(recipe =>
        filters.dietTypes.includes(recipe.dietType)
      );
    }

    if (filters.mealTypes.length > 0) {
      results = results.filter(recipe =>
        filters.mealTypes.includes(recipe.mealType)
      );
    }

    // Group by diet type (results are already sorted by relevance within each group)
    const grouped = groupSearchResults(results, 'dietType');

    return grouped;
  }, [allRecipes, searchTerm, filters]);

  // CRUD operations (memoized callbacks)
  const handleSaveRecipe = useCallback(async (recipeData) => {
    try {
      const recipeId = await addRecipe(recipeData);
      const savedRecipe = { ...recipeData, id: recipeId };
      setAllRecipes(prev => [...prev, savedRecipe]);
      return savedRecipe;
    } catch (err) {
      console.error('Failed to save recipe:', err);
      throw err;
    }
  }, []);

  const handleUpdateRecipe = useCallback(async (recipeData) => {
    try {
      const { id, ...updateData } = recipeData;
      await updateRecipe(id, updateData);
      setAllRecipes(prev =>
        prev.map(recipe => recipe.id === id ? recipeData : recipe)
      );
      return recipeData;
    } catch (err) {
      console.error('Failed to update recipe:', err);
      throw err;
    }
  }, []);

  const handleDeleteRecipe = useCallback(async (recipeId) => {
    try {
      await deleteRecipe(recipeId);
      setAllRecipes(prev => prev.filter(recipe => recipe.id !== recipeId));
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      throw err;
    }
  }, []);

  const handleDuplicateRecipe = useCallback(async (recipe) => {
    try {
      const duplicateData = {
        ...recipe,
        id: undefined,
        title: `${recipe.title} (Copy)`,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const recipeId = await addRecipe(duplicateData);
      const savedRecipe = { ...duplicateData, id: recipeId };
      setAllRecipes(prev => [...prev, savedRecipe]);
      return savedRecipe;
    } catch (err) {
      console.error('Failed to duplicate recipe:', err);
      throw err;
    }
  }, []);

  // Update search term (will be debounced in UI)
  const updateSearchTerm = useCallback((term) => {
    setSearchTerm(term);
  }, []);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    setFilters(newFilters);
  }, []);

  // Ingredient cache management
  const getIngredientsCache = useCallback(() => {
    return ingredientsCache;
  }, [ingredientsCache]);

  const setIngredientsData = useCallback((ingredients) => {
    setIngredientsCache(ingredients);
  }, []);

  const value = {
    // State
    allRecipes,
    recipesByDiet,
    loading,
    error,
    searchTerm,
    filters,
    availableDietTypes,
    availableMealTypes,

    // CRUD operations
    saveRecipe: handleSaveRecipe,
    updateRecipe: handleUpdateRecipe,
    deleteRecipe: handleDeleteRecipe,
    duplicateRecipe: handleDuplicateRecipe,
    refreshRecipes: fetchAllRecipes,

    // Filters
    updateSearchTerm,
    updateFilters,

    // Ingredient cache
    ingredientsCache,
    getIngredientsCache,
    setIngredientsData
  };

  return (
    <RecipeContext.Provider value={value}>
      {children}
    </RecipeContext.Provider>
  );
};
