/**
 * OpenFoodFacts API Service
 *
 * Provides a clean interface to the OpenFoodFacts API with:
 * - Product search by name
 * - Product lookup by barcode
 * - Autocomplete suggestions
 * - Error handling and retry logic
 * - Rate limiting protection
 */

// OpenFoodFacts API Configuration
const OFF_API_BASE = 'https://world.openfoodfacts.org';
const OFF_API_VERSION = 'v0';
const DEFAULT_PAGE_SIZE = 20;
const REQUEST_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Makes a fetch request with timeout
 * @param {string} url - URL to fetch
 * @param {Object} options - Fetch options
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = async (url, options = {}, timeout = REQUEST_TIMEOUT) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'MealPlanner/1.0',
        'Accept': 'application/json',
        ...options.headers
      }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} retries - Number of retries
 * @returns {Promise<any>}
 */
const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    const delay = RETRY_DELAY * (MAX_RETRIES - retries + 1);
    console.log(`Retrying in ${delay}ms... (${retries} retries left)`);

    await new Promise(resolve => setTimeout(resolve, delay));
    return retryWithBackoff(fn, retries - 1);
  }
};

/**
 * Normalize product data from OpenFoodFacts API
 * @param {Object} rawProduct - Raw product data from API
 * @returns {Object} Normalized product object
 */
const normalizeProduct = (rawProduct) => {
  if (!rawProduct) return null;

  return {
    // Core identifiers
    barcode: rawProduct.code || rawProduct._id || '',
    productName: rawProduct.product_name || rawProduct.product_name_en || 'Unknown Product',

    // Brand information
    brands: rawProduct.brands ? rawProduct.brands.split(',').map(b => b.trim()) : [],
    brand: rawProduct.brands ? rawProduct.brands.split(',')[0].trim() : '',

    // Quantity
    quantity: rawProduct.quantity || '',
    packagingSize: rawProduct.product_quantity || '',

    // Categories
    categories: rawProduct.categories ? rawProduct.categories.split(',').map(c => c.trim()) : [],
    categoriesTags: rawProduct.categories_tags || [],

    // Images
    imageUrl: rawProduct.image_url || rawProduct.image_front_url || '',
    imageFrontUrl: rawProduct.image_front_url || '',
    imageSmallUrl: rawProduct.image_small_url || rawProduct.image_front_small_url || '',
    imageThumbnailUrl: rawProduct.image_thumb_url || rawProduct.image_front_thumb_url || '',

    // Nutritional information
    nutriments: {
      energyKcal: rawProduct.nutriments?.['energy-kcal'] || 0,
      energy: rawProduct.nutriments?.energy || 0,
      proteins: rawProduct.nutriments?.proteins || 0,
      proteinsUnit: rawProduct.nutriments?.proteins_unit || 'g',
      carbohydrates: rawProduct.nutriments?.carbohydrates || 0,
      carbohydratesUnit: rawProduct.nutriments?.carbohydrates_unit || 'g',
      sugars: rawProduct.nutriments?.sugars || 0,
      fat: rawProduct.nutriments?.fat || 0,
      fatUnit: rawProduct.nutriments?.fat_unit || 'g',
      saturatedFat: rawProduct.nutriments?.['saturated-fat'] || 0,
      fiber: rawProduct.nutriments?.fiber || 0,
      sodium: rawProduct.nutriments?.sodium || 0,
      salt: rawProduct.nutriments?.salt || 0
    },

    // Nutrition grades
    nutritionGrade: rawProduct.nutrition_grades || rawProduct.nutrition_grade_fr || '',
    novaGroup: rawProduct.nova_group || rawProduct.nova_groups || '',

    // Labels and certifications
    labels: rawProduct.labels ? rawProduct.labels.split(',').map(l => l.trim()) : [],
    labelsTags: rawProduct.labels_tags || [],

    // Dietary flags (extracted from labels)
    isOrganic: (rawProduct.labels_tags || []).some(tag => tag.includes('organic')),
    isVegan: (rawProduct.labels_tags || []).some(tag => tag.includes('vegan')),
    isVegetarian: (rawProduct.labels_tags || []).some(tag => tag.includes('vegetarian')),
    isGlutenFree: (rawProduct.labels_tags || []).some(tag => tag.includes('gluten-free')),
    isDairyFree: (rawProduct.labels_tags || []).some(tag => tag.includes('dairy-free')),
    isKosher: (rawProduct.labels_tags || []).some(tag => tag.includes('kosher')),
    isHalal: (rawProduct.labels_tags || []).some(tag => tag.includes('halal')),

    // Ingredients
    ingredients: rawProduct.ingredients || [],
    ingredientsText: rawProduct.ingredients_text || '',
    allergens: rawProduct.allergens || '',
    allergensTags: rawProduct.allergens_tags || [],

    // Metadata
    lastModified: rawProduct.last_modified_t ? new Date(rawProduct.last_modified_t * 1000) : null,
    completeness: rawProduct.completeness || 0,

    // Store/availability (will be enhanced by our service)
    stores: rawProduct.stores ? rawProduct.stores.split(',').map(s => s.trim()) : [],
    countries: rawProduct.countries ? rawProduct.countries.split(',').map(c => c.trim()) : [],

    // Raw data for reference
    _raw: rawProduct
  };
};

