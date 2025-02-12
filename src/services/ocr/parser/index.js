import { extractTitle } from './titleParser';
import { extractTimeInfo } from './timeParser';
import { extractServings } from './servingsParser';
import { extractIngredients } from './ingredientsParser';
import { extractInstructions } from './instructionsParser';
import { cleanText } from '../utils/textCleaner';

/**
 * Parses raw OCR text into structured recipe data
 * @param {string} text - Raw OCR text
 * @returns {Promise<Object>} Parsed recipe object
 */
export async function parseRecipeText(text) {
  // Clean the text first
  const cleanedText = cleanText(text);

  // Parse each section in parallel
  const [
    title,
    timeInfo,
    servings,
    ingredients,
    instructions
  ] = await Promise.all([
    extractTitle(cleanedText),
    extractTimeInfo(cleanedText),
    extractServings(cleanedText),
    extractIngredients(cleanedText),
    extractInstructions(cleanedText)
  ]);

  return {
    title,
    ...timeInfo,
    servings,
    ingredients,
    instructions,
    dietType: '', // These fields will need to be filled in manually
    mealType: ''
  };
}
