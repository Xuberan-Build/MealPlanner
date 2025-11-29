/**
 * Product Utility Functions
 *
 * Helper functions for working with product data:
 * - Quantity parsing and conversion
 * - Product normalization
 * - Price calculations
 * - Serving size conversions
 */

/**
 * Common ingredient densities (grams per cup)
 * Used for volume-to-weight conversions
 */
const INGREDIENT_DENSITIES = {
  // Flours
  'flour': 120,
  'all-purpose flour': 120,
  'bread flour': 127,
  'cake flour': 114,
  'whole wheat flour': 120,

  // Sugars
  'sugar': 200,
  'granulated sugar': 200,
  'brown sugar': 220,
  'powdered sugar': 120,
  'confectioners sugar': 120,

  // Liquids (ml per cup)
  'water': 236.588,
  'milk': 244,
  'oil': 218,
  'butter': 227,
  'honey': 340,

  // Other common ingredients
  'rice': 185,
  'oats': 80,
  'cocoa powder': 85,
  'salt': 292,
  'baking powder': 192,
  'baking soda': 220,
  'cornstarch': 128,
  'yeast': 7
};

/**
 * Parse quantity string from product packaging
 * Examples: "5 lb", "1 gallon", "16 oz", "500 ml"
 * @param {string} quantityStr - Quantity string
 * @returns {Object} Parsed quantity {amount, unit}
 */
export const parseProductQuantity = (quantityStr) => {
  if (!quantityStr) {
    return { amount: 0, unit: '' };
  }

  const str = quantityStr.toLowerCase().trim();

  // Common patterns
  const patterns = [
    // "5 lb", "500 g", "1.5 kg"
    /(\d+\.?\d*)\s*(lb|lbs|pound|pounds|oz|ounce|ounces|g|gram|grams|kg|kilogram|kilograms)/,
    // "1 gallon", "2 quarts"
    /(\d+\.?\d*)\s*(gallon|gallons|gal|quart|quarts|qt|pint|pints|pt|cup|cups)/,
    // "500 ml", "1 l"
    /(\d+\.?\d*)\s*(ml|milliliter|milliliters|l|liter|liters)/,
    // "12 count", "24 pack"
    /(\d+\.?\d*)\s*(count|ct|pack|pk|piece|pieces|pc)/,
    // Just a number
    /(\d+\.?\d*)/
  ];

  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      return {
        amount: parseFloat(match[1]),
        unit: match[2] || ''
      };
    }
  }

  return { amount: 0, unit: str };
};

/**
 * Convert product quantity to standard units
 * @param {number} amount - Amount
 * @param {string} unit - Unit
 * @returns {Object} Converted quantity {amount, unit, grams, ml}
 */
export const convertToStandardUnits = (amount, unit) => {
  if (!amount || !unit) {
    return { amount, unit, grams: 0, ml: 0 };
  }

  const u = unit.toLowerCase().trim();
  let grams = 0;
  let ml = 0;

  // Weight conversions to grams
  const weightConversions = {
    'g': 1,
    'gram': 1,
    'grams': 1,
    'kg': 1000,
    'kilogram': 1000,
    'kilograms': 1000,
    'oz': 28.3495,
    'ounce': 28.3495,
    'ounces': 28.3495,
    'lb': 453.592,
    'lbs': 453.592,
    'pound': 453.592,
    'pounds': 453.592
  };

  // Volume conversions to ml
  const volumeConversions = {
    'ml': 1,
    'milliliter': 1,
    'milliliters': 1,
    'l': 1000,
    'liter': 1000,
    'liters': 1000,
    'cup': 236.588,
    'cups': 236.588,
    'tbsp': 14.787,
    'tablespoon': 14.787,
    'tablespoons': 14.787,
    'tsp': 4.929,
    'teaspoon': 4.929,
    'teaspoons': 4.929,
    'floz': 29.5735,
    'fl oz': 29.5735,
    'pint': 473.176,
    'pints': 473.176,
    'pt': 473.176,
    'quart': 946.353,
    'quarts': 946.353,
    'qt': 946.353,
    'gallon': 3785.41,
    'gallons': 3785.41,
    'gal': 3785.41
  };

  if (weightConversions[u]) {
    grams = amount * weightConversions[u];
  } else if (volumeConversions[u]) {
    ml = amount * volumeConversions[u];
  }

  return {
    amount,
    unit,
    grams: Math.round(grams * 100) / 100,
    ml: Math.round(ml * 100) / 100
  };
};

