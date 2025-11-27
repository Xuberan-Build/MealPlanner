// src/services/recipeSharingService.js

import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit as limitQuery,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { getCurrentUserId } from './authHelper';

/**
 * Make a recipe public and shareable
 *
 * @param {string} recipeId - The recipe ID to share
 * @param {Object} options - Sharing options
 * @returns {Promise<Object>} - Share data including link
 */
export async function shareRecipe(recipeId, options = {}) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User must be logged in to share recipes');

    // Get the recipe
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeDoc = await getDoc(recipeRef);

    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }

    const recipeData = recipeDoc.data();

    // Verify ownership
    if (recipeData.userId !== userId) {
      throw new Error('You can only share your own recipes');
    }

    // Get user info
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    // Create or update public recipe
    const publicRecipeRef = doc(db, 'publicRecipes', recipeId);
    const publicRecipeData = {
      recipeData: {
        ...recipeData,
        id: recipeId
      },
      authorId: userId,
      authorName: userData.name || 'Anonymous Chef',
      authorImage: userData.profileImage || null,

      visibility: options.visibility || 'public', // public, unlisted, private
      sharedAt: serverTimestamp(),

      engagement: {
        views: 0,
        saves: 0,
        madeThis: 0,
        ratings: {
          average: 0,
          count: 0,
          total: 0
        }
      },

      tags: options.tags || [],
      difficulty: recipeData.difficulty || 'medium',
      prepTime: recipeData.prepTime || null,
      cookTime: recipeData.cookTime || null,

      trending: false,
      featuredAt: null,

      reported: false,
      moderationStatus: 'approved'
    };

    await setDoc(publicRecipeRef, publicRecipeData, { merge: true });

    // Create shareable link
    const shareLink = await createShareLink({
      type: 'recipe',
      resourceId: recipeId,
      sharedBy: userId,
      metadata: {
        recipeTitle: recipeData.title,
        authorName: userData.name
      }
    });

    // Update original recipe with shared flag
    await updateDoc(recipeRef, {
      isPublic: true,
      sharedAt: serverTimestamp(),
      shareLink: shareLink.url
    });

    console.log('✅ Recipe shared successfully:', recipeId);

    return {
      success: true,
      recipeId,
      shareLink: shareLink.url,
      linkId: shareLink.linkId
    };
  } catch (error) {
    console.error('Error sharing recipe:', error);
    throw error;
  }
}

/**
 * Make a recipe private (unshare)
 *
 * @param {string} recipeId - The recipe ID to unshare
 * @returns {Promise<void>}
 */
export async function unshareRecipe(recipeId) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User must be logged in');

    // Verify ownership
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeDoc = await getDoc(recipeRef);

    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }

    if (recipeDoc.data().userId !== userId) {
      throw new Error('You can only unshare your own recipes');
    }

    // Update public recipe to private visibility
    const publicRecipeRef = doc(db, 'publicRecipes', recipeId);
    await updateDoc(publicRecipeRef, {
      visibility: 'private',
      unsharedAt: serverTimestamp()
    });

    // Update original recipe
    await updateDoc(recipeRef, {
      isPublic: false,
      unsharedAt: serverTimestamp()
    });

    console.log('✅ Recipe unshared:', recipeId);
  } catch (error) {
    console.error('Error unsharing recipe:', error);
    throw error;
  }
}

/**
 * Create a shareable link for any resource
 *
 * @param {Object} linkData - Link configuration
 * @returns {Promise<Object>} - Link data with URL
 */
export async function createShareLink(linkData) {
  try {
    const { type, resourceId, sharedBy, metadata = {} } = linkData;

    // Generate short link ID
    const linkId = generateLinkId();

    const shareLinkData = {
      linkId,
      type, // recipe, profile, meal-plan
      resourceId,
      sharedBy,

      createdAt: serverTimestamp(),
      expiresAt: null,

      analytics: {
        views: 0,
        uniqueVisitors: 0,
        signups: 0,
        conversions: 0
      },

      metadata
    };

    const linkRef = doc(db, 'sharedLinks', linkId);
    await setDoc(linkRef, shareLinkData);

    // Create shareable URL
    const baseUrl = window.location.origin;
    const shareUrl = `${baseUrl}/shared/${linkId}`;

    console.log('✅ Share link created:', shareUrl);

    return {
      linkId,
      url: shareUrl,
      shortUrl: shareUrl
    };
  } catch (error) {
    console.error('Error creating share link:', error);
    throw error;
  }
}

/**
 * Track when a shared link is viewed
 *
 * @param {string} linkId - The share link ID
 * @param {Object} context - Visitor context
 * @returns {Promise<Object>} - The shared resource data
 */
