// src/services/ocrService.js

import { createWorker } from 'tesseract.js';
// Placeholder for the actual Cloud Function URL
// Replace this with the URL obtained after deploying the 'parseRecipe' function
const PARSE_RECIPE_FUNCTION_URL = 'https://us-central1-meal-planner-v1-9be19.cloudfunctions.net/parseRecipe';

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
      // Access the API key from environment variables
      const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
      console.log('API Key defined:', !!OPENAI_API_KEY); // Logs true/false without exposing the key

      if (!OPENAI_API_KEY) {
        console.error('OpenAI API key is not defined in environment variables!');
        throw new Error('OpenAI API key is missing. Please check your environment variables.');
      }
        
      const prompt = `
      Analyze the following raw text extracted from a recipe image using OCR.
      Clean up any OCR errors, normalize formatting, and extract the key details.
      Return the extracted information as a valid JSON object matching the provided schema.
      
      Fields to extract:
      - title: The main title of the recipe.
      - **ingredients**: array of objects — Each ingredient must have:
        - **amount**: string — Quantity (e.g., "1", "2½", "a pinch")
        - **unit**: string — Unit of measurement (e.g., "cup", "tablespoon", "grams", or empty if none)
        - **ingredientId**: string — Ingredient name only (e.g., "broccoli florets", "soy sauce")      - instructions: The step-by-step instructions.
      - prepTime: Estimated preparation time.
      - cookTime: Estimated cooking time.
      - servings: How many servings the recipe makes.
      - dietType: Any dietary classification mentioned (e.g., Vegan, Gluten-Free).
      - mealType: The type of meal (e.g., Appetizer, Main Course, Dessert).
      
      If a field (especially optional ones like times, servings, dietType, mealType)
      is not clearly present in the text, omit it or return an empty string/array
      as appropriate for the schema, but ensure the overall JSON structure is valid.
      
      Raw OCR Text:
      """
      ${combinedText}
      """
      
      Output JSON:
      `;
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0, // optional but recommended for deterministic output
        }),
      });
      
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI request failed with status ${response.status}: ${errorBody}`);
      }
      
      const result = await response.json();
      
      if (!result || !result.choices || !result.choices[0]?.message?.content) {
        throw new Error('Invalid response structure from OpenAI.');
      }
      
      try {
        structuredRecipe = JSON.parse(result.choices[0].message.content);
      } catch (err) {
        throw new Error('Failed to parse OpenAI response as JSON: ' + err.message);
      }
      
      console.log('Successfully parsed recipe JSON from OpenAI.');

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
  normalizeRecipe,
  validateRecipe
};
