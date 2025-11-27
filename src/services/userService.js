// src/services/userService.js

import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { seedStarterRecipesForUser } from './starterRecipeService';
import { initializeUserCredits } from './creditService';
import { initializeUserMetrics } from './userMetricsService';
import { initializeReferralSystem } from './referralService';

/**
 * Create a new user document when user registers.
 * Seeds starter recipes for new users.
 *
 * @param {string} uid - User ID
 * @param {Object} userData - User data to store
 * @param {string} referralCode - Optional referral code from signup
 * @returns {Promise<boolean>} - Success status
 */
export const createUserProfile = async (uid, userData, referralCode = null) => {
  try {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...userData,
      createdAt: now,
      lastLogin: now,
      onboardingComplete: false, // Track onboarding status

      // Initialize subscription tier
      subscription: {
        tier: 'free',
        status: 'active',
        startDate: now,
        renewalDate: null,
        cancelledAt: null
      },

      // Initialize credits
      credits: {
        freeCredits: {
          total: 5,
          used: 0,
          remaining: 5,
          resetDate: nextMonth,
          lastResetAt: null
        },
        paidCredits: {
          balance: 0,
          totalPurchased: 0,
          totalSpent: 0.00
        },
        totalAvailable: 5,
        usage: {
          thisMonth: 0,
          lastMonth: 0,
          allTime: 0,
          averagePerMonth: 0
        }
      }
    });

    console.log('✅ User profile created with credits initialized');

    // Initialize user metrics (achievements, streaks, etc.)
    await initializeUserMetrics(uid);

    // Initialize referral system
    await initializeReferralSystem(uid, userData.name || 'User', referralCode);

    // Seed starter recipes for the new user
    await seedStarterRecipesForUser(uid);

    return true;
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw error;
  }
};

/**
 * Get user profile data.
 * 
 * @param {string} uid - User ID
 * @returns {Promise<Object|null>} - User data or null if not found
 */
export const getUserProfile = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      return userDoc.data();
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw error;
  }
};

/**
 * Update user profile data.
 * 
 * @param {string} uid - User ID
 * @param {Object} userData - Updated user data
 * @returns {Promise<boolean>} - Success status
 */
export const updateUserProfile = async (uid, userData) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw error;
  }
};

/**
 * Update last login time.
 * Non-fatal if it fails.
 * 
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - Success status
 */
export const updateLastLogin = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      lastLogin: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error updating last login:', error);
    // Non-fatal error, just log it
    return false;
  }
};

/**
 * Mark onboarding as complete.
 * 
 * @param {string} uid - User ID
 * @returns {Promise<boolean>} - Success status
 */
export const completeOnboarding = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      onboardingComplete: true,
      onboardingCompletedAt: new Date()
    });
    return true;
  } catch (error) {
    console.error('Error completing onboarding:', error);
    throw error;
  }
};