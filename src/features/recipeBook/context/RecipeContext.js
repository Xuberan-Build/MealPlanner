import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { getRecipes, addRecipe, updateRecipe, deleteRecipe } from '../../../services/recipeService';
import { auth } from '../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';

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

  // Filter and group recipes (memoized)
  const recipesByDiet = useMemo(() => {
    const filteredRecipes = allRecipes.filter(recipe => {
      // Search filter
      const matchesSearch = !searchTerm.trim() ||
        recipe.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.mealType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        recipe.dietType?.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      // Diet type filter
      const matchesDiet = filters.dietTypes.length === 0 ||
        filters.dietTypes.includes(recipe.dietType);

      if (!matchesDiet) return false;

      // Meal type filter
      const matchesMeal = filters.mealTypes.length === 0 ||
        filters.mealTypes.includes(recipe.mealType);

      return matchesMeal;
    });

    // Group by diet type
    const grouped = filteredRecipes.reduce((acc, recipe) => {
      const diet = recipe.dietType || 'Uncategorized';
      if (!acc[diet]) {
        acc[diet] = [];
      }
      acc[diet].push(recipe);
      return acc;
    }, {});

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
      await updateRecipe(recipeData);
      setAllRecipes(prev =>
        prev.map(recipe => recipe.id === recipeData.id ? recipeData : recipe)
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
