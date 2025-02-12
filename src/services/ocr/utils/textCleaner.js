/**
 * Removes extra whitespace and normalizes text
 * @param {string} text - Raw text to clean
 * @returns {string} Cleaned text
 */
export function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Normalizes fractions in text
   * @param {string} text - Text containing fractions
   * @returns {string} Text with normalized fractions
   */
  export function normalizeFractions(text) {
    const fractionMap = {
      '½': '1/2',
      '⅓': '1/3',
      '¼': '1/4',
      '⅔': '2/3',
      '¾': '3/4'
    };

    return text.replace(/[½⅓¼⅔¾]/g, match => fractionMap[match] || match);
  }

  /**
   * Normalizes measurement units
   * @param {string} text - Text containing measurements
   * @returns {string} Text with normalized measurements
   */
  export function normalizeUnits(text) {
    const unitMap = {
      'tbsp': 'tablespoon',
      'tsp': 'teaspoon',
      'oz': 'ounce',
      'lb': 'pound',
      'c': 'cup',
      'g': 'gram',
      'kg': 'kilogram',
      'ml': 'milliliter',
      'l': 'liter'
    };

    return text.replace(/\b(tbsp|tsp|oz|lb|c|g|kg|ml|l)\b/gi,
      match => unitMap[match.toLowerCase()] || match);
  }
