// Simplified functions/index.js without Genkit dependencies

import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

// Simple HTTP function for testing
export const helloWorld = onRequest((request, response) => {
  response.send("Hello from Firebase Functions!");
});

// We've disabled the parseRecipe function since it used Genkit
// If you need OCR functionality, you can implement it directly with OpenAI
// without relying on Genkit
