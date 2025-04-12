// src/services/ocrService.js

import { createWorker } from 'tesseract.js';
// Removed: import { parseRecipeText } from './ocr/parser';
// Placeholder for the actual Cloud Function URL
// Replace this with the URL obtained after deploying the 'parseRecipe' function
const PARSE_RECIPE_FUNCTION_URL = 'YOUR_CLOUD_FUNCTION_URL_HERE/parseRecipe';

// Extracts raw OCR text from the provided image file
export async function extractRawTextFromImage(imageFile) {
  const worker = await createWorker();
  await worker.loadLanguage('eng');
  await worker.initialize('eng');

  try {
    let imageUrl;
    
    // More robust image handling
    if (imageFile instanceof File || imageFile instanceof Blob) {
      imageUrl = URL.createObjectURL(imageFile);
    } else if (typeof imageFile === 'string' && imageFile.startsWith('data:')) {
      imageUrl = imageFile; // Use data URL as is
    } else if (typeof imageFile === 'string' && !imageFile.includes(' ')) {
      imageUrl = imageFile; // Use clean URL as is
    } else {
      throw new Error('Invalid image format');
    }

    const result = await worker.recognize(imageUrl);
    
    // Clean up Object URL if we created one
    if (imageUrl && (imageFile instanceof File || imageFile instanceof Blob)) {
      URL.revokeObjectURL(imageUrl);
    }

    await worker.terminate();
    
    // Add validation for the extracted text
    if (!result.data.text || result.data.text.trim().length === 0) {
      throw new Error('No text extracted from image');
    }

    console.log('Raw OCR text extracted:', result.data.text.substring(0, 100) + '...');
    return result.data.text;
  } catch (error) {
    console.error('OCR extraction error:', error);
    await worker.terminate();
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
}

// Removed: cleanRecipeText function (replaced by Cloud Function call)
// Normalizes recipe data structure
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

// Validates required recipe fields and provides defaults for missing fields
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

// Main function to process recipe images
export async function processRecipeImages(images) {
  try {
    let combinedText = '';
    let errorCount = 0;
    
    for (const image of images) {
      try {
        const text = await extractRawTextFromImage(image);
        if (text && text.trim()) {
          combinedText += text + '\n\n';
        }
      } catch (err) {
        errorCount++;
        console.warn(`Failed to process image: ${err.message}`);
      }
    }

    if (combinedText.trim().length === 0) {
      throw new Error('No text could be extracted from any of the images');
    }

    console.log('Combined text from all images:', combinedText.substring(0, 100) + '...');

    // Structure the text using the Genkit Cloud Function
    console.log('Calling parseRecipe Cloud Function...');
    let structuredRecipe;
    try {
      const response = await fetch(PARSE_RECIPE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ input: combinedText }), // Genkit expects { "input": ... }
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Cloud Function request failed with status ${response.status}: ${errorBody}`);
      }

      const result = await response.json();

      // Genkit flow output is typically in result.output
      if (!result || !result.output) {
         throw new Error('Invalid response structure from Cloud Function.');
      }
      structuredRecipe = result.output;
      console.log('Successfully received structured recipe from Cloud Function.');

    } catch (error) {
      console.error('Error calling parseRecipe Cloud Function:', error);
      throw new Error(`Failed to structure recipe via LLM: ${error.message}`);
    }

    // Normalize the recipe structure
    const normalizedRecipe = normalizeRecipe(structuredRecipe);
    
    // Validate the recipe
    validateRecipe(normalizedRecipe);
    
    return normalizedRecipe;
  } catch (error) {
    console.error('Recipe processing error:', error);
    throw new Error(error.message || 'Failed to process recipe images');
  }
}

// Process a single image file
export async function processRecipeImage(imageFile) {
  return processRecipeImages([imageFile]);
}

// Backwards compatibility for existing code
export const processRecipeText = processRecipeImage;

// Export all functions for testing and flexibility
export {
  // Removed cleanRecipeText from exports
  normalizeRecipe,
  validateRecipe
};