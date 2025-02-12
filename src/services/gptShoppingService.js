// src/services/gptShoppingService.js
import MistralClient from '@mistralai/mistralai';

// Types of grocery categories we support - defined at the top level
const GROCERY_CATEGORIES = {
  PRODUCE: 'Produce',
  DAIRY: 'Dairy',
  MEAT_SEAFOOD: 'Meat & Seafood',
  PANTRY: 'Pantry',
  FROZEN: 'Frozen',
  BEVERAGES: 'Beverages',
  OTHER: 'Other'
};

// Custom error class - defined at the top level
class ShoppingListError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ShoppingListError';
    this.details = details;
  }
}

// Helper function to parse the AI response into structured shopping list items
function parseShoppingListResponse(response) {
  try {
    // Split response into lines and filter out empty ones
    const lines = response.split('\n').filter(line => line.trim());

    // Initialize result structure
    const shoppingList = [];
    let currentCategory = GROCERY_CATEGORIES.OTHER;

    for (const line of lines) {
      // Check if line defines a new category
      const categoryMatch = line.match(/^([A-Za-z& ]+):/);
      if (categoryMatch) {
        // Validate that the category exists in our predefined categories
        const matchedCategory = Object.values(GROCERY_CATEGORIES)
          .find(cat => cat.toLowerCase() === categoryMatch[1].trim().toLowerCase());
        currentCategory = matchedCategory || GROCERY_CATEGORIES.OTHER;
        continue;
      }

      // Parse item details (quantity and unit are optional)
      const itemMatch = line.match(/[-•]?\s*([^-–]+?)(?:\s*[-–]\s*(\d*\.?\d+)\s*(\w+))?$/);
      if (itemMatch) {
        const [, name, quantity, unit] = itemMatch;
        shoppingList.push({
          id: `item-${Math.random().toString(36).substr(2, 9)}`,
          name: name.trim(),
          quantity: quantity ? parseFloat(quantity) : 1,
          unit: unit || 'items',
          category: currentCategory,
          estimatedCost: 0,
          alreadyHave: false,
          notes: ''
        });
      }
    }

    return shoppingList;
  } catch (error) {
    console.error('Error parsing shopping list response:', error);
    throw new ShoppingListError('Failed to parse shopping list response', error);
  }
}

// Main function to generate shopping list from meal plan
async function generateShoppingList(mealPlan) {
  // Debug logs to verify environment setup
  console.log('API Key available:', !!process.env.REACT_APP_MISTRAL_API_KEY);
  console.log('API Key length:', process.env.REACT_APP_MISTRAL_API_KEY?.length);

  try {
    // Validate input
    if (!mealPlan || Object.keys(mealPlan).length === 0) {
      throw new ShoppingListError('No meal plan provided');
    }

    // Format meal plan for the AI prompt
    const formattedMealPlan = Object.entries(mealPlan).map(([day, meals]) => ({
      day,
      meals: Object.entries(meals).map(([type, recipe]) => ({
        type,
        recipe: recipe?.title || 'No recipe selected',
        ingredients: recipe?.ingredients || []
      }))
    }));

    // Make API request to Mistral
    const client = new MistralClient(process.env.REACT_APP_MISTRAL_API_KEY);

    const chatResponse = await client.chatCompletions.create({
      model: "mistral-small-latest",
      messages: [
        {
          role: "system",
          content: `Create organized shopping lists using these categories: ${Object.values(GROCERY_CATEGORIES).join(', ')}. Format items with quantities when possible.`
        },
        {
          role: "user",
          content: `Create a detailed shopping list from this meal plan, organizing ingredients by category: ${JSON.stringify(formattedMealPlan, null, 2)}`
        }
      ]
    });

    const response = chatResponse;

    // Handle API response
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Mistral API Error Details:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        headers: Object.fromEntries(response.headers.entries())
      });
      throw new ShoppingListError(
        'Failed to generate shopping list',
        errorData || response.statusText
      );
    }

    const data = await response.json();

    // Parse and structure the response
    const shoppingList = parseShoppingListResponse(data.choices[0].message.content);

    // Add some basic validation of the result
    if (shoppingList.length === 0) {
      throw new ShoppingListError('Generated shopping list is empty');
    }

    return shoppingList;

  } catch (error) {
    // Log error details for debugging
    console.error('Shopping List Generation Error:', {
      message: error.message,
      details: error.details,
      mealPlanDays: mealPlan ? Object.keys(mealPlan).length : 0
    });

    // Rethrow as a ShoppingListError if it isn't already
    if (!(error instanceof ShoppingListError)) {
      throw new ShoppingListError(
        'An unexpected error occurred while generating the shopping list',
        error
      );
    }
    throw error;
  }
}

// Single export statement for all public items
export {
  generateShoppingList,
  GROCERY_CATEGORIES,
  ShoppingListError
};