/**
 * Search for products by name/keyword
 * @param {string} searchTerm - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of normalized products
 */
export const searchProducts = async (searchTerm, options = {}) => {
  try {
    if (!searchTerm || searchTerm.trim().length === 0) {
      throw new Error('Search term is required');
    }

    const {
      pageSize = DEFAULT_PAGE_SIZE,
      page = 1,
      sortBy = 'unique_scans_n', // Sort by popularity
      countries = 'United States',
      fields = [
        'code',
        'product_name',
        'brands',
        'quantity',
        'image_url',
        'image_front_url',
        'image_small_url',
        'image_thumb_url',
        'categories',
        'categories_tags',
        'labels',
        'labels_tags',
        'nutriments',
        'nutrition_grades',
        'nova_group',
        'ingredients',
        'allergens',
        'allergens_tags',
        'stores',
        'countries',
        'last_modified_t',
        'completeness'
      ]
    } = options;

    const params = new URLSearchParams({
      search_terms: searchTerm.trim(),
      page_size: pageSize,
      page: page,
      sort_by: sortBy,
      json: '1',
      fields: fields.join(',')
    });

    if (countries) {
      params.append('countries', countries);
    }

    const url = `${OFF_API_BASE}/cgi/search.pl?${params}`;
    console.log('OpenFoodFacts search:', searchTerm);

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`OpenFoodFacts API error: ${res.status} ${res.statusText}`);
      }
      return res;
    });

    const data = await response.json();

    if (!data.products || !Array.isArray(data.products)) {
      console.warn('No products found in response');
      return [];
    }

    const normalizedProducts = data.products
      .map(normalizeProduct)
      .filter(p => p !== null);

    console.log(`Found ${normalizedProducts.length} products for "${searchTerm}"`);
    return normalizedProducts;

  } catch (error) {
    console.error('Error searching OpenFoodFacts:', error);

    // Don't throw on network errors, return empty array
    if (error.name === 'AbortError') {
      console.warn('OpenFoodFacts request timeout');
      return [];
    }

    throw error;
  }
};

/**
 * Get product details by barcode
 * @param {string} barcode - Product barcode/UPC
 * @returns {Promise<Object|null>} Normalized product object or null
 */
export const getProductByBarcode = async (barcode) => {
  try {
    if (!barcode || barcode.trim().length === 0) {
      throw new Error('Barcode is required');
    }

    const url = `${OFF_API_BASE}/api/${OFF_API_VERSION}/product/${barcode.trim()}.json`;
    console.log('OpenFoodFacts barcode lookup:', barcode);

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`OpenFoodFacts API error: ${res.status} ${res.statusText}`);
      }
      return res;
    });

    const data = await response.json();

    if (data.status !== 1 || !data.product) {
      console.warn(`Product not found for barcode: ${barcode}`);
      return null;
    }

    const normalized = normalizeProduct(data.product);
    console.log(`Found product: ${normalized.productName}`);
    return normalized;

  } catch (error) {
    console.error('Error fetching product by barcode:', error);

    if (error.name === 'AbortError') {
      console.warn('OpenFoodFacts request timeout');
      return null;
    }

    throw error;
  }
};

/**
 * Get autocomplete suggestions for a search term
 * @param {string} term - Partial search term
 * @param {number} limit - Maximum number of suggestions
 * @returns {Promise<Array>} Array of suggestion strings
 */
export const getAutocompleteSuggestions = async (term, limit = 10) => {
  try {
    if (!term || term.trim().length < 2) {
      return [];
    }

    const params = new URLSearchParams({
      tagtype: 'products',
      term: term.trim(),
      limit: limit
    });

    const url = `${OFF_API_BASE}/cgi/suggest.pl?${params}`;

    const response = await fetchWithTimeout(url);

    if (!response.ok) {
      console.warn('Autocomplete request failed');
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];

  } catch (error) {
    console.error('Error fetching autocomplete suggestions:', error);
    return [];
  }
};

/**
 * Search products by category
 * @param {string} category - Category name or tag
 * @param {Object} options - Search options
 * @returns {Promise<Array>} Array of normalized products
 */
