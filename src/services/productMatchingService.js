/**
 * Product Matching Service
 *
 * Intelligent matching of recipe ingredients to real products using:
 * - Fuzzy string matching
 * - Category-based filtering
 * - User preference learning
 * - Purchase history analysis
 * - Brand preferences
 * - Dietary restrictions
 *
 * This is the "brain" that makes smart product suggestions
 */

import { searchProducts } from './openFoodFactsService';
import { getCachedSearchResults, cacheSearchResults } from './productCacheService';
import { categorizeIngredient } from '../utils/ingredientCategories';

/**
 * String similarity using Levenshtein distance (simplified)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1)
 */
const stringSimilarity = (str1, str2) => {
  if (!str1 || !str2) return 0;

  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 1;

  // Check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8;
  }

  // Simple word overlap scoring
  const words1 = new Set(s1.split(/\s+/));
  const words2 = new Set(s2.split(/\s+/));

  let commonWords = 0;
  for (const word of words1) {
    if (words2.has(word)) commonWords++;
  }

  const totalWords = Math.max(words1.size, words2.size);
  return totalWords > 0 ? (commonWords / totalWords) : 0;
};

/**
 * Normalize ingredient name for better matching
 * @param {string} ingredientName - Raw ingredient name
 * @returns {string} Normalized name
 */
const normalizeIngredientName = (ingredientName) => {
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
 * Extract key search terms from ingredient name
 * @param {string} ingredientName - Ingredient name
 * @returns {string} Optimized search term
 */
const extractSearchTerm = (ingredientName) => {
  if (!ingredientName) return '';

  // First, split by comma to get base ingredient (before the comma)
  // e.g., "garlic, minced" -> "garlic"
  // e.g., "onion, finely diced" -> "onion"
  const parts = ingredientName.split(',');
  const baseIngredient = parts[0].trim();

  // Replace all dashes with spaces FIRST (before normalization)
  // This fixes: "chicken-broth" -> "chicken broth", "minced-ginger" -> "minced ginger"
  const withSpaces = baseIngredient.replace(/-/g, ' ');

  // Normalize the base ingredient (removes descriptors like "minced", "chopped", etc.)
  const normalized = normalizeIngredientName(withSpaces);

  // Remove any remaining trailing commas or punctuation
  const cleaned = normalized.replace(/[,;.]+$/g, '').trim();

  // Split into words and filter out very short words (prepositions, articles)
  const words = cleaned.split(/\s+/).filter(w => w.length > 2);

  // Limit to most relevant words (first 3-4) for better API results
  // e.g., "freshly cracked black pepper" -> "black pepper"
  const limitedWords = words.slice(0, 3).join(' ');

  return limitedWords || cleaned || withSpaces || baseIngredient;
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
  const ingredientName = normalizeIngredientName(ingredient.name);
  const productName = normalizeIngredientName(product.productName);
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
 * Match ingredient to products
 * @param {Object} ingredient - Ingredient data {name, quantity, unit, category}
 * @param {Object} options - Matching options
 * @returns {Promise<Array>} Ranked array of matching products
 */
export const matchIngredientToProducts = async (ingredient, options = {}) => {
  try {
    const {
      userPreferences = {},
      maxResults = 10,
      minScore = 0.3,
      useCache = true
    } = options;

    if (!ingredient || !ingredient.name) {
      throw new Error('Ingredient name is required');
    }

    // Extract search term
    const searchTerm = extractSearchTerm(ingredient.name);
    console.log(`Matching ingredient "${ingredient.name}" -> search: "${searchTerm}"`);

    // Try cache first
    let products = [];
    if (useCache) {
      products = await getCachedSearchResults(searchTerm);
    }

    // If not in cache, search OpenFoodFacts
    if (!products || products.length === 0) {
      products = await searchProducts(searchTerm, {
        pageSize: 30, // Get more for better scoring
        countries: 'United States'
      });

      // Cache the results
      if (products && products.length > 0) {
        await cacheSearchResults(searchTerm, products);
      }
    }

    if (!products || products.length === 0) {
      console.log(`No products found for "${ingredient.name}"`);
      return [];
    }

    // Enrich ingredient data
    const enrichedIngredient = {
      ...ingredient,
      category: ingredient.category || categorizeIngredient(ingredient.name).category.name
    };

    // Score and rank products
    const scoredProducts = products.map(product => {
      const score = calculateMatchScore(enrichedIngredient, product, userPreferences);
      const reason = getMatchReason(enrichedIngredient, product, userPreferences, score);

      return {
        product,
        score,
        reason,
        confidence: score >= 0.7 ? 'high' : score >= 0.5 ? 'medium' : 'low'
      };
    });

    // Filter by minimum score and sort by score descending
    const rankedProducts = scoredProducts
      .filter(item => item.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    console.log(`Found ${rankedProducts.length} matching products (scored >= ${minScore})`);

    return rankedProducts;

  } catch (error) {
    console.error('Error matching ingredient to products:', error);
    throw error;
  }
};

/**
 * Batch match multiple ingredients to products
 * @param {Array} ingredients - Array of ingredients
 * @param {Object} options - Matching options
 * @returns {Promise<Object>} Map of ingredient name to products
 */
export const batchMatchIngredients = async (ingredients, options = {}) => {
  try {
    if (!Array.isArray(ingredients) || ingredients.length === 0) {
      return {};
    }

    console.log(`Batch matching ${ingredients.length} ingredients`);

    const results = {};

    // Process in parallel with concurrency limit
    const BATCH_SIZE = 5;
    for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
      const batch = ingredients.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (ingredient) => {
          try {
            const matches = await matchIngredientToProducts(ingredient, options);
            return { name: ingredient.name, matches };
          } catch (error) {
            console.error(`Failed to match ${ingredient.name}:`, error);
            return { name: ingredient.name, matches: [] };
          }
        })
      );

      batchResults.forEach(({ name, matches }) => {
        results[name] = matches;
      });
    }

    return results;

  } catch (error) {
    console.error('Error in batch ingredient matching:', error);
    throw error;
  }
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
      userPreferences = {},
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

    console.log(`Found ${substitutes.length} substitutes for ${currentProduct.productName}`);
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
  try {
    // Placeholder for future enhancement
    // Could analyze common product bundles, recipes, etc.

    // For now, return empty array
    // TODO: Implement complementary product suggestions
    return [];

  } catch (error) {
    console.error('Error suggesting complementary products:', error);
    return [];
  }
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
  try {
    // This would feed into a learning algorithm
    // For now, just log the selection

    console.log(`User selected ${selectedBarcode} for "${ingredientName}"`);

    // TODO: Implement machine learning feedback loop
    // - Store selection in user preferences
    // - Adjust scoring weights
    // - Build personalized ranking model

  } catch (error) {
    console.error('Error learning from user selection:', error);
  }
};

export default {
  matchIngredientToProducts,
  batchMatchIngredients,
  findSubstituteProducts,
  suggestComplementaryProducts,
  learnFromUserSelection
};
