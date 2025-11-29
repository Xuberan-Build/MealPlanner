/**
 * Product Cache Service
 *
 * Provides intelligent caching for OpenFoodFacts product searches to:
 * - Reduce API calls and improve performance
 * - Minimize latency for repeated searches
 * - Respect API rate limits
 * - Store frequently accessed products
 *
 * Uses Firestore for persistent caching and in-memory cache for hot data
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  deleteDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

const CACHE_COLLECTION = 'productCache';
const USER_CACHE_COLLECTION = 'userProductCache';

// Cache TTL configurations
const CACHE_TTL = {
  SEARCH_RESULTS: 7 * 24 * 60 * 60 * 1000,      // 7 days for search results
  PRODUCT_DETAILS: 30 * 24 * 60 * 60 * 1000,    // 30 days for specific products
  AUTOCOMPLETE: 24 * 60 * 60 * 1000,            // 1 day for autocomplete
  USER_PRODUCTS: 90 * 24 * 60 * 60 * 1000       // 90 days for user's products
};

// In-memory cache for hot data (session-based)
const memoryCache = new Map();
const MAX_MEMORY_CACHE_SIZE = 100; // Maximum items in memory cache

/**
 * Generate a cache key from search parameters
 * @param {string} type - Cache type (search, barcode, autocomplete)
 * @param {string|Object} params - Search parameters
 * @returns {string} Cache key
 */
const generateCacheKey = (type, params) => {
  if (typeof params === 'string') {
    return `${type}:${params.toLowerCase().trim()}`;
  }

  // For object parameters, create a sorted key
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&');

  return `${type}:${sortedParams}`;
};

/**
 * Check if cached data is still valid
 * @param {number} cachedAt - Timestamp when data was cached
 * @param {number} ttl - Time to live in milliseconds
 * @returns {boolean} True if cache is valid
 */
const isCacheValid = (cachedAt, ttl) => {
  if (!cachedAt) return false;
  const now = Date.now();
  const age = now - cachedAt;
  return age < ttl;
};

/**
 * Get item from memory cache
 * @param {string} key - Cache key
 * @returns {any|null} Cached data or null
 */
const getFromMemory = (key) => {
  const cached = memoryCache.get(key);
  if (!cached) return null;

  if (!isCacheValid(cached.timestamp, cached.ttl)) {
    memoryCache.delete(key);
    return null;
  }

  // Update access time for LRU
  cached.lastAccess = Date.now();
  return cached.data;
};

/**
 * Set item in memory cache with LRU eviction
 * @param {string} key - Cache key
 * @param {any} data - Data to cache
 * @param {number} ttl - Time to live
 */
const setInMemory = (key, data, ttl) => {
  // Implement LRU eviction if cache is full
  if (memoryCache.size >= MAX_MEMORY_CACHE_SIZE) {
    // Find least recently used item
    let lruKey = null;
    let oldestAccess = Infinity;

    for (const [k, v] of memoryCache.entries()) {
      if (v.lastAccess < oldestAccess) {
        oldestAccess = v.lastAccess;
        lruKey = k;
      }
    }

    if (lruKey) {
      memoryCache.delete(lruKey);
    }
  }

  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
    lastAccess: Date.now(),
    ttl
  });
};

/**
 * Cache search results
 * @param {string} searchTerm - Search query
 * @param {Array} products - Product results
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<void>}
 */
export const cacheSearchResults = async (searchTerm, products, metadata = {}) => {
  try {
    const cacheKey = generateCacheKey('search', searchTerm);

    const cacheData = {
      searchTerm: searchTerm.toLowerCase().trim(),
      products,
      hitCount: 1,
      cachedAt: Date.now(),
      serverCachedAt: serverTimestamp(),
      ttl: CACHE_TTL.SEARCH_RESULTS,
      metadata: {
        productCount: products.length,
        ...metadata
      }
    };

    // Store in memory cache
    setInMemory(cacheKey, cacheData, CACHE_TTL.SEARCH_RESULTS);

    // Store in Firestore (global cache)
    const docRef = doc(db, CACHE_COLLECTION, cacheKey);
    await setDoc(docRef, cacheData, { merge: true });

    console.log(`Cached search results for "${searchTerm}": ${products.length} products`);

  } catch (error) {
    // Don't fail if caching fails
    console.error('Error caching search results:', error);
  }
};

