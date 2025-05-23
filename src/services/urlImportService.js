// src/services/urlImportService.js

// Function to extract recipe from a URL
export async function extractRecipeFromUrl(url) {
  try {
    console.log('Extracting recipe from URL:', url);
    
    // Access the API key from environment variables
    const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;
    
    if (!OPENAI_API_KEY) {
      console.error('OpenAI API key is not defined in environment variables!');
      throw new Error('OpenAI API key is missing. Please check your environment variables.');
    }

    // Use our Firebase Cloud Function as proxy
const functionUrl = 'https://us-central1-meal-planner-v1-9be19.cloudfunctions.net/fetchRecipeUrl';

// Fetch HTML content using our Cloud Function
console.log('Fetching URL content via Cloud Function:', functionUrl);
const response = await fetch(functionUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ url: url }),
});

    if (!response.ok) {
      throw new Error(`Failed to fetch URL content: ${response.status} ${response.statusText}`);
    }

    // Parse the JSON response from our Cloud Function
const responseData = await response.json();
console.log('Cloud Function response:', responseData);

if (!responseData.success) {
  throw new Error(`Cloud Function error: ${responseData.error}`);
}

const htmlContent = responseData.html;
console.log('Successfully fetched HTML content, length:', htmlContent.length);

    // Simple HTML to text conversion
    // This is a basic implementation; a more sophisticated approach would use 
    // a proper HTML parser like cheerio or something similar
    const textContent = htmlContent
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    console.log('Extracted text content, length:', textContent.length);
    
    // Limit text content to avoid token limits (around 12,000 characters)
    const limitedTextContent = textContent.substring(0, 12000);
    
    // Call OpenAI to extract recipe information
    const prompt = `
    Analyze the following text extracted from a recipe webpage.
    Clean up any formatting issues, normalize the content, and extract the key recipe details.
    Return the extracted information as a valid JSON object matching the provided schema.
    
    Fields to extract:
    - title: The main title of the recipe.
    - **ingredients**: array of objects — Each ingredient must have:
      - **amount**: string — Quantity (e.g., "1", "2½", "a pinch")
      - **unit**: string — Unit of measurement (e.g., "cup", "tablespoon", "grams", or empty if none)
      - **ingredientId**: string — Ingredient name only (e.g., "broccoli florets", "soy sauce")
    - instructions: The step-by-step instructions.
    - prepTime: Estimated preparation time.
    - cookTime: Estimated cooking time.
    - servings: How many servings the recipe makes.
    - dietType: Any dietary classification mentioned (e.g., Vegan, Gluten-Free).
    - mealType: The type of meal (e.g., Appetizer, Main Course, Dessert).
    
    If a field (especially optional ones like times, servings, dietType, mealType)
    is not clearly present in the text, omit it or return an empty string/array
    as appropriate for the schema, but ensure the overall JSON structure is valid.
    
    Webpage Text:
    """
    ${limitedTextContent}
    """
    
    Output JSON:
    `;
    
    console.log('Calling OpenAI to parse recipe...');
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0, // Keep it deterministic
      }),
    });
    
    if (!aiResponse.ok) {
      const errorBody = await aiResponse.text();
      throw new Error(`OpenAI request failed with status ${aiResponse.status}: ${errorBody}`);
    }
    
    const result = await aiResponse.json();
    
    if (!result || !result.choices || !result.choices[0]?.message?.content) {
      throw new Error('Invalid response structure from OpenAI.');
    }
    
    try {
      const structuredRecipe = JSON.parse(result.choices[0].message.content);
      console.log('Successfully parsed recipe JSON from OpenAI:', structuredRecipe);
      
      // Normalize the recipe structure (same function from ocrService.js)
      const normalizedRecipe = normalizeRecipe(structuredRecipe);
      
      // Validate the recipe (same function from ocrService.js)
      validateRecipe(normalizedRecipe);
      
      return normalizedRecipe;
    } catch (err) {
      throw new Error('Failed to parse OpenAI response as JSON: ' + err.message);
    }
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