/**
 * Calculate how much of a product is needed for a recipe
 * @param {Object} recipeNeeds - What recipe needs {quantity, unit, ingredient}
 * @param {Object} product - Product data {quantity}
 * @returns {Object} Analysis {needsAmount, productSize, coverage, enoughFor}
 */
export const calculateProductCoverage = (recipeNeeds, product) => {
  try {
    // Parse recipe needs
    const recipeAmount = recipeNeeds.quantity || 0;
    const recipeUnit = recipeNeeds.unit || '';
    const ingredientName = recipeNeeds.ingredient?.toLowerCase() || '';

    // Parse product size
    const productQuantity = parseProductQuantity(product.quantity);

    // Convert both to standard units
    const recipeStd = convertToStandardUnits(recipeAmount, recipeUnit);
    const productStd = convertToStandardUnits(productQuantity.amount, productQuantity.unit);

    // Determine if we can compare (same measurement type)
    let recipeInStd = 0;
    let productInStd = 0;
    let standardUnit = '';

    if (recipeStd.grams > 0 && productStd.grams > 0) {
      // Both weight
      recipeInStd = recipeStd.grams;
      productInStd = productStd.grams;
      standardUnit = 'g';
    } else if (recipeStd.ml > 0 && productStd.ml > 0) {
      // Both volume
      recipeInStd = recipeStd.ml;
      productInStd = productStd.ml;
      standardUnit = 'ml';
    } else if (recipeStd.ml > 0 && productStd.grams > 0) {
      // Recipe volume, product weight - try density conversion
      const density = INGREDIENT_DENSITIES[ingredientName];
      if (density) {
        // Convert recipe volume to grams
        recipeInStd = (recipeStd.ml / 236.588) * density; // cups to grams
        productInStd = productStd.grams;
        standardUnit = 'g';
      }
    } else if (recipeStd.grams > 0 && productStd.ml > 0) {
      // Recipe weight, product volume - try density conversion
      const density = INGREDIENT_DENSITIES[ingredientName];
      if (density) {
        // Convert product volume to grams
        productInStd = (productStd.ml / 236.588) * density;
        recipeInStd = recipeStd.grams;
        standardUnit = 'g';
      }
    }

    if (recipeInStd === 0 || productInStd === 0) {
      // Can't compare
      return {
        comparable: false,
        needsDisplay: `${recipeAmount} ${recipeUnit}`,
        productSizeDisplay: product.quantity,
        message: 'Unable to compare quantities'
      };
    }

    // Calculate coverage
    const uses = Math.floor(productInStd / recipeInStd);
    const percentCoverage = (recipeInStd / productInStd) * 100;

    return {
      comparable: true,
      needsAmount: recipeInStd,
      productSize: productInStd,
      standardUnit,
      needsDisplay: `${Math.round(recipeInStd * 100) / 100} ${standardUnit}`,
      productSizeDisplay: `${Math.round(productInStd * 100) / 100} ${standardUnit}`,
      coverage: Math.round(percentCoverage),
      enoughFor: uses,
      message: uses >= 1
        ? `Enough for ${uses} ${uses === 1 ? 'use' : 'uses'} of this recipe`
        : 'Not enough for one full recipe'
    };

  } catch (error) {
    console.error('Error calculating product coverage:', error);
    return {
      comparable: false,
      message: 'Error calculating coverage'
    };
  }
};

/**
 * Format product price
 * @param {number} price - Price in dollars
 * @returns {string} Formatted price
 */
export const formatPrice = (price) => {
  if (!price || isNaN(price)) return '';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(price);
};

/**
 * Calculate unit price (price per standard unit)
 * @param {number} price - Total price
 * @param {string} quantity - Product quantity string
 * @returns {Object} Unit price info {pricePerUnit, unit, display}
 */
export const calculateUnitPrice = (price, quantity) => {
  if (!price || !quantity) {
    return { pricePerUnit: 0, unit: '', display: '' };
  }

  const parsed = parseProductQuantity(quantity);
  const converted = convertToStandardUnits(parsed.amount, parsed.unit);

  let pricePerUnit = 0;
  let unit = '';

  // Use grams for weight products
  if (converted.grams > 0) {
    // Price per 100g (standard)
    pricePerUnit = (price / converted.grams) * 100;
    unit = '100g';
  }
  // Use ml for volume products
  else if (converted.ml > 0) {
    // Price per 100ml
    pricePerUnit = (price / converted.ml) * 100;
    unit = '100ml';
  }
  // For count items, price per piece
  else if (parsed.unit.includes('count') || parsed.unit.includes('pack')) {
    pricePerUnit = price / parsed.amount;
    unit = 'each';
  }

  return {
    pricePerUnit: Math.round(pricePerUnit * 100) / 100,
    unit,
    display: `${formatPrice(pricePerUnit)}/${unit}`
  };
};

