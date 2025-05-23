// Simplified functions/index.js without Genkit dependencies

import {onRequest} from "firebase-functions/v2/https";
import {initializeApp} from "firebase-admin/app";

// Initialize Firebase Admin
initializeApp();

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
