// src/services/myCircleService.js

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
  runTransaction,
  serverTimestamp,
  limit as firestoreLimit
} from 'firebase/firestore';
import { getCurrentUserId } from './authHelper';
import {
  validateMemberData,
  validateReferralCode,
  sanitizeUserNameForCode,
  validateArraySize,
  checkRateLimit,
  validateRecipeId,
  validateMemberIds
} from './myCircleValidation';

/**
 * Generate a unique referral code for a user
 * @param {string} userName - User name to base code on
 * @returns {string} Generated referral code
 */
function generateReferralCode(userName) {
  const namePrefix = sanitizeUserNameForCode(userName);
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${namePrefix}${randomSuffix}`;
}

/**
 * Initialize My Circle for a user
 * @param {string} userId - User ID
 * @param {string} userName - User name
 * @param {string} referredBy - Optional referrer code
 */
export async function initializeMyCircle(userId, userName, referredBy = null) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Check if already initialized
    if (userData.myCircle?.code) {
      console.log('My Circle already initialized');
      return userData.myCircle;
    }

    // Generate unique referral code
    let referralCode = generateReferralCode(userName);
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const existingRef = await getDocs(
        query(
          collection(db, 'users'),
          where('myCircle.code', '==', referralCode),
          firestoreLimit(1)  // Add limit for security rules
        )
      );

      if (existingRef.empty) {
        isUnique = true;
      } else {
        referralCode = generateReferralCode(userName);
        attempts++;
      }
    }

    if (!isUnique) {
      referralCode = `USER${userId.substring(0, 8).toUpperCase()}`;
    }

    // Initialize My Circle data
    const myCircleData = {
      code: referralCode,
      referredBy: referredBy || null,
      referredAt: referredBy ? Date.now() : null,

      members: {
        family: [],
        clients: [],
        friends: []
      },

      stats: {
        totalMembers: 0,
        activeMealPlans: 0,
        sharedRecipes: 0,
        invitesSent: 0,
        successfulReferrals: 0
      },

      earnings: {
        thisMonth: 0,
        total: 0,
        pending: 0,
        byType: {
          referralBonuses: 0,
          activityRewards: 0,
          recipeSales: 0,
          templateSales: 0
        }
      },

      shared: {
        mealPlans: [],
        recipes: [],
        templates: []
      }
    };

    await updateDoc(userRef, {
      myCircle: myCircleData
    });

    // If referred by someone, process the referral
    if (referredBy) {
      await processReferralSignup(userId, referredBy);
    }

    console.log('My Circle initialized:', referralCode);
    return myCircleData;
  } catch (error) {
    console.error('Error initializing My Circle:', error);
    throw error;
  }
}

/**
 * Get My Circle data for current user
 */
export async function getMyCircleData() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return null;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    return userData.myCircle || null;
  } catch (error) {
    console.error('Error getting My Circle data:', error);
    return null;
  }
}

/**
 * Get My Circle link
 */
export async function getMyCircleLink() {
  try {
    const circleData = await getMyCircleData();
    if (!circleData?.code) return null;

    const baseUrl = window.location.origin;
    const url = `${baseUrl}/join?ref=${circleData.code}`;

    return {
      code: circleData.code,
      url
    };
  } catch (error) {
    console.error('Error getting My Circle link:', error);
    return null;
  }
}

/**
 * Add member to circle
 * @param {Object} memberData - Member information
 */
export async function addCircleMember(memberData) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // Rate limiting: max 10 members added per hour
    if (!checkRateLimit('addCircleMember', 10)) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Validate and sanitize input
    const validated = validateMemberData(memberData);
    const { email, name, relationship, permissions } = validated;

    const userRef = doc(db, 'users', userId);

    return await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const myCircle = userData.myCircle || {};

      // Create member object
      const member = {
        id: `member_${Date.now()}`,
        email,
        name,
        relationship,
        status: 'invited', // invited, active, inactive
        invitedAt: Date.now(),
        permissions: {
          viewMealPlans: permissions.viewMealPlans || false,
          shareRecipes: permissions.shareRecipes || true,
          collaboration: permissions.collaboration || false,
          trackProgress: permissions.trackProgress || false
        }
      };

      // Add to appropriate relationship array
      const relationshipKey = `myCircle.members.${relationship}`;
      const existingMembers = myCircle.members?.[relationship] || [];

      // Check array size limit (prevent document size issues)
      validateArraySize(existingMembers, 100, `${relationship} members`);

      // Check for duplicate email
      const isDuplicate = existingMembers.some(m => m.email.toLowerCase() === email.toLowerCase());
      if (isDuplicate) {
        throw new Error('This person is already in your circle');
      }

      // Check if user is adding themselves
      const currentUserEmail = userData.email?.toLowerCase();
      if (currentUserEmail && email.toLowerCase() === currentUserEmail) {
        throw new Error('You cannot add yourself to your circle');
      }

      transaction.update(userRef, {
        [relationshipKey]: [...existingMembers, member],
        'myCircle.stats.totalMembers': (myCircle.stats?.totalMembers || 0) + 1,
        'myCircle.stats.invitesSent': (myCircle.stats?.invitesSent || 0) + 1
      });

      return member;
    });
  } catch (error) {
    console.error('Error adding circle member:', error);
    throw error;
  }
}

/**
 * Get all circle members
 */
export async function getCircleMembers() {
  try {
    const circleData = await getMyCircleData();
    if (!circleData) return { family: [], clients: [], friends: [] };

    return circleData.members || { family: [], clients: [], friends: [] };
  } catch (error) {
    console.error('Error getting circle members:', error);
    return { family: [], clients: [], friends: [] };
  }
}

/**
 * Remove member from circle
 * @param {string} memberId - Member ID to remove
 * @param {string} relationship - Relationship type
 */
export async function removeCircleMember(memberId, relationship) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    const userRef = doc(db, 'users', userId);

    return await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const myCircle = userData.myCircle || {};
      const members = myCircle.members?.[relationship] || [];

      // Remove member
      const updatedMembers = members.filter(m => m.id !== memberId);

      const relationshipKey = `myCircle.members.${relationship}`;

      transaction.update(userRef, {
        [relationshipKey]: updatedMembers,
        'myCircle.stats.totalMembers': Math.max(0, (myCircle.stats?.totalMembers || 0) - 1)
      });
    });
  } catch (error) {
    console.error('Error removing circle member:', error);
    throw error;
  }
}

/**
 * Process referral signup when someone joins using referral code
 * @param {string} newUserId - New user ID
 * @param {string} referralCode - Referral code used
 */
async function processReferralSignup(newUserId, referralCode) {
  try {
    // Find the referrer
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('myCircle.code', '==', referralCode));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log('Referrer not found for code:', referralCode);
      return;
    }

    const referrerDoc = querySnapshot.docs[0];
    const referrerId = referrerDoc.id;
    const referrerRef = doc(db, 'users', referrerId);

    // Update referrer stats
    await updateDoc(referrerRef, {
      'myCircle.stats.successfulReferrals': (referrerDoc.data().myCircle?.stats?.successfulReferrals || 0) + 1
    });

    // Create referral tracking document
    const referralRef = doc(collection(db, 'referrals'));
    await setDoc(referralRef, {
      referrerId,
      referredUserId: newUserId,
      referralCode,
      status: 'pending', // pending, active, rewarded
      level: 1, // Direct referral
      createdAt: Date.now(),
      rewards: {
        signupBonus: 0,
        activityRewards: 0,
        total: 0
      }
    });

    console.log('Referral processed for:', referrerId);
  } catch (error) {
    console.error('Error processing referral signup:', error);
  }
}

/**
 * Share recipe with circle member
 * @param {string} recipeId - Recipe ID
 * @param {Array} memberIds - Array of member IDs to share with
 */
export async function shareRecipeWithCircle(recipeId, memberIds) {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // Validate inputs
    const validatedRecipeId = validateRecipeId(recipeId);
    const validatedMemberIds = validateMemberIds(memberIds);

    const userRef = doc(db, 'users', userId);

    return await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const myCircle = userData.myCircle || {};
      const shared = myCircle.shared || {};
      const sharedRecipes = shared.recipes || [];

      // Add new share
      const shareEntry = {
        id: `share_${Date.now()}`,
        recipeId: validatedRecipeId,
        sharedWith: validatedMemberIds,
        sharedAt: Date.now()
      };

      transaction.update(userRef, {
        'myCircle.shared.recipes': [...sharedRecipes, shareEntry],
        'myCircle.stats.sharedRecipes': (myCircle.stats?.sharedRecipes || 0) + 1
      });

      return shareEntry;
    });
  } catch (error) {
    console.error('Error sharing recipe:', error);
    throw error;
  }
}

/**
 * Get earnings summary
 */
export async function getEarningsSummary() {
  try {
    const circleData = await getMyCircleData();
    if (!circleData) return null;

    return circleData.earnings || {
      thisMonth: 0,
      total: 0,
      pending: 0,
      byType: {
        referralBonuses: 0,
        activityRewards: 0,
        recipeSales: 0,
        templateSales: 0
      }
    };
  } catch (error) {
    console.error('Error getting earnings:', error);
    return null;
  }
}

/**
 * Get referral statistics for network visualization
 */
export async function getReferralNetwork() {
  try {
    const userId = getCurrentUserId();
    if (!userId) return { direct: [], extended: [] };

    // Get direct referrals
    const referralsRef = collection(db, 'referrals');
    const directQuery = query(referralsRef, where('referrerId', '==', userId), where('level', '==', 1));
    const directSnapshot = await getDocs(directQuery);

    const direct = directSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Get extended referrals (level 2)
    const extendedQuery = query(referralsRef, where('referrerId', '==', userId), where('level', '==', 2));
    const extendedSnapshot = await getDocs(extendedQuery);

    const extended = extendedSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return {
      direct,
      extended,
      totalDirect: direct.length,
      totalExtended: extended.length,
      totalActive: direct.filter(r => r.status === 'active').length + extended.filter(r => r.status === 'active').length
    };
  } catch (error) {
    console.error('Error getting referral network:', error);
    return { direct: [], extended: [] };
  }
}

export default {
  initializeMyCircle,
  getMyCircleData,
  getMyCircleLink,
  addCircleMember,
  getCircleMembers,
  removeCircleMember,
  shareRecipeWithCircle,
  getEarningsSummary,
  getReferralNetwork
};
