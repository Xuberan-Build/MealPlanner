/**
 * Product Matching Service
 *
 * Intelligent matching of recipe ingredients to real products. Candidates come from
 * our Firestore product catalog (see productCatalogService); scoring uses:
 * - Fuzzy string matching
 * - Category-based filtering
 * - User preference learning
 * - Purchase history analysis
 * - Brand preferences
 * - Dietary restrictions
 *
 * This is the "brain" that makes smart product suggestions
 */

import { getCatalogEntries, toCatalogKey } from './productCatalogService';
import { categorizeIngredient } from '../utils/ingredientCategories';
import { singularize } from '../utils/quantity';

/**
 * String similarity using Levenshtein distance (simplified)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
/** Lowercase, punctuation-free, singular words ("Large Eggs," -> ["large", "egg"]). */
const toWords = (str) => str
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .filter(Boolean)
  .map(singularize);

const stringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;

  const w1 = toWords(str1);
  const w2 = toWords(str2);
  const s1 = w1.join(' ');
  const s2 = w2.join(' ');
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;

  // One contains the other as whole words ("egg" in "large egg"), not as a substring
  // ("egg" must not match "eggplant").
  const padded1 = ` ${s1} `;
  const padded2 = ` ${s2} `;
  if (padded1.includes(` ${s2} `) || padded2.includes(` ${s1} `)) {
    return 0.8;
  }

  // Word overlap
  const words1 = new Set(w1);
  const words2 = new Set(w2);
  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) commonWords++;
  }
  return commonWords / Math.max(words1.size, words2.size);
};

/**
 * Normalize ingredient name for better matching
 * @param {string} ingredientName - Raw ingredient name
 * @returns {string} Normalized name
 */
