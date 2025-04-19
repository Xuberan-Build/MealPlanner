import { db } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Collection name for user profiles
const COLLECTION_NAME = 'userProfiles';

/**
 * Fetches a user profile from Firestore
 * @param {string} userId - The ID of the user
 * @returns {Promise<Object>} - The user profile data
 */
export const getUserProfile = async (userId) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data();
    } else {
      // Profile doesn't exist yet
      return null;
    }
  } catch (error) {
    console.error('Error fetching user profile:', error);
    throw new Error('Failed to fetch user profile');
  }
};

/**
 * Creates a new user profile in Firestore
 * @param {string} userId - The ID of the user
 * @param {Object} profileData - The profile data to save
 * @returns {Promise<void>}
 */
export const createUserProfile = async (userId, profileData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await setDoc(userRef, {
      ...profileData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error creating user profile:', error);
    throw new Error('Failed to create user profile');
  }
};

/**
 * Updates an existing user profile in Firestore
 * @param {string} userId - The ID of the user
 * @param {Object} updateData - The profile data to update
 * @returns {Promise<void>}
 */
export const updateUserProfile = async (userId, updateData) => {
  try {
    const userRef = doc(db, COLLECTION_NAME, userId);
    await updateDoc(userRef, {
      ...updateData,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Error updating user profile:', error);
    throw new Error('Failed to update user profile');
  }
};

/**
 * Creates or updates a user profile based on whether it exists
 * @param {string} userId - The ID of the user
 * @param {Object} profileData - The profile data to save
 * @returns {Promise<void>}
 */
export const saveUserProfile = async (userId, profileData) => {
  try {
    const existingProfile = await getUserProfile(userId);
    
    if (existingProfile) {
      await updateUserProfile(userId, profileData);
    } else {
      await createUserProfile(userId, profileData);
    }
  } catch (error) {
    console.error('Error saving user profile:', error);
    throw new Error('Failed to save user profile');
  }
};