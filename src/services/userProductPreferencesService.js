/**
 * User Product Preferences Service
 *
 * Manages user-specific product data:
 * - Brand preferences
 * - Store preferences
 * - Dietary restrictions
 * - Purchase history
 * - Favorite products
 * - Shopping habits
 *
 * This service learns from user behavior to improve recommendations
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';
import { db, auth } from '../firebase';

const USER_PREFERENCES_COLLECTION = 'userProductPreferences';

/**
 * Get default user preferences structure
 * @returns {Object} Default preferences
 */
const getDefaultPreferences = () => ({
  // Brand preferences
  preferredBrands: [],
  avoidBrands: [],

  // Store preferences
  preferredStores: [],
  primaryStore: null,

  // Dietary restrictions
  dietaryRestrictions: {
    organic: false,
    nonGMO: false,
    glutenFree: false,
    vegan: false,
    vegetarian: false,
    kosher: false,
    halal: false,
    dairyFree: false,
    nutFree: false
  },

  // Shopping habits
  shoppingHabits: {
    buyInBulk: false,
    priceConscious: true,
    qualityConscious: false,
    brandLoyal: false,
    prefersOrganic: false
  },

  // Purchase history (limited to last 500)
  purchaseHistory: [],

  // Favorite products (barcodes)
  favoriteProducts: [],

  // Product ratings (barcode -> rating)
  productRatings: {},

  // Metadata
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp()
});

/**
 * Get user preferences
 * @param {string} userId - User ID (optional, uses current user if not provided)
 * @returns {Promise<Object>} User preferences
 */
export const getUserPreferences = async (userId = null) => {
  try {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User must be authenticated');
    }

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      };
    }

    // Create default preferences if not exist
    const defaultPrefs = getDefaultPreferences();
    await setDoc(docRef, defaultPrefs);

    return {
      id: uid,
      ...defaultPrefs
    };

  } catch (error) {
    console.error('Error getting user preferences:', error);
    throw error;
  }
};

/**
 * Update user preferences
 * @param {Object} updates - Preference updates
 * @param {string} userId - User ID (optional)
 * @returns {Promise<void>}
 */
export const updateUserPreferences = async (updates, userId = null) => {
  try {
    const uid = userId || auth.currentUser?.uid;
    if (!uid) {
      throw new Error('User must be authenticated');
    }

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('User preferences updated');

  } catch (error) {
    console.error('Error updating user preferences:', error);
    throw error;
  }
};

/**
 * Add a preferred brand
 * @param {string} brand - Brand name
 * @param {string} category - Product category (optional)
 * @returns {Promise<void>}
 */
export const addPreferredBrand = async (brand, category = null) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      preferredBrands: arrayUnion(brand.trim()),
      updatedAt: serverTimestamp()
    });

    console.log(`Added preferred brand: ${brand}`);

  } catch (error) {
    console.error('Error adding preferred brand:', error);
    throw error;
  }
};

/**
 * Remove a preferred brand
 * @param {string} brand - Brand name
 * @returns {Promise<void>}
 */
export const removePreferredBrand = async (brand) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      preferredBrands: arrayRemove(brand.trim()),
      updatedAt: serverTimestamp()
    });

    console.log(`Removed preferred brand: ${brand}`);

  } catch (error) {
    console.error('Error removing preferred brand:', error);
    throw error;
  }
};

/**
 * Add a store preference
 * @param {Object} store - Store data {name, location, priority}
 * @returns {Promise<void>}
 */
export const addPreferredStore = async (store) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);
    const preferences = await getUserPreferences(uid);

    // Check if store already exists
    const existingStores = preferences.preferredStores || [];
    const storeExists = existingStores.some(s => s.name === store.name);

    if (!storeExists) {
      await updateDoc(docRef, {
        preferredStores: arrayUnion({
          name: store.name,
          location: store.location || null,
          priority: store.priority || existingStores.length + 1,
          addedAt: new Date().toISOString()
        }),
        updatedAt: serverTimestamp()
      });

      console.log(`Added preferred store: ${store.name}`);
    }

  } catch (error) {
    console.error('Error adding preferred store:', error);
    throw error;
  }
};

/**
 * Set primary store
 * @param {string} storeName - Store name
 * @returns {Promise<void>}
 */
export const setPrimaryStore = async (storeName) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      primaryStore: storeName,
      updatedAt: serverTimestamp()
    });

    console.log(`Set primary store: ${storeName}`);

  } catch (error) {
    console.error('Error setting primary store:', error);
    throw error;
  }
};

