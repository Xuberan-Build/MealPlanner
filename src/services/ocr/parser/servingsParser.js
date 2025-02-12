import { cleanText } from '../utils/textCleaner';

/**
 * Extracts serving size information from recipe text
 * @param {string} text - Full recipe text
 * @returns {Promise<string>} Serving size information
 */
export async function extractServings(text) {
  const cleanedText = cleanText(text);

  // Common serving patterns
  const servingPatterns = [
    /serves:?\s*(\d+[-‐‑‒–—―]?\d*)\s*(?:people|persons)?/i,
    /servings:?\s*(\d+[-‐‑‒–—―]?\d*)/i,
    /yield:?\s*(\d+[-‐‑‒–—―]?\d*)\s*(?:servings?)?/i,
    /makes:?\s*(\d+[-‐‑‒–—―]?\d*)\s*(?:servings?)?/i,
    /for:?\s*(\d+[-‐‑‒–—―]?\d*)\s*(?:people|persons)/i,
    /(\d+[-‐‑‒–—―]?\d*)\s*servings?/i
  ];

  for (const pattern of servingPatterns) {
    const match = cleanedText.match(pattern);
    if (match && match[1]) {
      // Handle ranges (e.g., "4-6 servings")
      const servingText = match[1];
      if (servingText.match(/\d+[-‐‑‒–—―]\d+/)) {
        // If it's a range, return the range
        return servingText.replace(/[-‐‑‒–—―]/g, '-');
      }
      // Return single number
      return servingText;
    }
  }

  // Look for quantity in ingredient list header
  const ingredientHeaderMatch = cleanedText.match(/ingredients\s+(?:for|serves)?\s*(\d+)/i);
  if (ingredientHeaderMatch && ingredientHeaderMatch[1]) {
    return ingredientHeaderMatch[1];
  }

  return ''; // Return empty string if no serving info found
}