/**
 * Compare products by value (best price per unit)
 * @param {Array} products - Array of products with price data
 * @returns {Array} Sorted products (best value first)
 */
export const compareProductValue = (products) => {
  if (!Array.isArray(products)) return [];

  return products
    .map(product => {
      const unitPrice = calculateUnitPrice(product.price, product.quantity);
      return {
        ...product,
        unitPrice: unitPrice.pricePerUnit,
        unitPriceDisplay: unitPrice.display
      };
    })
    .filter(p => p.unitPrice > 0)
    .sort((a, b) => a.unitPrice - b.unitPrice);
};

/**
 * Estimate price if not available
 * Uses average prices from category
 * @param {Object} product - Product data
 * @param {Object} categoryAvgPrices - Average prices by category
 * @returns {number} Estimated price
 */
export const estimateProductPrice = (product, categoryAvgPrices = {}) => {
  // Check if product has categories
  if (!product.categories || product.categories.length === 0) {
    return 0;
  }

  // Find average price for product's category
  for (const category of product.categories) {
    const catLower = category.toLowerCase();
    if (categoryAvgPrices[catLower]) {
      return categoryAvgPrices[catLower];
    }
  }

  // Default estimates by common categories
  const defaultEstimates = {
    'beverages': 3.99,
    'dairy': 4.99,
    'meat': 7.99,
    'produce': 2.99,
    'snacks': 3.49,
    'pantry': 4.49,
    'frozen': 5.99
  };

  for (const category of product.categories) {
    const catLower = category.toLowerCase();
    for (const [key, price] of Object.entries(defaultEstimates)) {
      if (catLower.includes(key)) {
        return price;
      }
    }
  }

  return 0;
};

/**
 * Format product display name
 * @param {Object} product - Product data
 * @returns {string} Formatted name
 */
export const formatProductName = (product) => {
  if (!product) return '';

  let name = product.productName || 'Unknown Product';

  // Limit length
  if (name.length > 50) {
    name = name.substring(0, 47) + '...';
  }

  return name;
};

/**
 * Get product display info
 * @param {Object} product - Product data
 * @returns {Object} Display info {name, brand, size, price, image}
 */
export const getProductDisplayInfo = (product) => {
  if (!product) return null;

  return {
    name: formatProductName(product),
    brand: product.brand || product.brands?.[0] || '',
    size: product.quantity || '',
    price: product.price ? formatPrice(product.price) : '',
    image: product.imageSmallUrl || product.imageThumbnailUrl || product.imageUrl || '',
    barcode: product.barcode || '',
    nutritionGrade: product.nutritionGrade || '',
    isOrganic: product.isOrganic || false,
    isVegan: product.isVegan || false
  };
};

/**
 * Validate product data completeness
 * @param {Object} product - Product data
 * @returns {Object} Validation result {valid, missing, score}
 */
export const validateProductData = (product) => {
  if (!product) {
    return { valid: false, missing: ['all data'], score: 0 };
  }

  const requiredFields = [
    'barcode',
    'productName',
    'brands'
  ];

  const optionalFields = [
    'quantity',
    'imageUrl',
    'categories',
    'nutriments',
    'nutritionGrade'
  ];

  const missing = [];
  let score = 0;

  // Check required fields
  requiredFields.forEach(field => {
    if (!product[field] || (Array.isArray(product[field]) && product[field].length === 0)) {
      missing.push(field);
    } else {
      score += 20; // 20 points per required field
    }
  });

  // Check optional fields
  optionalFields.forEach(field => {
    if (product[field] && (!Array.isArray(product[field]) || product[field].length > 0)) {
      score += 8; // 8 points per optional field
    }
  });

  return {
    valid: missing.length === 0,
    missing,
    score: Math.min(score, 100),
    completeness: product.completeness || score
  };
};

export default {
  parseProductQuantity,
  convertToStandardUnits,
  calculateProductCoverage,
  formatPrice,
  calculateUnitPrice,
  compareProductValue,
  estimateProductPrice,
  formatProductName,
  getProductDisplayInfo,
  validateProductData
};
