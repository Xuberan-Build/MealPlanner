// src/services/userMetricsService.js

import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { getCurrentUserId } from './authHelper';

/**
 * Default metrics structure for new users
 */
const DEFAULT_METRICS = {
  // Recipe tracking
  totalRecipesAdded: 0,
  totalRecipesViewed: 0,
  favoriteRecipes: [],

  // Meal plan tracking
  totalMealPlansCreated: 0,
  totalMealPlansCompleted: 0,
  lastMealPlanDate: null,

  // Shopping list tracking
  totalShoppingListsGenerated: 0,
  lastShoppingListDate: null,

  // Feature usage tracking
  featureUsage: {
    recipeBook: 0,
    mealPlanner: 0,
    shoppingList: 0,
    profile: 0
  },

  // Engagement metrics
  lastActiveDate: null,
  accountCreatedDate: null,
  totalSessions: 0
};

/**
 * Initialize metrics for a new user
 * Called when a user first registers
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
export async function initializeUserMetrics(userId) {
  try {
    if (!userId) {
      console.warn('Cannot initialize metrics: No user ID provided');
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn('User document does not exist. Cannot initialize metrics.');
      return;
    }

    const userData = userDoc.data();

    // Only initialize if metrics don't already exist
    if (!userData.metrics) {
      const metrics = {
        ...DEFAULT_METRICS,
        accountCreatedDate: serverTimestamp(),
        lastActiveDate: serverTimestamp()
      };

      await updateDoc(userRef, { metrics });
      console.log('✅ Metrics initialized for user:', userId);
    } else {
      console.log('ℹ️ Metrics already exist for user:', userId);
    }
  } catch (error) {
    console.error('❌ Error initializing user metrics:', error);
    // Fail silently - don't break user experience
  }
}

/**
 * Ensure metrics object exists for a user (backward compatibility)
 * Creates default metrics if they don't exist
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<boolean>} - True if metrics exist or were created successfully
 */
async function ensureMetricsExist(userId) {
  try {
    if (!userId) return false;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return false;

    const userData = userDoc.data();

    if (!userData.metrics) {
      await initializeUserMetrics(userId);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring metrics exist:', error);
    return false;
  }
}

/**
 * Track when a recipe is added
 * Increments totalRecipesAdded counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<void>}
 */
export async function trackRecipeAdded(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalRecipesAdded': increment(1),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Recipe added for user', uid);
  } catch (error) {
    console.error('Error tracking recipe added:', error);
    // Fail silently
  }
}

/**
 * Track when a recipe is viewed
 * Increments totalRecipesViewed counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @param {string} recipeId - The ID of the recipe being viewed
 * @returns {Promise<void>}
 */
export async function trackRecipeViewed(userId = null, recipeId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalRecipesViewed': increment(1),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Recipe viewed for user', uid);
  } catch (error) {
    console.error('Error tracking recipe viewed:', error);
    // Fail silently
  }
}

/**
 * Track when a meal plan is created
 * Increments totalMealPlansCreated counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<void>}
 */
export async function trackMealPlanCreated(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalMealPlansCreated': increment(1),
      'metrics.lastMealPlanDate': serverTimestamp(),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Meal plan created for user', uid);
  } catch (error) {
    console.error('Error tracking meal plan created:', error);
    // Fail silently
  }
}

/**
 * Track when a meal plan is completed
 * Increments totalMealPlansCompleted counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<void>}
 */
export async function trackMealPlanCompleted(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalMealPlansCompleted': increment(1),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Meal plan completed for user', uid);
  } catch (error) {
    console.error('Error tracking meal plan completed:', error);
    // Fail silently
  }
}

/**
 * Track when a shopping list is generated
 * Increments totalShoppingListsGenerated counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<void>}
 */
export async function trackShoppingListGenerated(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalShoppingListsGenerated': increment(1),
      'metrics.lastShoppingListDate': serverTimestamp(),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Shopping list generated for user', uid);
  } catch (error) {
    console.error('Error tracking shopping list generated:', error);
    // Fail silently
  }
}

/**
 * Track feature usage (page navigation)
 * Increments the counter for a specific feature
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @param {string} featureName - Feature name: 'recipeBook' | 'mealPlanner' | 'shoppingList' | 'profile'
 * @returns {Promise<void>}
 */
export async function trackFeatureUsage(userId = null, featureName) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    const validFeatures = ['recipeBook', 'mealPlanner', 'shoppingList', 'profile'];
    if (!validFeatures.includes(featureName)) {
      console.warn('Invalid feature name:', featureName);
      return;
    }

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      [`metrics.featureUsage.${featureName}`]: increment(1),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log(`📊 Tracked: Feature usage - ${featureName} for user`, uid);
  } catch (error) {
    console.error('Error tracking feature usage:', error);
    // Fail silently
  }
}

/**
 * Track user session start
 * Increments totalSessions counter
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<void>}
 */
export async function trackSessionStart(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'metrics.totalSessions': increment(1),
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Tracked: Session start for user', uid);
  } catch (error) {
    console.error('Error tracking session start:', error);
    // Fail silently
  }
}

/**
 * Get user metrics
 * Returns the complete metrics object for a user
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<Object|null>} - The metrics object or null if not found
 */
export async function getUserMetrics(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    return userData.metrics || null;
  } catch (error) {
    console.error('Error getting user metrics:', error);
    return null;
  }
}

/**
 * Get most used features for a user
 * Returns sorted array of features by usage count
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @returns {Promise<Array>} - Sorted array of {feature, count} objects
 */
export async function getMostUsedFeatures(userId = null) {
  try {
    const metrics = await getUserMetrics(userId);
    if (!metrics || !metrics.featureUsage) return [];

    const features = Object.entries(metrics.featureUsage)
      .map(([feature, count]) => ({ feature, count }))
      .sort((a, b) => b.count - a.count);

    return features;
  } catch (error) {
    console.error('Error getting most used features:', error);
    return [];
  }
}

/**
 * Add recipe to favorites
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @param {string} recipeId - The ID of the recipe to favorite
 * @returns {Promise<void>}
 */
export async function addFavoriteRecipe(userId = null, recipeId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !recipeId) return;

    await ensureMetricsExist(uid);

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const favorites = userData.metrics?.favoriteRecipes || [];

    // Only add if not already in favorites
    if (!favorites.includes(recipeId)) {
      favorites.push(recipeId);
      await updateDoc(userRef, {
        'metrics.favoriteRecipes': favorites,
        'metrics.lastActiveDate': serverTimestamp()
      });
      console.log('📊 Added recipe to favorites:', recipeId);
    }
  } catch (error) {
    console.error('Error adding favorite recipe:', error);
    // Fail silently
  }
}

/**
 * Remove recipe from favorites
 *
 * @param {string} userId - The user's ID (optional, will use current user if not provided)
 * @param {string} recipeId - The ID of the recipe to unfavorite
 * @returns {Promise<void>}
 */
export async function removeFavoriteRecipe(userId = null, recipeId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !recipeId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const favorites = userData.metrics?.favoriteRecipes || [];
    const updatedFavorites = favorites.filter(id => id !== recipeId);

    await updateDoc(userRef, {
      'metrics.favoriteRecipes': updatedFavorites,
      'metrics.lastActiveDate': serverTimestamp()
    });

    console.log('📊 Removed recipe from favorites:', recipeId);
  } catch (error) {
    console.error('Error removing favorite recipe:', error);
    // Fail silently
  }
}