/**
 * Get cached search results
 * @param {string} searchTerm - Search query
 * @returns {Promise<Array|null>} Cached products or null
 */
export const getCachedSearchResults = async (searchTerm) => {
  try {
    const cacheKey = generateCacheKey('search', searchTerm);

    // Check memory cache first
    const memoryData = getFromMemory(cacheKey);
    if (memoryData) {
      console.log(`Memory cache hit for "${searchTerm}"`);
      return memoryData.products;
    }

    // Check Firestore cache
    const docRef = doc(db, CACHE_COLLECTION, cacheKey);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.log(`Cache miss for "${searchTerm}"`);
      return null;
    }

    const data = docSnap.data();

    // Validate cache age
    if (!isCacheValid(data.cachedAt, CACHE_TTL.SEARCH_RESULTS)) {
      console.log(`Cache expired for "${searchTerm}"`);
      // Clean up expired cache
      await deleteDoc(docRef);
      return null;
    }

    // Update hit count
    await setDoc(docRef, {
      hitCount: (data.hitCount || 0) + 1,
      lastAccess: serverTimestamp()
    }, { merge: true });

    // Store in memory for next time
    setInMemory(cacheKey, data, CACHE_TTL.SEARCH_RESULTS);

    console.log(`Firestore cache hit for "${searchTerm}": ${data.products.length} products`);
    return data.products;

  } catch (error) {
    console.error('Error retrieving cached search results:', error);
    return null;
  }
};

/**
 * Cache product details by barcode
 * @param {string} barcode - Product barcode
 * @param {Object} product - Product data
 * @returns {Promise<void>}
 */
export const cacheProductByBarcode = async (barcode, product) => {
  try {
    const cacheKey = generateCacheKey('barcode', barcode);

    const cacheData = {
      barcode: barcode.trim(),
      product,
      cachedAt: Date.now(),
      serverCachedAt: serverTimestamp(),
      ttl: CACHE_TTL.PRODUCT_DETAILS
    };

    // Store in memory
    setInMemory(cacheKey, cacheData, CACHE_TTL.PRODUCT_DETAILS);

    // Store in Firestore
    const docRef = doc(db, CACHE_COLLECTION, cacheKey);
    await setDoc(docRef, cacheData);

    console.log(`Cached product: ${product.productName} (${barcode})`);

  } catch (error) {
    console.error('Error caching product:', error);
  }
};

/**
 * Get cached product by barcode
 * @param {string} barcode - Product barcode
 * @returns {Promise<Object|null>} Cached product or null
 */
export const getCachedProductByBarcode = async (barcode) => {
  try {
    const cacheKey = generateCacheKey('barcode', barcode);

    // Check memory cache
    const memoryData = getFromMemory(cacheKey);
    if (memoryData) {
      return memoryData.product;
    }

    // Check Firestore
    const docRef = doc(db, CACHE_COLLECTION, cacheKey);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();

    // Validate cache age
    if (!isCacheValid(data.cachedAt, CACHE_TTL.PRODUCT_DETAILS)) {
      await deleteDoc(docRef);
      return null;
    }

    // Store in memory
    setInMemory(cacheKey, data, CACHE_TTL.PRODUCT_DETAILS);

    return data.product;

  } catch (error) {
    console.error('Error retrieving cached product:', error);
    return null;
  }
};

/**
 * Cache user-specific product data (purchase history, favorites)
 * @param {string} userId - User ID
 * @param {string} barcode - Product barcode
 * @param {Object} userData - User-specific data
 * @returns {Promise<void>}
 */
