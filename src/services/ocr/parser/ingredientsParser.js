import { cleanText, normalizeFractions, normalizeUnits } from '../utils/textCleaner';

/**
 * Determines if a line looks like an ingredient
 * @param {string} line - Text line to check
 * @returns {boolean} True if line appears to be an ingredient
 */
function isIngredientLine(line) {
  const patterns = [
    /^\d+/, // Starts with number
    /^[\d⅛⅙⅕¼⅓½⅔¾]/, // Starts with number or fraction
    /^([a-z]+\s)?(cup|cups)/i, // Cup measurements
    /^([a-z]+\s)?(tablespoon|tbsp)/i,
    /^([a-z]+\s)?(teaspoon|tsp)/i,
    /^([a-z]+\s)?(pound|lb)/i,
    /^([a-z]+\s)?(ounce|oz)/i,
    /^•/, // Bullet points
    /^-/, // Dashes
    /^[a-z\s]+\s+(?:to taste|chopped|minced|diced|sliced|grated|crushed)/i, // Common ingredient preparations
    /^[a-z\s]+(?:\(|\[])(.*?)(?:\)|\])/i // Ingredients with parentheses or brackets
  ];

  return patterns.some(pattern => pattern.test(line));
}

/**
 * Extracts structured ingredient information from a line of text
 * @param {string} line - Line containing ingredient information
 * @returns {Object} Structured ingredient data
 */
function parseIngredientLine(line) {
  // Clean and normalize the line
  line = cleanText(line);
  line = normalizeFractions(line);
  line = normalizeUnits(line);

  // Remove bullet points or dashes at start
  line = line.replace(/^[•\-]\s*/, '');

  // Try to extract amount, unit, and ingredient
  const match = line.match(
    /^((?:\d+\/?\d*|\d*\.\d+|\d+\.\d+\/?\d*|\d+\s+\d+\/?\d*)\s*(?:-\s*(?:\d+\/?\d*|\d*\.\d+))?\s*)?([a-zA-Z]*\s*)?(.+?)(?:\s*(?:\(|\[])(.*?)(?:\)|\]))?$/i
  );

  if (match) {
    const [_, amount, unit, ingredient, note] = match;
    // Handle cases where quantity might be in unit position
    if (!amount && unit) {
      amount = unit;
      unit = '';
    }
    
    return {
      amount: amount ? amount.trim() : '',
      unit: unit ? unit.trim() : '',
      ingredientId: ingredient ? ingredient.trim() : line.trim(),
      note: note ? note.trim() : ''
    };
  }

  // Fallback: return the whole line as the ingredient
  return {
    amount: '',
    unit: '',
    ingredientId: line.trim()
  };
}

/**
 * Extracts ingredients from recipe text
 * @param {string} text - Full recipe text
 * @returns {Promise<Array>} List of structured ingredient objects
 */
export async function extractIngredients(text) {
  const cleanedText = cleanText(text);
  let ingredients = [];
  let inIngredientsSection = false;

  // Try to find ingredients section
  const sections = cleanedText.split(/(?:instructions|directions|method|steps)/i)[0];
  const ingredientsMatch = sections.match(/ingredients?[:\s]+([\s\S]+)$/i);

  if (ingredientsMatch) {
    // Process ingredients section
    const lines = ingredientsMatch[1].split('\n')
      .map(line => cleanText(line))
      .filter(line => line.length > 0);

    for (const line of lines) {
      if (isIngredientLine(line)) {
        ingredients.push(parseIngredientLine(line));
      }
    }
  } else {
    // Fallback: look for lines that look like ingredients
    const lines = cleanedText.split('\n')
      .map(line => cleanText(line))
      .filter(line => line.length > 0);

    for (const line of lines) {
      if (isIngredientLine(line)) {
        ingredients.push(parseIngredientLine(line));
      }
    }
  }

  return ingredients;
}
