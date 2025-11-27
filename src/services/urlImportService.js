// src/services/urlImportService.js
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase';

// Function to extract recipe from a URL
export async function extractRecipeFromUrl(url) {
  try {
    console.log('Extracting recipe from URL:', url);

    // Verify user is authenticated
    if (!auth.currentUser) {
      throw new Error('You must be logged in to import recipes');
    }

    // Call our secure Cloud Function
    const functionUrl = 'https://us-central1-meal-planner-v1-9be19.cloudfunctions.net/extractRecipeFromUrl';

    console.log('Calling Cloud Function to extract recipe');
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Cloud Function response:', responseData);

    if (!responseData.success) {
      throw new Error(`Cloud Function error: ${responseData.error}`);
    }

    const structuredRecipe = responseData.recipe;
    console.log('Successfully received recipe from Cloud Function:', structuredRecipe);

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