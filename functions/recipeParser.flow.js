import {defineFlow, generate} from "genkit"; // Corrected import path
import {z} from "zod";
import {genkitConfig} from "./genkit.config.js"; // Assuming config is exported

// Define the expected output structure using Zod
const RecipeSchema = z.object({
  title: z.string().describe("The title of the recipe"),
  ingredients: z.array(z.string()).describe("List of ingredients"),
  instructions: z.string().describe("Cooking or preparation instructions"),
  prepTime: z.string().optional()
      .describe("Preparation time (e.g., '15 minutes')"),
  cookTime: z.string().optional().describe("Cooking time (e.g., '30 minutes')"),
  servings: z.string().optional()
      .describe("Number of servings (e.g., '4 servings')"),
  dietType: z.string().optional()
      .describe("Dietary classification (e.g., 'Vegetarian')"),
  mealType: z.string().optional()
      .describe("Meal type (e.g., 'Dinner', 'Dessert')"),
});

// Define the Genkit flow
export const parseRecipeFlow = defineFlow(
    {
      name: "parseRecipeFlow",
      inputSchema: z.string().describe("Raw OCR text from a recipe image"),
      outputSchema: RecipeSchema,
    },
    async (rawText) => {
      const prompt = `
Analyze the following raw text extracted from a recipe image using OCR.
Clean up any OCR errors, normalize formatting, and extract the key details.
Return the extracted information as a valid JSON object matching the
provided schema.

Fields to extract:
- title: The main title of the recipe.
- ingredients: A list of all ingredients, one per array item.
- instructions: The step-by-step instructions.
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
${rawText}
"""

Output JSON:
`;

      try {
        const llmResponse = await generate({
          model: genkitConfig.model, // Use model from config
          prompt: prompt,
          config: genkitConfig.jsonOutputConfig, // Use JSON output config
          output: {
            schema: RecipeSchema, // Validate output against the Zod schema
          },
        });

        const recipeData = llmResponse.output();

        if (!recipeData) {
          throw new Error("LLM returned empty output after parsing.");
        }

        // Optional: Add further validation if needed, although Zod handles
        // structure
        if (
          !recipeData.title &&
          (!recipeData.ingredients || recipeData.ingredients.length === 0)
        ) {
          console.warn("LLM output missing title and ingredients.");
          // Decide if this is an error or just a poor extraction
        }

        return recipeData;
      } catch (error) {
        console.error("Error in parseRecipeFlow:", error);
        // Re-throw or handle error appropriately for the Cloud Function
        throw new Error(
            `Failed to parse recipe text using LLM: ${error.message}`,
        );
      }
    },
);
