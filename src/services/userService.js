// src/services/userService.js

import { db } from '../firebase';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { seedStarterRecipesForUser } from './starterRecipeService';

/**
 * Create a new user document when user registers.
 * Seeds starter recipes for new users.
 * 
 * @param {string} uid - User ID
 * @param {Object} userData - User data to store
 * @returns {Promise<boolean>} - Success status
 */
export const createUserProfile = async (uid, userData) => {
  try {
    const userRef = doc(db, 'users', uid);
    await setDoc(userRef, {
      ...userData,
      createdAt: new Date(),
      lastLogin: new Date(),
      onboardingComplete: false // Track onboarding status
    });
    
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