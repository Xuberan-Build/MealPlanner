import {configureGenkit} from "@genkit-ai/core";
import {googleAI} from "@genkit-ai/googleai"; // Corrected import path
import * as functions from "firebase-functions";

// Ensure you have set the Google AI API key in Firebase Functions config:
// firebase functions:config:set googleai.apikey="YOUR_API_KEY"
// Deploy functions once after setting the config for it to be available.
const googleApiKey = functions.config().googleai?.apikey;

if (!googleApiKey) {
  console.warn(
      "Google AI API key not found in Firebase config (googleai.apikey). ",
      "Genkit Google AI plugin might not work.",
  );
  // Depending on setup, you might want to throw an error in production
  // throw new Error("Missing Google AI API key in Firebase Functions config.");
}

configureGenkit({
  plugins: [
    googleAI({
      // The API key is automatically picked up by the plugin if set
      // in the environment or explicitly passed here.
      // Using Firebase Functions config is recommended.
      // apiKey: googleApiKey // Explicitly passing it if needed.
    }),
  ],
  logLevel: "debug", // Set to 'info' or 'warn' in production
  enableTracingAndMetrics: true, // Optional: Enable telemetry
});

// Export the configuration (optional, but can be useful)
export const genkitConfig = {
  model: "gemini-pro", // Define the model centrally
  // Define JSON output config centrally
  jsonOutputConfig: {output: {format: "json"}},
};
