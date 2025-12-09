// src/services/recipeService.js

import { db, auth } from '../firebase';
import {
  collection,
  doc,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { trackRecipeAdded, trackRecipeViewed } from './userMetricsService';

/**
 * **Collection References**
 */
const recipesCollectionRef = collection(db, 'recipes');
const variationsCollectionRef = collection(db, 'variations');

/**
 * Adds a new recipe to the "recipes" collection with user ID.
 *
 * @param {Object} recipeData - The recipe data to add.
 * @returns {Promise<string>} - The ID of the newly added recipe.
 */
export async function addRecipe(recipeData) {
  console.log("📌 START: addRecipe called with data:", recipeData);
  try {
    // Validate basic recipe data
    if (!recipeData || !recipeData.title) {
      console.error("📌 ERROR: Invalid recipe data - missing title");
      throw new Error('Recipe data is invalid - title is required');
    }

    // Get current user
    const user = auth.currentUser;
    if (!user) {
      console.error("📌 ERROR: No authenticated user");
      throw new Error('You must be logged in to add a recipe');
    }

    // Clean up recipe data - remove empty strings and undefined values
    const cleanedRecipeData = Object.entries(recipeData).reduce((acc, [key, value]) => {
      // Keep the value if it's not an empty string and not undefined
      // For arrays and objects, keep them even if empty
      if (value !== '' && value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {});

    const recipe = {
      ...cleanedRecipeData,
      userId: user.uid, // Associate recipe with current user
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    console.log("📌 Preparing to add recipe to Firestore:", recipe);
    console.log("📌 RECIPE DIET TYPE VALUE:", JSON.stringify({
      dietType: recipe.dietType,
      type: typeof recipe.dietType,
      isEmpty: recipe.dietType === '',
      isUndefined: recipe.dietType === undefined,
      isNull: recipe.dietType === null,
      title: recipe.title
    }));
    const docRef = await addDoc(recipesCollectionRef, recipe);
    console.log("📌 SUCCESS: Recipe added with ID:", docRef.id);

    // Track recipe addition in user metrics
    await trackRecipeAdded(user.uid);

    return docRef.id;
  } catch (error) {
    console.error("📌 ERROR in addRecipe:", error);
    throw new Error(`Failed to add recipe: ${error.message}`);
  }
}

/**
 * Retrieves all recipes from the "recipes" collection for the current user.
 *
 * @returns {Promise<Array>} - An array of recipe objects.
 */
export async function getRecipes() {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      console.error("ERROR: No authenticated user");
      return []; // Return empty array instead of throwing error for better UX
    }

    // Filter recipes by user ID
    const recipesQuery = query(
      recipesCollectionRef,
      where("userId", "==", user.uid)
    );
    
    const snapshot = await getDocs(recipesQuery);
    const recipes = snapshot.docs.map((doc) => {
      const data = doc.data();
      // Log diet type for debugging
      if (!data.dietType || data.dietType === '') {
        console.log("⚠️ Recipe without diet type:", doc.id, data.title);
      }
      return {
        id: doc.id,
        ...data,
      };
    });

    return recipes;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    throw new Error('Failed to fetch recipes');
  }
}

/**
 * Retrieves a single recipe by its ID.
 * Ensures the recipe belongs to the current user.
 *
 * @param {string} recipeId - The ID of the recipe to retrieve.
 * @returns {Promise<Object>} - The recipe object.
 */
export async function getRecipeById(recipeId) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to view recipes');
    }
    
    const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));
    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }
    
    const recipeData = recipeDoc.data();
    
    // Verify recipe belongs to current user
    if (recipeData.userId && recipeData.userId !== user.uid) {
      throw new Error('You do not have permission to view this recipe');
    }

    // Track recipe view in user metrics
    await trackRecipeViewed(user.uid, recipeId);

    return { id: recipeDoc.id, ...recipeData };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    throw new Error('Failed to fetch recipe');
  }
}

/**
 * Updates an existing recipe in the "recipes" collection.
 * Ensures the recipe belongs to the current user.
 *
 * @param {string} recipeId - The ID of the recipe to update.
 * @param {Object} updatedData - The data to update.
 * @returns {Promise<void>}
 */
export async function updateRecipe(recipeId, updatedData) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to update recipes');
    }
    
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeDoc = await getDoc(recipeRef);
    
    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }
    
    const recipeData = recipeDoc.data();
    
    // Verify recipe belongs to current user
    if (recipeData.userId && recipeData.userId !== user.uid) {
      throw new Error('You do not have permission to update this recipe');
    }
    
    await updateDoc(recipeRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });
    console.log('Recipe updated successfully!');
  } catch (error) {
    console.error('Error updating recipe:', error);
    throw new Error('Failed to update recipe');
  }
}

/**
 * Deletes a recipe from the "recipes" collection.
 * Ensures the recipe belongs to the current user.
 *
 * @param {string} recipeId - The ID of the recipe to delete.
 * @returns {Promise<void>}
 */