export const searchByCategory = async (category, options = {}) => {
  try {
    if (!category || category.trim().length === 0) {
      throw new Error('Category is required');
    }

    const {
      pageSize = DEFAULT_PAGE_SIZE,
      page = 1,
      sortBy = 'unique_scans_n'
    } = options;

    const params = new URLSearchParams({
      tagtype_0: 'categories',
      tag_contains_0: 'contains',
      tag_0: category.trim(),
      page_size: pageSize,
      page: page,
      sort_by: sortBy,
      json: '1'
    });

    const url = `${OFF_API_BASE}/cgi/search.pl?${params}`;
    console.log('OpenFoodFacts category search:', category);

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`OpenFoodFacts API error: ${res.status} ${res.statusText}`);
      }
      return res;
    });

    const data = await response.json();

    if (!data.products || !Array.isArray(data.products)) {
      return [];
    }

    const normalizedProducts = data.products
      .map(normalizeProduct)
      .filter(p => p !== null);

    console.log(`Found ${normalizedProducts.length} products in category "${category}"`);
    return normalizedProducts;

  } catch (error) {
    console.error('Error searching by category:', error);

    if (error.name === 'AbortError') {
      return [];
    }

    throw error;
  }
};

/**
 * Search products with filters
 * @param {Object} filters - Filter criteria
 * @returns {Promise<Array>} Array of normalized products
 */
export const searchWithFilters = async (filters = {}) => {
  try {
    const {
      searchTerm = '',
      brands = [],
      categories = [],
      labels = [],
      nutritionGrade = '',
      pageSize = DEFAULT_PAGE_SIZE,
      page = 1
    } = filters;

    const params = new URLSearchParams({
      page_size: pageSize,
      page: page,
      json: '1',
      sort_by: 'unique_scans_n'
    });

    if (searchTerm) {
      params.append('search_terms', searchTerm.trim());
    }

    // Add brand filters
    brands.forEach((brand, index) => {
      params.append(`tagtype_${index}`, 'brands');
      params.append(`tag_contains_${index}`, 'contains');
      params.append(`tag_${index}`, brand);
    });

    // Add category filters
    const brandCount = brands.length;
    categories.forEach((category, index) => {
      const tagIndex = brandCount + index;
      params.append(`tagtype_${tagIndex}`, 'categories');
      params.append(`tag_contains_${tagIndex}`, 'contains');
      params.append(`tag_${tagIndex}`, category);
    });

    // Add label filters (organic, vegan, etc.)
    const prevCount = brandCount + categories.length;
    labels.forEach((label, index) => {
      const tagIndex = prevCount + index;
      params.append(`tagtype_${tagIndex}`, 'labels');
      params.append(`tag_contains_${tagIndex}`, 'contains');
      params.append(`tag_${tagIndex}`, label);
    });

    // Add nutrition grade filter
    if (nutritionGrade) {
      const tagIndex = prevCount + labels.length;
      params.append(`tagtype_${tagIndex}`, 'nutrition_grades');
      params.append(`tag_contains_${tagIndex}`, 'contains');
      params.append(`tag_${tagIndex}`, nutritionGrade.toLowerCase());
    }

    const url = `${OFF_API_BASE}/cgi/search.pl?${params}`;
    console.log('OpenFoodFacts filtered search');

    const response = await retryWithBackoff(async () => {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        throw new Error(`OpenFoodFacts API error: ${res.status} ${res.statusText}`);
      }
      return res;
    });

    const data = await response.json();

    if (!data.products || !Array.isArray(data.products)) {
      return [];
    }

    const normalizedProducts = data.products
      .map(normalizeProduct)
      .filter(p => p !== null);

    console.log(`Found ${normalizedProducts.length} filtered products`);
    return normalizedProducts;

  } catch (error) {
    console.error('Error searching with filters:', error);

    if (error.name === 'AbortError') {
      return [];
    }

    throw error;
  }
};

/**
 * Batch lookup products by barcodes
 * @param {Array<string>} barcodes - Array of barcodes
 * @returns {Promise<Array>} Array of normalized products
 */
export const batchLookupBarcodes = async (barcodes) => {
  try {
    if (!Array.isArray(barcodes) || barcodes.length === 0) {
      return [];
    }

    // Fetch products in parallel with a concurrency limit
    const BATCH_SIZE = 5; // Limit concurrent requests
    const results = [];

    for (let i = 0; i < barcodes.length; i += BATCH_SIZE) {
      const batch = barcodes.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(barcode => getProductByBarcode(barcode).catch(err => {
          console.error(`Failed to fetch barcode ${barcode}:`, err);
          return null;
        }))
      );
      results.push(...batchResults.filter(p => p !== null));
    }

    console.log(`Batch lookup: ${results.length}/${barcodes.length} products found`);
    return results;

  } catch (error) {
    console.error('Error in batch barcode lookup:', error);
    throw error;
  }
};

/**
 * Health check for OpenFoodFacts API
 * @returns {Promise<boolean>} True if API is accessible
 */
export const healthCheck = async () => {
  try {
    const response = await fetchWithTimeout(`${OFF_API_BASE}/api/${OFF_API_VERSION}/product/737628064502.json`, {}, 5000);
    return response.ok;
  } catch (error) {
    console.error('OpenFoodFacts health check failed:', error);
    return false;
  }
};

export default {
  searchProducts,
  getProductByBarcode,
  getAutocompleteSuggestions,
  searchByCategory,
  searchWithFilters,
  batchLookupBarcodes,
  healthCheck
};
