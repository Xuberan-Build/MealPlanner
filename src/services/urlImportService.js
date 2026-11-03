// src/services/urlImportService.js
import { callImportFunction } from './aiImportClient';

// Function to extract recipe from a URL
export async function extractRecipeFromUrl(url) {
  try {
    const responseData = await callImportFunction('extractRecipeFromUrl', { url });
    const structuredRecipe = responseData.recipe;

    // Normalize the recipe structure (same function from ocrService.js)
    const normalizedRecipe = normalizeRecipe(structuredRecipe);

    // Validate the recipe (same function from ocrService.js)
    validateRecipe(normalizedRecipe);

    return normalizedRecipe;
  } catch (error) {
    console.error('Recipe URL extraction error:', error);
    throw new Error(error.message || 'Failed to extract recipe from URL');
  }
}

// Normalizes recipe data structure (copied from ocrService.js for consistency)
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

// Validates required recipe fields (copied from ocrService.js for consistency)
function validateRecipe(recipe) {
  // Check if we have at least a title or ingredients
  if (!recipe.title && (!recipe.ingredients || recipe.ingredients.length === 0)) {
    throw new Error('Recipe must have at least a title or ingredients');
  }
  
  // Provide defaults for missing fields
  if (!recipe.title) {
    console.warn('Recipe missing title, using default');
    recipe.title = 'Untitled Recipe';
  }
  
  if (!recipe.ingredients || !Array.isArray(recipe.ingredients)) {
    console.warn('Recipe missing ingredients, using empty array');
    recipe.ingredients = [];
  }
  
  if (!recipe.instructions) {
    console.warn('Recipe missing instructions, using empty string');
    recipe.instructions = '';
  }
  
  return true;
}