export async function deleteRecipe(recipeId) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to delete recipes');
    }
    
    const recipeRef = doc(db, 'recipes', recipeId);
    const recipeDoc = await getDoc(recipeRef);
    
    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }
    
    const recipeData = recipeDoc.data();
    
    // Verify recipe belongs to current user
    if (recipeData.userId && recipeData.userId !== user.uid) {
      throw new Error('You do not have permission to delete this recipe');
    }
    
    await deleteDoc(recipeRef);
    console.log('Recipe deleted successfully!');
  } catch (error) {
    console.error('Error deleting recipe:', error);
    throw new Error('Failed to delete recipe');
  }
}

/**
 * ### **Variation Functions**
 */

/**
 * Adds a new variation to the "variations" collection.
 * Associates the variation with the current user.
 *
 * @param {Object} variationData - The variation data to add.
 * @returns {Promise<string>} - The ID of the newly added variation.
 */
export async function addVariation(variationData) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to add variations');
    }
    
    // Verify parent recipe belongs to user
    const recipeId = variationData.recipeId;
    if (recipeId) {
      const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));
      if (!recipeDoc.exists()) {
        throw new Error('Parent recipe not found');
      }
      
      const recipeData = recipeDoc.data();
      if (recipeData.userId && recipeData.userId !== user.uid) {
        throw new Error('You do not have permission to add variations to this recipe');
      }
    }
    
    const variation = {
      ...variationData,
      userId: user.uid, // Associate variation with current user
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    const docRef = await addDoc(variationsCollectionRef, variation);
    console.log('Variation added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding variation:', error);
    throw new Error('Failed to add variation');
  }
}

/**
 * Retrieves all variations associated with a specific recipe.
 * Ensures the variations belong to the current user.
 *
 * @param {string} recipeId - The ID of the recipe.
 * @returns {Promise<Array>} - An array of variation objects.
 */
export async function getVariationsByRecipe(recipeId) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to view variations');
    }
    
    // First verify the parent recipe belongs to the user
    const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));
    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }
    
    const recipeData = recipeDoc.data();
    if (recipeData.userId && recipeData.userId !== user.uid) {
      throw new Error('You do not have permission to view variations for this recipe');
    }
    
    const q = query(variationsCollectionRef, where('recipeId', '==', recipeId));
    const snapshot = await getDocs(q);
    const variations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    
    return variations;
  } catch (error) {
    console.error('Error fetching variations:', error);
    throw new Error('Failed to fetch variations');
  }
}

/**
 * Retrieves a single variation by its ID.
 * Ensures the variation belongs to the current user.
 *
 * @param {string} variationId - The ID of the variation to retrieve.
 * @returns {Promise<Object>} - The variation object.
 */
export async function getVariationById(variationId) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to view variations');
    }
    
    const variationDoc = await getDoc(doc(db, 'variations', variationId));
    if (!variationDoc.exists()) {
      throw new Error('Variation not found');
    }
    
    const variationData = variationDoc.data();
    
    // Verify variation belongs to current user or parent recipe belongs to user
    if (variationData.userId && variationData.userId !== user.uid) {
      // If variation has a recipe ID, check if that recipe belongs to the user
      if (variationData.recipeId) {
        const recipeDoc = await getDoc(doc(db, 'recipes', variationData.recipeId));
        if (!recipeDoc.exists() || recipeDoc.data().userId !== user.uid) {
          throw new Error('You do not have permission to view this variation');
        }
      } else {
        throw new Error('You do not have permission to view this variation');
      }
    }
    
    return { id: variationDoc.id, ...variationData };
  } catch (error) {
    console.error('Error fetching variation:', error);
    throw new Error('Failed to fetch variation');
  }
}

/**
 * Updates an existing variation in the "variations" collection.
 * Ensures the variation belongs to the current user.
 *
 * @param {string} variationId - The ID of the variation to update.
 * @param {Object} updatedData - The data to update.
 * @returns {Promise<void>}
 */
export async function updateVariation(variationId, updatedData) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to update variations');
    }
    
    const variationRef = doc(db, 'variations', variationId);
    const variationDoc = await getDoc(variationRef);
    
    if (!variationDoc.exists()) {
      throw new Error('Variation not found');
    }
    
    const variationData = variationDoc.data();
    
    // Verify variation belongs to current user
    if (variationData.userId && variationData.userId !== user.uid) {
      throw new Error('You do not have permission to update this variation');
    }
    
    await updateDoc(variationRef, {
      ...updatedData,
      updatedAt: serverTimestamp(),
    });
    console.log('Variation updated successfully!');
  } catch (error) {
    console.error('Error updating variation:', error);
    throw new Error('Failed to update variation');
  }
}

/**
 * Deletes a variation from the "variations" collection.
 * Ensures the variation belongs to the current user.
 *
 * @param {string} variationId - The ID of the variation to delete.
 * @returns {Promise<void>}
 */
export async function deleteVariation(variationId) {
  try {
    // Get current user
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be logged in to delete variations');
    }
    
    const variationRef = doc(db, 'variations', variationId);
    const variationDoc = await getDoc(variationRef);
    
    if (!variationDoc.exists()) {
      throw new Error('Variation not found');
    }
    
    const variationData = variationDoc.data();
    
    // Verify variation belongs to current user
    if (variationData.userId && variationData.userId !== user.uid) {
      throw new Error('You do not have permission to delete this variation');
    }
    
    await deleteDoc(variationRef);
    console.log('Variation deleted successfully!');
  } catch (error) {
    console.error('Error deleting variation:', error);
    throw new Error('Failed to delete variation');
  }
}