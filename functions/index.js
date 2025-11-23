// Simplified functions/index.js without Genkit dependencies

import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";
import {defineSecret} from "firebase-functions/params";

// Initialize Firebase Admin
initializeApp();

// Define the OpenAI API key as a secret
const openaiApiKey = defineSecret("OPENAI_API_KEY");

// Simple HTTP function for testing
export const helloWorld = onRequest((request, response) => {
  response.send("Hello from Firebase Functions!");
});

// URL proxy function to handle CORS issues
export const fetchRecipeUrl = onRequest(
    {cors: true},
    async (request, response) => {
      try {
        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).send("Method not allowed");
          return;
        }

        const {url} = request.body;

        if (!url) {
          response.status(400).send("URL is required");
          return;
        }

        console.log("Fetching URL:", url);

        // Fetch the URL content
        const fetchResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
            "Accept": "text/html,application/xhtml+xml," +
          "application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
          },
        });

        if (!fetchResponse.ok) {
          throw new Error(
              `Failed to fetch: ${fetchResponse.status} ${fetchResponse.statusText}`,
          );
        }

        const htmlContent = await fetchResponse.text();

        response.json({
          success: true,
          html: htmlContent,
          url: url,
        });
      } catch (error) {
        console.error("Error fetching URL:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

// New secure function that extracts recipe from URL using OpenAI
export const extractRecipeFromUrl = onRequest(
    {
      cors: true,
      secrets: [openaiApiKey],
    },
    async (request, response) => {
      try {
        // Only allow POST requests
        if (request.method !== "POST") {
          response.status(405).json({
            success: false,
            error: "Method not allowed",
          });
          return;
        }

        const {url} = request.body;

        if (!url) {
          response.status(400).json({
            success: false,
            error: "URL is required",
          });
          return;
        }

        console.log("Extracting recipe from URL:", url);

        // Step 1: Fetch the URL content
        const fetchResponse = await fetch(url, {
          method: "GET",
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; RecipeBot/1.0)",
            "Accept": "text/html,application/xhtml+xml," +
            "application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
          },
        });

        if (!fetchResponse.ok) {
          throw new Error(
              `Failed to fetch URL: ${fetchResponse.status} ` +
            `${fetchResponse.statusText}`,
          );
        }

        const htmlContent = await fetchResponse.text();
        console.log("Successfully fetched HTML content, length:", htmlContent.length);

        // Step 2: Convert HTML to text
        const textContent = htmlContent
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s{2,}/g, " ")
            .trim();

        // Limit text content to avoid token limits
        const limitedTextContent = textContent.substring(0, 12000);
        console.log("Extracted text content, length:", limitedTextContent.length);

        // Step 3: Call OpenAI to extract recipe information
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

        console.log("Calling OpenAI to parse recipe...");
        const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${openaiApiKey.value()}`,
          },
          body: JSON.stringify({
            model: "gpt-3.5-turbo",
            messages: [{role: "user", content: prompt}],
            temperature: 0,
          }),
        });

        if (!aiResponse.ok) {
          const errorBody = await aiResponse.text();
          throw new Error(
              `OpenAI request failed with status ${aiResponse.status}: ${errorBody}`,
          );
        }

        const result = await aiResponse.json();

        if (!result || !result.choices || !result.choices[0]?.message?.content) {
          throw new Error("Invalid response structure from OpenAI.");
        }

        // Parse and return the recipe
        const structuredRecipe = JSON.parse(result.choices[0].message.content);
        console.log("Successfully parsed recipe JSON from OpenAI:", structuredRecipe);

        response.json({
          success: true,
          recipe: structuredRecipe,
        });
      } catch (error) {
        console.error("Error extracting recipe:", error);
        response.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });
