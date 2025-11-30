import { db, auth } from '../firebase';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  limit
} from 'firebase/firestore';

const usersRef = collection(db, 'users');
const recipesRef = collection(db, 'recipes');

/**
 * Share a recipe with another user by creating a copy in their recipe book
 * @param {Object} recipe - The recipe object to share
 * @param {string} recipientEmail - Email of the user to share with
 * @returns {Promise<Object>} - Result with success status and message
 */
export async function shareRecipeWithUser(recipe, recipientEmail) {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to share recipes');
    }

    // Don't allow sharing with yourself
    if (recipientEmail.toLowerCase() === user.email.toLowerCase()) {
      throw new Error('You cannot share a recipe with yourself');
    }

    // Find recipient user by email
    const recipientQuery = query(usersRef, where('email', '==', recipientEmail), limit(1));
    const recipientSnapshot = await getDocs(recipientQuery);

    if (recipientSnapshot.empty) {
      throw new Error(`No user found with email: ${recipientEmail}`);
    }

    const recipientDoc = recipientSnapshot.docs[0];
    const recipientId = recipientDoc.id;
    const recipientData = recipientDoc.data();

    // Create a copy of the recipe for the recipient
    // Destructure to remove the id field
    const { id, ...recipeWithoutId } = recipe;

    const recipeCopy = {
      ...recipeWithoutId,
      userId: recipientId, // Set to recipient's ID
      sharedFrom: {
        userId: user.uid,
        userEmail: user.email,
        userName: user.displayName || user.email,
        originalRecipeId: id,
        sharedAt: serverTimestamp()
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // Add the recipe copy to the recipient's recipes
    await addDoc(recipesRef, recipeCopy);

    return {
      success: true,
      message: `Recipe successfully shared with ${recipientData.displayName || recipientEmail}!`,
      recipientName: recipientData.displayName || recipientEmail
    };
  } catch (error) {
    console.error('Error sharing recipe:', error);
    throw error;
  }
}

/**
 * Search for users by email (for sharing UI autocomplete)
 * @param {string} emailPrefix - Email prefix to search for
 * @returns {Promise<Array>} - Array of user objects
 */
export async function searchUsersByEmail(emailPrefix) {
  try {
    if (!emailPrefix || emailPrefix.length < 3) {
      return [];
    }

    const user = auth.currentUser;
    if (!user) {
      return [];
    }

    // Note: Firestore doesn't support prefix queries efficiently
    // This is a simple implementation - for production, use Algolia or similar
    // Query with limit to comply with security rules
    const usersQuery = query(usersRef, limit(10));
    const usersSnapshot = await getDocs(usersQuery);
    const users = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      // Don't include the current user in search results
      if (userData.email &&
          userData.email.toLowerCase() !== user.email.toLowerCase() &&
          userData.email.toLowerCase().startsWith(emailPrefix.toLowerCase())) {
        users.push({
          id: doc.id,
          email: userData.email,
          displayName: userData.displayName || userData.email
        });
      }
    });

    return users; // Already limited to 10 in query
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}