/** Drop descriptor words before comparing names (local to scoring; not the shared grouping key). */
const stripDescriptors = (ingredientName) => {
  if (!ingredientName) return '';

  return ingredientName
    .toLowerCase()
    .trim()
    // Remove common descriptors (more comprehensive list)
    .replace(/\b(fresh|freshly|organic|raw|unsalted|salted|chopped|diced|sliced|minced|finely|coarsely|roughly|cracked|ground|grated|shredded|whole|dried|canned|frozen|thawed)\b/g, '')
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Calculate match score between ingredient and product
 * @param {Object} ingredient - Ingredient data
 * @param {Object} product - Product data
 * @param {Object} userPreferences - User preferences
 * @returns {number} Match score (0-1)
 */
const calculateMatchScore = (ingredient, product, userPreferences = {}) => {
  let score = 0;
  const weights = {
    nameMatch: 0.35,
    categoryMatch: 0.15,
    brandPreference: 0.20,
    purchaseHistory: 0.15,
    dietaryMatch: 0.10,
    nutritionGrade: 0.05
  };

  // 1. Name similarity (35%)
  const ingredientName = stripDescriptors(ingredient.name);
  const productName = stripDescriptors(product.productName);
  const nameSimilarity = stringSimilarity(ingredientName, productName);

  // Also check brand name
  const brandSimilarity = product.brands.reduce((max, brand) => {
    return Math.max(max, stringSimilarity(ingredientName, brand));
  }, 0);

  score += Math.max(nameSimilarity, brandSimilarity * 0.7) * weights.nameMatch;

  // 2. Category match (15%)
  if (ingredient.category && product.categories) {
    const ingredientCategory = ingredient.category.toLowerCase();
    const hasMatchingCategory = product.categories.some(cat =>
      cat.toLowerCase().includes(ingredientCategory) ||
      ingredientCategory.includes(cat.toLowerCase())
    );
    if (hasMatchingCategory) {
      score += weights.categoryMatch;
    }
  }

  // 3. Brand preference (20%)
  if (userPreferences.preferredBrands) {
    const isPreferredBrand = product.brands.some(brand =>
      userPreferences.preferredBrands.some(pref =>
        brand.toLowerCase().includes(pref.toLowerCase())
      )
    );
    if (isPreferredBrand) {
      score += weights.brandPreference;
    }
  }

  // 4. Purchase history (15%)
  if (userPreferences.purchaseHistory) {
    const wasPurchased = userPreferences.purchaseHistory.includes(product.barcode);
    if (wasPurchased) {
      score += weights.purchaseHistory;
    }
  }

  // 5. Dietary restrictions match (10%)
  if (userPreferences.dietaryRestrictions) {
    let dietaryMatches = 0;
    let dietaryRequirements = 0;

    const dietaryChecks = [
      { pref: 'organic', productFlag: 'isOrganic' },
      { pref: 'vegan', productFlag: 'isVegan' },
      { pref: 'vegetarian', productFlag: 'isVegetarian' },
      { pref: 'glutenFree', productFlag: 'isGlutenFree' },
      { pref: 'kosher', productFlag: 'isKosher' },
      { pref: 'halal', productFlag: 'isHalal' }
    ];

    dietaryChecks.forEach(({ pref, productFlag }) => {
      if (userPreferences.dietaryRestrictions[pref]) {
        dietaryRequirements++;
        if (product[productFlag]) {
          dietaryMatches++;
        }
      }
    });

    if (dietaryRequirements > 0) {
      score += (dietaryMatches / dietaryRequirements) * weights.dietaryMatch;
    } else {
      // No requirements, full points
      score += weights.dietaryMatch;
    }
  }

  // 6. Nutrition grade bonus (5%)
  if (product.nutritionGrade) {
    const gradeScore = {
      'a': 1.0,
      'b': 0.8,
      'c': 0.6,
      'd': 0.4,
      'e': 0.2
    };
    score += (gradeScore[product.nutritionGrade.toLowerCase()] || 0.5) * weights.nutritionGrade;
  }

  return Math.min(score, 1); // Cap at 1.0
};

/**
 * Determine match reason/tag
 * @param {Object} ingredient - Ingredient data
 * @param {Object} product - Product data
 * @param {Object} userPreferences - User preferences
 * @param {number} score - Match score
 * @returns {string} Human-readable reason
 */
const getMatchReason = (ingredient, product, userPreferences, score) => {
  // Check for exact or very high matches
  if (score >= 0.9) return 'Perfect match';
  if (score >= 0.75) return 'Great match';

  // Check purchase history
  if (userPreferences.purchaseHistory?.includes(product.barcode)) {
    return 'You buy this';
  }

  // Check brand preference
  const isPreferredBrand = product.brands.some(brand =>
    userPreferences.preferredBrands?.some(pref =>
      brand.toLowerCase().includes(pref.toLowerCase())
    )
  );
  if (isPreferredBrand) {
    return 'Your preferred brand';
  }

  // Check organic/special labels
  if (product.isOrganic && userPreferences.dietaryRestrictions?.organic) {
    return 'Organic option';
  }

  if (product.isVegan && userPreferences.dietaryRestrictions?.vegan) {
    return 'Vegan option';
  }

  // Check nutrition grade
  if (product.nutritionGrade === 'a') {
    return 'Top nutrition grade';
  }

  // Default reasons
  if (score >= 0.6) return 'Good match';
  if (score >= 0.4) return 'Possible match';

  return 'Alternative option';
};

/**
 * Score and rank candidate products for one ingredient (pure, no I/O).
 * @param {Object} ingredient - Ingredient data {name, quantity, unit, category}
 * @param {Array} products - Candidate products (openFoodFactsService product shape)
 * @param {Object} [options] - { userPreferences, maxResults = 10, minScore = 0.3 }
 * @returns {Array<{product: Object, score: number, reason: string,
 *   confidence: 'high'|'medium'|'low'}>} Best first
 */
export const rankProductsForIngredient = (ingredient, products, options = {}) => {
  const { userPreferences = {}, maxResults = 10, minScore = 0.3 } = options;
  if (!ingredient?.name || !Array.isArray(products) || products.length === 0) return [];

  const enrichedIngredient = {
    ...ingredient,
    category: ingredient.category || categorizeIngredient(ingredient.name).category.name
  };

  return products
    .filter(Boolean)
    .map(product => {
      const score = calculateMatchScore(enrichedIngredient, product, userPreferences);
      return {
        product,
        score,
        reason: getMatchReason(enrichedIngredient, product, userPreferences, score),
        confidence: score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low'
      };
    })
    .filter(item => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);
};

/**
 * Match ingredient to products from the Firestore product catalog.
 * @param {Object} ingredient - Ingredient data {name, quantity, unit, category}
 * @param {Object} options - { userPreferences, maxResults = 10, minScore = 0.3,
 *   useCache = true (in-memory catalog cache) }
 * @returns {Promise<Array>} Ranked array of { product, score, reason, confidence }
 * @throws {Error} When ingredient.name is missing
 */
export const matchIngredientToProducts = async (ingredient, options = {}) => {
  if (!ingredient || !ingredient.name) {
    throw new Error('Ingredient name is required');
  }
  const { useCache = true } = options;
  const entries = await getCatalogEntries([ingredient.name], { useMemoryCache: useCache });
  const entry = entries.get(toCatalogKey(ingredient.name));
  return rankProductsForIngredient(ingredient, entry?.products || [], options);
};

const itemIdOf = (item, index) => item.id ?? item.name ?? String(index);

/**
 * Match a whole shopping list with ONE catalog request, then score each item locally.
 * @param {Array<{id?: string, name: string, category?: string}>} items - List items
 * @param {Object} [options] - Same as matchIngredientToProducts
 * @returns {Promise<Map<string, Array>>} itemId (item.id, else item.name) -> ranked matches
 */
export const matchItemsBatch = async (items, options = {}) => {
  const results = new Map();
  if (!Array.isArray(items) || items.length === 0) return results;

  const valid = items.filter(item => item && item.name);
  const { useCache = true } = options;
  const entries = valid.length
    ? await getCatalogEntries(valid.map(item => item.name), { useMemoryCache: useCache })
    : new Map();

  items.forEach((item, index) => {
    if (!item) return;
    const products = item.name ? entries.get(toCatalogKey(item.name))?.products || [] : [];
    results.set(itemIdOf(item, index), rankProductsForIngredient(item, products, options));
  });
  return results;
};

/**
 * Batch match multiple ingredients to products (delegates to matchItemsBatch).
 * @param {Array} ingredients - Array of ingredients
 * @param {Object} options - Matching options
 * @returns {Promise<Object>} Map of ingredient name to products
 */
export const batchMatchIngredients = async (ingredients, options = {}) => {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return {};
  const named = ingredients.filter(ing => ing && ing.name);
  const byName = await matchItemsBatch(
    named.map(ing => ({ ...ing, id: ing.name })),
    options
  );
  return Object.fromEntries(byName);
};

/**
 * Find substitute products for an ingredient
 * @param {Object} ingredient - Ingredient data
 * @param {Object} currentProduct - Current/original product
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of substitute products
 */
export const findSubstituteProducts = async (ingredient, currentProduct, options = {}) => {
  try {
    const {
      maxResults = 5,
      requireSameCategory = true
    } = options;

    // Get all matches
    const allMatches = await matchIngredientToProducts(ingredient, {
      ...options,
      maxResults: 20,
      minScore: 0.2 // Lower threshold for substitutes
    });

    // Filter out the current product
    let substitutes = allMatches.filter(
      match => match.product.barcode !== currentProduct.barcode
    );

    // If required, only show products in same category
    if (requireSameCategory && currentProduct.categories) {
      const currentCategories = new Set(
        currentProduct.categories.map(c => c.toLowerCase())
      );

      substitutes = substitutes.filter(match =>
        match.product.categories.some(cat =>
          currentCategories.has(cat.toLowerCase())
        )
      );
    }

    // Limit results
    substitutes = substitutes.slice(0, maxResults);

    // Add substitute-specific reasons
    substitutes.forEach(match => {
      if (match.product.isOrganic && !currentProduct.isOrganic) {
        match.reason = 'Organic alternative';
      } else if (match.score > 0.8) {
        match.reason = 'Similar product';
      } else {
        match.reason = 'Alternative option';
      }
    });

    return substitutes;

  } catch (error) {
    console.error('Error finding substitute products:', error);
    throw error;
  }
};

/**
 * Suggest products based on shopping list context
 * Analyzes all items in list to suggest complementary products
 * @param {Array} shoppingListItems - Current shopping list items
 * @param {Object} options - Options
 * @returns {Promise<Array>} Suggested products
 */
export const suggestComplementaryProducts = async (shoppingListItems, options = {}) => {
  // Placeholder for future enhancement (common product bundles, recipes, etc.)
  // TODO: Implement complementary product suggestions
  return [];
};

/**
 * Re-rank products based on user interaction
 * Updates scoring based on what user actually selected
 * @param {string} ingredientName - Ingredient name
 * @param {string} selectedBarcode - Barcode of product user selected
 * @param {Array} allOptions - All products that were shown
 * @returns {Promise<void>}
 */
export const learnFromUserSelection = async (ingredientName, selectedBarcode, allOptions) => {
  // No-op for now.
  // TODO: Implement machine learning feedback loop
  // - Store selection in user preferences
  // - Adjust scoring weights
  // - Build personalized ranking model
};

const productMatchingService = {
  matchIngredientToProducts,
  matchItemsBatch,
  batchMatchIngredients,
  rankProductsForIngredient,
  findSubstituteProducts,
  suggestComplementaryProducts,
  learnFromUserSelection
};

export default productMatchingService;