export async function trackShareLinkView(linkId, context = {}) {
  try {
    const linkRef = doc(db, 'sharedLinks', linkId);
    const linkDoc = await getDoc(linkRef);

    if (!linkDoc.exists()) {
      throw new Error('Share link not found');
    }

    const linkData = linkDoc.data();

    // Increment view count
    await updateDoc(linkRef, {
      'analytics.views': increment(1),
      lastViewedAt: serverTimestamp()
    });

    // Get the shared resource
    let resourceData = null;

    if (linkData.type === 'recipe') {
      const publicRecipeRef = doc(db, 'publicRecipes', linkData.resourceId);
      const publicRecipeDoc = await getDoc(publicRecipeRef);

      if (publicRecipeDoc.exists()) {
        resourceData = publicRecipeDoc.data();

        // Increment recipe view count
        await updateDoc(publicRecipeRef, {
          'engagement.views': increment(1)
        });
      }
    }

    console.log('✅ Tracked share link view:', linkId);

    return {
      linkData,
      resourceData,
      type: linkData.type
    };
  } catch (error) {
    console.error('Error tracking share link view:', error);
    throw error;
  }
}

/**
 * Save/copy a public recipe to user's recipe book
 *
 * @param {string} publicRecipeId - The public recipe ID
 * @returns {Promise<string>} - The new recipe ID in user's collection
 */
export async function savePublicRecipe(publicRecipeId) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User must be logged in to save recipes');

    // Get the public recipe
    const publicRecipeRef = doc(db, 'publicRecipes', publicRecipeId);
    const publicRecipeDoc = await getDoc(publicRecipeRef);

    if (!publicRecipeDoc.exists()) {
      throw new Error('Public recipe not found');
    }

    const publicRecipeData = publicRecipeDoc.data();

    // Don't let users save their own recipes
    if (publicRecipeData.authorId === userId) {
      throw new Error('You already own this recipe');
    }

    // Copy recipe to user's collection
    const newRecipeRef = doc(collection(db, 'recipes'));
    const newRecipeData = {
      ...publicRecipeData.recipeData,
      userId,
      originalAuthorId: publicRecipeData.authorId,
      originalAuthorName: publicRecipeData.authorName,
      copiedFrom: publicRecipeId,
      copiedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    await setDoc(newRecipeRef, newRecipeData);

    // Track the save in public recipe
    await updateDoc(publicRecipeRef, {
      'engagement.saves': increment(1)
    });

    // Create interaction record
    const interactionRef = doc(db, 'recipeInteractions', `${userId}_${publicRecipeId}`);
    await setDoc(interactionRef, {
      userId,
      recipeId: publicRecipeId,
      authorId: publicRecipeData.authorId,
      saved: true,
      savedAt: serverTimestamp()
    }, { merge: true });

    console.log('✅ Saved public recipe to user collection');

    return newRecipeRef.id;
  } catch (error) {
    console.error('Error saving public recipe:', error);
    throw error;
  }
}

/**
 * Mark that user made a recipe
 *
 * @param {string} publicRecipeId - The public recipe ID
 * @returns {Promise<void>}
 */
export async function markRecipeAsMade(publicRecipeId) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User must be logged in');

    const publicRecipeRef = doc(db, 'publicRecipes', publicRecipeId);
    await updateDoc(publicRecipeRef, {
      'engagement.madeThis': increment(1)
    });

    // Update interaction record
    const interactionRef = doc(db, 'recipeInteractions', `${userId}_${publicRecipeId}`);
    await setDoc(interactionRef, {
      userId,
      recipeId: publicRecipeId,
      madeThis: true,
      madeAt: serverTimestamp()
    }, { merge: true });

    console.log('✅ Marked recipe as made');
  } catch (error) {
    console.error('Error marking recipe as made:', error);
    throw error;
  }
}

/**
 * Get user's shared recipes
 *
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Array>}
 */
export async function getUserSharedRecipes(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const q = query(
      collection(db, 'publicRecipes'),
      where('authorId', '==', uid),
      where('visibility', '==', 'public'),
      orderBy('sharedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const recipes = [];

    snapshot.forEach((doc) => {
      recipes.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return recipes;
  } catch (error) {
    console.error('Error getting user shared recipes:', error);
    return [];
  }
}

/**
 * Browse public recipes (discovery)
 *
 * @param {Object} filters - Filter options
 * @returns {Promise<Array>}
 */
export async function browsePublicRecipes(filters = {}) {
  try {
    let q = query(
      collection(db, 'publicRecipes'),
      where('visibility', '==', 'public'),
      where('moderationStatus', '==', 'approved')
    );

    // Add filters
    if (filters.cuisine) {
      q = query(q, where('tags', 'array-contains', filters.cuisine));
    }

    if (filters.difficulty) {
      q = query(q, where('difficulty', '==', filters.difficulty));
    }

    // Order and limit
    const orderField = filters.orderBy || 'sharedAt';
    q = query(q, orderBy(orderField, 'desc'));

    if (filters.limit) {
      q = query(q, limitQuery(filters.limit));
    }

    const snapshot = await getDocs(q);
    const recipes = [];

    snapshot.forEach((doc) => {
      recipes.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return recipes;
  } catch (error) {
    console.error('Error browsing public recipes:', error);
    return [];
  }
}

/**
 * Generate a short link ID
 *
 * @returns {string}
 */
function generateLinkId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Copy recipe link to clipboard
 *
 * @param {string} shareUrl - The share URL
 * @returns {Promise<boolean>}
 */
export async function copyLinkToClipboard(shareUrl) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    }
  } catch (error) {
    console.error('Error copying to clipboard:', error);
    return false;
  }
}