/**
 * Update dietary restrictions
 * @param {Object} restrictions - Dietary restrictions object
 * @returns {Promise<void>}
 */
export const updateDietaryRestrictions = async (restrictions) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      dietaryRestrictions: restrictions,
      updatedAt: serverTimestamp()
    });

    console.log('Dietary restrictions updated');

  } catch (error) {
    console.error('Error updating dietary restrictions:', error);
    throw error;
  }
};

/**
 * Record a product purchase
 * @param {Object} purchase - Purchase data {barcode, productName, price, store, quantity}
 * @returns {Promise<void>}
 */
export const recordPurchase = async (purchase) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);
    const preferences = await getUserPreferences(uid);

    const purchaseRecord = {
      barcode: purchase.barcode,
      productName: purchase.productName,
      price: purchase.price || null,
      store: purchase.store || null,
      quantity: purchase.quantity || 1,
      purchasedAt: new Date().toISOString(),
      timestamp: Date.now()
    };

    // Add to purchase history (keep last 500)
    let purchaseHistory = preferences.purchaseHistory || [];
    purchaseHistory.unshift(purchaseRecord);

    // Limit to 500 most recent purchases
    if (purchaseHistory.length > 500) {
      purchaseHistory = purchaseHistory.slice(0, 500);
    }

    await updateDoc(docRef, {
      purchaseHistory,
      updatedAt: serverTimestamp()
    });

    console.log(`Recorded purchase: ${purchase.productName}`);

    // Auto-learn brand preferences
    if (purchase.brand) {
      await learnBrandPreference(purchase.brand);
    }

  } catch (error) {
    console.error('Error recording purchase:', error);
    throw error;
  }
};

/**
 * Get purchase history
 * @param {Object} filters - Filter options {limit, startDate, endDate, store}
 * @returns {Promise<Array>} Purchase history
 */
export const getPurchaseHistory = async (filters = {}) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const preferences = await getUserPreferences(uid);
    let history = preferences.purchaseHistory || [];

    // Apply filters
    if (filters.store) {
      history = history.filter(p => p.store === filters.store);
    }

    if (filters.startDate) {
      const startTime = new Date(filters.startDate).getTime();
      history = history.filter(p => p.timestamp >= startTime);
    }

    if (filters.endDate) {
      const endTime = new Date(filters.endDate).getTime();
      history = history.filter(p => p.timestamp <= endTime);
    }

    if (filters.limit) {
      history = history.slice(0, filters.limit);
    }

    return history;

  } catch (error) {
    console.error('Error getting purchase history:', error);
    throw error;
  }
};

/**
 * Get frequently purchased products
 * @param {number} limit - Maximum number of products to return
 * @returns {Promise<Array>} Frequently purchased products
 */
export const getFrequentlyPurchased = async (limit = 20) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const preferences = await getUserPreferences(uid);
    const history = preferences.purchaseHistory || [];

    // Count purchases by barcode
    const purchaseCounts = {};
    history.forEach(purchase => {
      const barcode = purchase.barcode;
      if (!purchaseCounts[barcode]) {
        purchaseCounts[barcode] = {
          barcode,
          productName: purchase.productName,
          count: 0,
          lastPurchased: purchase.timestamp,
          avgPrice: 0,
          totalSpent: 0
        };
      }

      purchaseCounts[barcode].count++;
      purchaseCounts[barcode].totalSpent += purchase.price || 0;

      if (purchase.timestamp > purchaseCounts[barcode].lastPurchased) {
        purchaseCounts[barcode].lastPurchased = purchase.timestamp;
      }
    });

    // Calculate average prices
    Object.values(purchaseCounts).forEach(item => {
      item.avgPrice = item.count > 0 ? item.totalSpent / item.count : 0;
    });

    // Sort by purchase count and recency
    const frequent = Object.values(purchaseCounts)
      .sort((a, b) => {
        // Primary sort: purchase count
        if (b.count !== a.count) {
          return b.count - a.count;
        }
        // Secondary sort: recency
        return b.lastPurchased - a.lastPurchased;
      })
      .slice(0, limit);

    return frequent;

  } catch (error) {
    console.error('Error getting frequently purchased:', error);
    throw error;
  }
};

/**
 * Add product to favorites
 * @param {string} barcode - Product barcode
 * @param {string} productName - Product name
 * @returns {Promise<void>}
 */
