/**
 * Cloud Functions entry point.
 */

// Initialize Genkit configuration first
import "./genkit.config.js";

import {onFlow} from "@genkit-ai/firebase";
import {parseRecipeFlow} from "./recipeParser.flow.js";

// Expose the Genkit flow as an HTTP function
export const parseRecipe = onFlow(
    {
      flow: parseRecipeFlow,
      // Add security/CORS options if needed, e.g.,
      // cors: true, // Allow all origins (adjust for production)
      // authPolicy: ..., // If authentication is required
    },
);

// Example of keeping other function types (optional)
// const {onRequest} = require("firebase-functions/v2/https");
// const logger = require("firebase-functions/logger");
// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });
