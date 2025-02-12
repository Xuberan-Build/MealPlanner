// src/services/genkitService.js
import { configureGenkit } from '@genkit-ai/core';
import { defineFlow } from '@genkit-ai/flow';
import { mistral, openMixtral8x22B, generate } from 'genkitx-mistral';
import { z } from 'zod'; // Add this import for validation

// First, let's check if our API key is available
const MISTRAL_API_KEY = process.env.REACT_APP_MISTRAL_API_KEY;
if (!MISTRAL_API_KEY) {
  console.error('Missing Mistral API key in environment variables');
}

// Initialize Genkit with Mistral
configureGenkit({
  plugins: [
    mistral({
      apiKey: MISTRAL_API_KEY,
      // Add debug logging to help us understand what's happening
      onApiRequest: (req) => console.log('Mistral API Request:', req),
      onApiResponse: (res) => console.log('Mistral API Response:', res)
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});

// Define a schema for our meal plan structure
const MealSchema = z.object({
  title: z.string().optional(),
  recipe: z.object({}).optional(),
});

const DayMealsSchema = z.object({
  breakfast: MealSchema.optional(),
  lunch: MealSchema.optional(),
  dinner: MealSchema.optional(),
  snacks: MealSchema.optional(),
});

const MealPlanSchema = z.record(DayMealsSchema);

// Define the shopping list generation flow
export const generateShoppingListFlow = defineFlow(
  {
    name: 'shoppingListFlow',
    inputSchema: MealPlanSchema,
    outputSchema: z.array(z.string()),
  },
  async (mealPlan) => {
    try {
      const prompt = `Create a shopping list from this meal plan with items categorized as Produce, Dairy, Meat & Seafood, Pantry, Frozen, or Beverages. Format each line as "Category: Item - quantity unit"\n\nMeal Plan: ${JSON.stringify(mealPlan, null, 2)}`;

      console.log('Generating shopping list with prompt:', prompt);

      const response = await generate({
        model: openMixtral8x22B,
        prompt: prompt,
      });

      const result = await response.text();
      console.log('Generated shopping list:', result);

      return result.split('\n').filter(line => line.trim());
    } catch (error) {
      console.error('Error in generateShoppingListFlow:', error);
      throw error;
    }
  }
);
