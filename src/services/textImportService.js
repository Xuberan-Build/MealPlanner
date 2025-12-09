// src/services/textImportService.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase';

/**
 * Process pasted recipe text using AI to extract structured recipe data
 * @param {string} recipeText - The pasted recipe text
 * @returns {Promise<Object>} - Normalized recipe object
 */
export async function processRecipeText(recipeText) {
  try {
    console.log('Processing pasted recipe text...');

    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('You must be logged in to process recipes');
    }

    // Call Cloud Function to process the text with AI
    const functions = getFunctions(app);
    const processTextFn = httpsCallable(functions, 'processRecipeText');

    const result = await processTextFn({
      text: recipeText.trim()
    });

    if (!result.data || !result.data.success) {
      throw new Error(result.data?.error || 'Failed to process recipe text');
    }

    const structuredRecipe = result.data.recipe;
    console.log('Successfully extracted recipe from text:', structuredRecipe);

    // Normalize the recipe structure
    const normalizedRecipe = normalizeRecipe(structuredRecipe);

    // Validate the recipe
    validateRecipe(normalizedRecipe);

    return normalizedRecipe;
  } catch (error) {
    console.error('Recipe text processing error:', error);

    // Provide user-friendly error messages
    if (error.message?.includes('auth')) {
      throw new Error('Please sign in to import recipes');
    } else if (error.message?.includes('quota') || error.message?.includes('limit')) {
      throw new Error('Processing limit reached. Please try again later.');
    } else {
      throw new Error(error.message || 'Failed to process recipe text. Please try again.');
    }
  }
}

/**
 * Normalizes recipe data structure
 */
function normalizeRecipe(recipe) {
  return {
    title: recipe.title || '',
    ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
    instructions: recipe.instructions || '',
    prepTime: recipe.prepTime || '',
    cookTime: recipe.cookTime || '',
    servings: recipe.servings || '',
    dietType: recipe.dietType || '',
    mealType: recipe.mealType || '',
  };
}

/**
 * Validates required recipe fields
 */
function validateRecipe(recipe) {
  // Check if we have at least a title or ingredients
  if (!recipe.title && (!recipe.ingredients || recipe.ingredients.length === 0)) {
    throw new Error('Could not extract recipe information. Please ensure the text includes ingredients and instructions.');
  }

  // Provide defaults for missing fields
  if (!recipe.title) {
    console.warn('Recipe missing title, using default');
    recipe.title = 'Untitled Recipe';
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    console.warn('Recipe missing ingredients');
    recipe.ingredients = [];
  }

  if (!recipe.instructions) {
    console.warn('Recipe missing instructions');
    recipe.instructions = '';
  }
}