export const addFavoriteProduct = async (barcode, productName) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      favoriteProducts: arrayUnion(barcode),
      updatedAt: serverTimestamp()
    });

    console.log(`Added favorite: ${productName}`);

  } catch (error) {
    console.error('Error adding favorite product:', error);
    throw error;
  }
};

/**
 * Remove product from favorites
 * @param {string} barcode - Product barcode
 * @returns {Promise<void>}
 */
export const removeFavoriteProduct = async (barcode) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      favoriteProducts: arrayRemove(barcode),
      updatedAt: serverTimestamp()
    });

    console.log(`Removed favorite: ${barcode}`);

  } catch (error) {
    console.error('Error removing favorite product:', error);
    throw error;
  }
};

/**
 * Rate a product
 * @param {string} barcode - Product barcode
 * @param {number} rating - Rating (1-5)
 * @returns {Promise<void>}
 */
export const rateProduct = async (barcode, rating) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      [`productRatings.${barcode}`]: rating,
      updatedAt: serverTimestamp()
    });

    console.log(`Rated product ${barcode}: ${rating} stars`);

  } catch (error) {
    console.error('Error rating product:', error);
    throw error;
  }
};

/**
 * Learn brand preference from purchase history
 * Automatically adds frequently purchased brands to preferences
 * @param {string} brand - Brand name
 * @returns {Promise<void>}
 */
const learnBrandPreference = async (brand) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const preferences = await getUserPreferences(uid);
    const history = preferences.purchaseHistory || [];

    // Count purchases of this brand
    const brandPurchases = history.filter(p =>
      p.productName?.toLowerCase().includes(brand.toLowerCase())
    ).length;

    // If purchased 3+ times, add to preferred brands
    if (brandPurchases >= 3) {
      const preferredBrands = preferences.preferredBrands || [];
      if (!preferredBrands.includes(brand)) {
        await addPreferredBrand(brand);
        console.log(`Auto-learned brand preference: ${brand}`);
      }
    }

  } catch (error) {
    console.error('Error learning brand preference:', error);
  }
};

/**
 * Get shopping insights
 * Analyzes purchase history to provide insights
 * @returns {Promise<Object>} Shopping insights
 */
export const getShoppingInsights = async () => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const preferences = await getUserPreferences(uid);
    const history = preferences.purchaseHistory || [];

    const insights = {
      totalPurchases: history.length,
      totalSpent: 0,
      avgPurchasePrice: 0,
      topStores: {},
      topBrands: {},
      monthlySpending: {},
      categoryBreakdown: {}
    };

    history.forEach(purchase => {
      // Total spent
      insights.totalSpent += purchase.price || 0;

      // Store analysis
      if (purchase.store) {
        insights.topStores[purchase.store] = (insights.topStores[purchase.store] || 0) + 1;
      }

      // Monthly spending
      const month = new Date(purchase.timestamp).toISOString().substring(0, 7);
      insights.monthlySpending[month] = (insights.monthlySpending[month] || 0) + (purchase.price || 0);
    });

    // Calculate averages
    insights.avgPurchasePrice = insights.totalPurchases > 0
      ? insights.totalSpent / insights.totalPurchases
      : 0;

    // Sort top stores
    insights.topStores = Object.entries(insights.topStores)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .reduce((obj, [key, val]) => ({ ...obj, [key]: val }), {});

    return insights;

  } catch (error) {
    console.error('Error getting shopping insights:', error);
    throw error;
  }
};

/**
 * Update shopping habits
 * @param {Object} habits - Shopping habits object
 * @returns {Promise<void>}
 */
export const updateShoppingHabits = async (habits) => {
  try {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error('User must be authenticated');

    const docRef = doc(db, USER_PREFERENCES_COLLECTION, uid);

    await updateDoc(docRef, {
      shoppingHabits: habits,
      updatedAt: serverTimestamp()
    });

    console.log('Shopping habits updated');

  } catch (error) {
    console.error('Error updating shopping habits:', error);
    throw error;
  }
};

export default {
  getUserPreferences,
  updateUserPreferences,
  addPreferredBrand,
  removePreferredBrand,
  addPreferredStore,
  setPrimaryStore,
  updateDietaryRestrictions,
  recordPurchase,
  getPurchaseHistory,
  getFrequentlyPurchased,
  addFavoriteProduct,
  removeFavoriteProduct,
  rateProduct,
  getShoppingInsights,
  updateShoppingHabits
};