export const cacheUserProduct = async (userId, barcode, userData) => {
  try {
    const docRef = doc(db, USER_CACHE_COLLECTION, `${userId}_${barcode}`);

    const data = {
      userId,
      barcode,
      ...userData,
      lastUpdated: serverTimestamp(),
      cachedAt: Date.now()
    };

    await setDoc(docRef, data, { merge: true });

  } catch (error) {
    console.error('Error caching user product data:', error);
  }
};

/**
 * Get user-specific product data
 * @param {string} userId - User ID
 * @param {string} barcode - Product barcode
 * @returns {Promise<Object|null>} User product data or null
 */
export const getUserProductCache = async (userId, barcode) => {
  try {
    const docRef = doc(db, USER_CACHE_COLLECTION, `${userId}_${barcode}`);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    return docSnap.data();

  } catch (error) {
    console.error('Error retrieving user product cache:', error);
    return null;
  }
};

/**
 * Get all cached products for a user
 * @param {string} userId - User ID
 * @param {number} limitCount - Maximum number of products to return
 * @returns {Promise<Array>} Array of user products
 */
export const getUserCachedProducts = async (userId, limitCount = 50) => {
  try {
    const q = query(
      collection(db, USER_CACHE_COLLECTION),
      where('userId', '==', userId),
      orderBy('lastUpdated', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const products = [];

    snapshot.forEach(doc => {
      products.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return products;

  } catch (error) {
    console.error('Error retrieving user cached products:', error);
    return [];
  }
};

/**
 * Clear expired cache entries
 * @returns {Promise<number>} Number of entries cleared
 */
export const clearExpiredCache = async () => {
  try {
    const now = Date.now();
    let deletedCount = 0;

    // Query all cache documents
    const snapshot = await getDocs(collection(db, CACHE_COLLECTION));

    const deletePromises = [];

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const ttl = data.ttl || CACHE_TTL.SEARCH_RESULTS;

      if (!isCacheValid(data.cachedAt, ttl)) {
        deletePromises.push(deleteDoc(docSnap.ref));
        deletedCount++;
      }
    });

    await Promise.all(deletePromises);

    console.log(`Cleared ${deletedCount} expired cache entries`);
    return deletedCount;

  } catch (error) {
    console.error('Error clearing expired cache:', error);
    return 0;
  }
};

/**
 * Clear all cache (for testing or manual refresh)
 * @returns {Promise<void>}
 */
export const clearAllCache = async () => {
  try {
    // Clear memory cache
    memoryCache.clear();

    // Clear Firestore cache
    const snapshot = await getDocs(collection(db, CACHE_COLLECTION));
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log('All cache cleared');

  } catch (error) {
    console.error('Error clearing all cache:', error);
    throw error;
  }
};

/**
 * Get cache statistics
 * @returns {Promise<Object>} Cache statistics
 */
export const getCacheStats = async () => {
  try {
    const snapshot = await getDocs(collection(db, CACHE_COLLECTION));

    let totalEntries = 0;
    let totalHits = 0;
    let expiredEntries = 0;
    const cacheTypes = {};

    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      totalEntries++;

      // Count hits
      totalHits += data.hitCount || 0;

      // Check if expired
      const ttl = data.ttl || CACHE_TTL.SEARCH_RESULTS;
      if (!isCacheValid(data.cachedAt, ttl)) {
        expiredEntries++;
      }

      // Count by type
      const type = docSnap.id.split(':')[0];
      cacheTypes[type] = (cacheTypes[type] || 0) + 1;
    });

    return {
      totalEntries,
      totalHits,
      expiredEntries,
      memoryCacheSize: memoryCache.size,
      cacheTypes,
      avgHitsPerEntry: totalEntries > 0 ? (totalHits / totalEntries).toFixed(2) : 0
    };

  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
};

export default {
  cacheSearchResults,
  getCachedSearchResults,
  cacheProductByBarcode,
  getCachedProductByBarcode,
  cacheUserProduct,
  getUserProductCache,
  getUserCachedProducts,
  clearExpiredCache,
  clearAllCache,
  getCacheStats
};
