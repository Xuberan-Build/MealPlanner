# Plan: OCR Enhancement with Genkit & Firebase Functions

This document outlines the plan to enhance the recipe OCR import feature by integrating a Large Language Model (LLM) using Genkit within Firebase Cloud Functions.

## 1. Goal

Replace the existing fragile custom OCR text parser with a more robust LLM-based solution (using Google Gemini via Genkit) to improve the accuracy and reliability of structuring recipe data extracted from images.

## 2. Architecture Overview

The core idea is to perform OCR in the browser, send the raw text to a backend Firebase Cloud Function, have that function use Genkit to call the Gemini LLM for parsing, and return the structured JSON data to the frontend for form population.

```mermaid
graph TD
    subgraph "React Frontend (Browser)"
        A[1. User uploads Image(s)] --> B(2. ocrService: extractRawTextFromImage);
        B -- Raw Text --> C(3. ocrService: Calls 'parseRecipeFlow' Cloud Function);
        C -- Receives Structured JSON --> D(6. ocrService: normalizeRecipe);
        D --> E(7. ocrService: validateRecipe);
        E -- Validated Recipe --> F(8. useRecipeForm Hook / State);
        F --> G(9. Recipe Form Populated);
        C -- Manages Loading/Error --> F;
    end

    subgraph "Backend (Firebase Cloud Functions with Genkit)"
        H(4. 'parseRecipeFlow' HTTP Endpoint Triggered);
        H -- Raw Text --> I(5. Genkit Flow: generate(gemini-pro, prompt));
        I -- Structured JSON --> H;
        H -- Structured JSON / Error --> C;
    end

    style I fill:#lightblue,stroke:#333,stroke-width:2px
```

## 3. Implementation Steps

### 3.1. Backend Setup (Firebase Functions - `functions` directory)

1.  **Install Dependencies:**
    ```bash
    cd functions
    npm install @google-cloud/genkit @google-cloud/genkit-plugins-googleai
    cd ..
    ```
2.  **Configure Genkit (`functions/genkit.config.js` or `functions/index.js`):**
    *   Initialize Genkit (`configureGenkit`).
    *   Configure the Google AI plugin (`googleAI`), specifying the desired model (e.g., `gemini-pro` or `gemini-1.5-flash`).
    *   Configure the model for JSON output (`output: { format: 'json' }`).
    *   Load the Google AI API key securely from Firebase environment configuration (`functions.config().googleai.apikey`). **Do not hardcode keys.**
3.  **Create Genkit Flow (`functions/recipeParser.flow.js`):**
    *   Define a flow named `parseRecipeFlow` using `defineFlow`.
    *   Input schema: `z.string()` (for raw text).
    *   Output schema: Zod schema matching the desired recipe structure (title, ingredients array, instructions, etc.).
    *   Use a detailed prompt instructing the LLM to extract fields and return JSON matching the output schema.
    *   Call `generate()` with the configured model, prompt, and specify the output schema.
    *   Include `try...catch` for error handling within the flow.
4.  **Expose Flow (`functions/index.js`):**
    *   Import the `parseRecipeFlow`.
    *   Use Genkit's `onFlow` helper to expose `parseRecipeFlow` as an HTTP-callable Cloud Function.

### 3.2. Frontend Refactoring (React App - `src` directory)

1.  **Modify `src/services/ocrService.js`:**
    *   Remove imports/usage of `src/services/genkitService.js`.
    *   In `processRecipeImages` (or equivalent):
        *   After getting `combinedText` from `extractRawTextFromImage`, make an HTTPS `POST` request to the deployed `parseRecipeFlow` Cloud Function endpoint.
        *   Send `{ "input": combinedText }` in the request body (matching Genkit's expected format).
        *   Handle the response: parse the JSON (`response.output`) on success, handle errors otherwise.
        *   Pass the structured recipe object to `normalizeRecipe` and `validateRecipe`. Adjust these functions if the LLM output structure differs slightly from the old parser.
2.  **Remove `src/services/genkitService.js`:** Delete this file.
3.  **Update UI (`src/features/recipeBook/recipeForm/RecipeForm.js`, `hooks/useRecipeForm.js`):**
    *   Add/manage loading states (e.g., `isParsing`, `isLlmProcessing`) triggered before calling the Cloud Function and cleared on response/error.
    *   Display user-friendly loading indicators and error messages based on these states.

## 4. Security Considerations

*   LLM API keys **must** be stored securely using Firebase Functions environment configuration (`firebase functions:config:set googleai.apikey="YOUR_API_KEY"`) and accessed via `functions.config()`.
*   Ensure appropriate CORS configuration for the Cloud Function if needed.

## 5. Next Steps

*   Implement the backend changes (install dependencies, configure Genkit, create flow, expose endpoint).
*   Implement the frontend changes (modify `ocrService.js`, update UI components, remove old service).
*   Deploy the Cloud Function.
*   Thoroughly test the end-to-end flow with various recipe images.
*   Refine the LLM prompt as needed for optimal accuracy.