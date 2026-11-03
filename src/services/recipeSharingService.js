// src/services/recipeSharingService.js
//
// Sharing goes through the shareRecipe Cloud Function: the app can no longer search other
// users' profiles or write into their Recipe Book directly (see firestore.rules).
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, auth } from '../firebase';

/**
 * Share one of your recipes with the Savor Meals account that signs in with this email.
 * @param {Object} recipe - The recipe to share (must be yours; needs its id)
 * @param {string} recipientEmail - The recipient's sign-in email
 * @returns {Promise<{success: true, message: string, recipientName: string}>}
 */
export async function shareRecipeWithUser(recipe, recipientEmail) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be logged in to share recipes');
  }
  const email = String(recipientEmail || '').trim();
  if (user.email && email.toLowerCase() === user.email.toLowerCase()) {
    throw new Error('You cannot share a recipe with yourself');
  }
  if (!recipe?.id) {
    throw new Error('Save the recipe before sharing it');
  }

  try {
    const share = httpsCallable(getFunctions(app), 'shareRecipe');
    const { data } = await share({ recipeId: recipe.id, recipientEmail: email });
    const recipientName = data?.recipientName || email;
    return {
      success: true,
      message: `Recipe successfully shared with ${recipientName}!`,
      recipientName,
    };
  } catch (error) {
    // Callable errors carry a user-facing message for the codes the function throws.
    const known = ['functions/not-found', 'functions/invalid-argument', 'functions/resource-exhausted', 'functions/unauthenticated'];
    throw new Error(known.includes(error?.code) ? error.message : 'Could not share the recipe. Please try again.');
  }
}
