/**
 * Parses a fractional string into a decimal number
 * Handles formats like: "2 1/2", "1/2", "3/4", "2.5", "2"
 * @param {string|number} value - The value to parse
 * @returns {number} The parsed decimal number, or NaN if unparseable
 */
export function parseFraction(value) {
  // If already a number, return it
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  // Convert to string and trim
  const str = String(value).trim();

  // Empty string
  if (!str || str === '') {
    return 0;
  }

  // Try parsing as regular decimal first
  const decimal = parseFloat(str);
  if (!isNaN(decimal) && !str.includes('/')) {
    return decimal;
  }

  // Handle mixed fractions like "2 1/2" or "1 1/4"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10);
    const numerator = parseInt(mixedMatch[2], 10);
    const denominator = parseInt(mixedMatch[3], 10);
    return whole + (numerator / denominator);
  }

  // Handle simple fractions like "1/2" or "3/4"
  const fractionMatch = str.match(/^(\d+)\/(\d+)$/);
  if (fractionMatch) {
    const numerator = parseInt(fractionMatch[1], 10);
    const denominator = parseInt(fractionMatch[2], 10);
    return numerator / denominator;
  }

  // Could not parse, return 0
  console.warn(`Could not parse fraction: "${value}"`);
  return 0;
}

/**
 * Constants for unit conversions to standard units (ml for volume, g for weight)
 * Each category maps units to their conversion factor to the standard unit
 */
export const UNIT_CONVERSIONS = {
    volume: {
      ml: 1,
      l: 1000,
      cup: 236.588,
      tbsp: 14.787,
      tsp: 4.929,
      floz: 29.5735,
      pint: 473.176,
      quart: 946.353,
      gallon: 3785.41
    },
    weight: {
      g: 1,
      kg: 1000,
      oz: 28.3495,
      lb: 453.592
    },
    units: {
      piece: 1,
      whole: 1,
      slice: 1,
      can: 1,
      package: 1
    }
  };

  /**
   * Determines the measurement category of a unit
   * @param {string} unit - The unit to categorize
   * @returns {string|null} The category ('volume', 'weight', 'units') or null if unknown
   */
  export function getUnitCategory(unit) {
    unit = unit.toLowerCase();
    for (const [category, conversions] of Object.entries(UNIT_CONVERSIONS)) {
      if (unit in conversions) {
        return category;
      }
    }
    return null;
  }

  /**
   * Normalizes a quantity to its standard unit within its category
   * @param {number} amount - The quantity amount
   * @param {string} fromUnit - The unit to convert from
   * @returns {Object} Object containing normalized amount and category
   */
  export function normalizeQuantity(amount, fromUnit) {
    if (!amount || !fromUnit) {
      return { amount: amount || 0, unit: fromUnit || '', category: null };
    }

    fromUnit = fromUnit.toLowerCase();
    const category = getUnitCategory(fromUnit);

    if (!category) {
      return { amount, unit: fromUnit, category: null };
    }

    const conversionFactor = UNIT_CONVERSIONS[category][fromUnit];
    const normalizedAmount = amount * conversionFactor;

    return {
      amount: normalizedAmount,
      unit: category === 'volume' ? 'ml' : category === 'weight' ? 'g' : fromUnit,
      category
    };
  }

  /**
   * Combines quantities of the same ingredient with potentially different units
   * @param {Array} quantities - Array of {amount, unit} objects
   * @returns {Object} Combined quantity in the most appropriate unit
   */
  export function combineQuantities(quantities) {
    if (!quantities || quantities.length === 0) {
      return { amount: 0, unit: '' };
    }

    // If all units are the same, simply sum the amounts
    const allSameUnit = quantities.every(q => q.unit === quantities[0].unit);
    if (allSameUnit) {
      return {
        amount: quantities.reduce((sum, q) => sum + (q.amount || 0), 0),
        unit: quantities[0].unit
      };
    }

    // Normalize all quantities and combine
    let totalNormalized = 0;
    let category = null;

    quantities.forEach(q => {
      const normalized = normalizeQuantity(q.amount, q.unit);
      if (normalized.category) {
        totalNormalized += normalized.amount;
        category = normalized.category;
      }
    });

    // Convert back to most appropriate unit
    if (category === 'volume') {
      if (totalNormalized >= 1000) {
        return { amount: totalNormalized / 1000, unit: 'l' };
      }
      return { amount: totalNormalized, unit: 'ml' };
    }

    if (category === 'weight') {
      if (totalNormalized >= 1000) {
        return { amount: totalNormalized / 1000, unit: 'kg' };
      }
      return { amount: totalNormalized, unit: 'g' };
    }

    // For uncategorized units, return as is
    return {
      amount: quantities.reduce((sum, q) => sum + (q.amount || 0), 0),
      unit: quantities[0].unit
    };
  }

  /**
   * Formats a quantity for display
   * @param {number} amount - The quantity amount
   * @param {string} unit - The unit of measurement
   * @returns {string} Formatted quantity string
   */
  export function formatQuantity(amount, unit) {
    if (!amount || amount === 0) return '';

    // Round to 2 decimal places if needed
    const roundedAmount = Number.isInteger(amount) ? amount : Number(amount.toFixed(2));

    // Remove trailing zeros after decimal
    const formattedAmount = String(roundedAmount).replace(/\.?0+$/, '');

    return unit ? `${formattedAmount} ${unit}` : formattedAmount;
  }
