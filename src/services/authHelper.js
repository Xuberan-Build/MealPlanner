// src/services/authHelper.js

import { auth } from '../firebase';

/**
 * Get the currently authenticated user's ID
 * @returns {string|null} User ID or null if not authenticated
 */
export function getCurrentUserId() {
  const user = auth.currentUser;
  return user ? user.uid : null;
}

/**
 * Get the current user object
 * @returns {Object|null} User object or null if not authenticated
 */
export function getCurrentUser() {
  return auth.currentUser;
}

/**
 * Check if a user is currently authenticated
 * @returns {boolean} True if user is authenticated, false otherwise
 */
export function isUserAuthenticated() {
  return auth.currentUser !== null;
}

/**
 * Get current user's email
 * @returns {string|null} User email or null if not authenticated
 */
export function getCurrentUserEmail() {
  const user = auth.currentUser;
  return user ? user.email : null;
}
