// src/services/recipeService.js

import { db } from '../firebase';
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

/**
 * **Collection References**
 */
const recipesCollectionRef = collection(db, 'recipes');
const variationsCollectionRef = collection(db, 'variations');

/**
 * Adds a new recipe to the "recipes" collection.
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

    const recipe = {
      ...recipeData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    console.log("📌 Preparing to add recipe to Firestore:", recipe);
    const docRef = await addDoc(recipesCollectionRef, recipe);
    console.log("📌 SUCCESS: Recipe added with ID:", docRef.id);
    return docRef.id;
  } catch (error) {
    console.error("📌 ERROR in addRecipe:", error);
    throw new Error(`Failed to add recipe: ${error.message}`);
  }
}

/**
 * Retrieves all recipes from the "recipes" collection.
 *
 * @returns {Promise<Array>} - An array of recipe objects.
 */
export async function getRecipes() {
  try {
    const snapshot = await getDocs(recipesCollectionRef);
    const recipes = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return recipes;
  } catch (error) {
    console.error('Error fetching recipes:', error);
    throw new Error('Failed to fetch recipes');
  }
}

/**
 * Retrieves a single recipe by its ID.
 *
 * @param {string} recipeId - The ID of the recipe to retrieve.
 * @returns {Promise<Object>} - The recipe object.
 */
export async function getRecipeById(recipeId) {
  try {
    const recipeDoc = await getDoc(doc(db, 'recipes', recipeId));
    if (!recipeDoc.exists()) {
      throw new Error('Recipe not found');
    }
    return { id: recipeDoc.id, ...recipeDoc.data() };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    throw new Error('Failed to fetch recipe');
  }
}

/**
 * Updates an existing recipe in the "recipes" collection.
 *
 * @param {string} recipeId - The ID of the recipe to update.
 * @param {Object} updatedData - The data to update.
 * @returns {Promise<void>}
 */
export async function updateRecipe(recipeId, updatedData) {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
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
 *
 * @param {string} recipeId - The ID of the recipe to delete.
 * @returns {Promise<void>}
 */
export async function deleteRecipe(recipeId) {
  try {
    const recipeRef = doc(db, 'recipes', recipeId);
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
 *
 * @param {Object} variationData - The variation data to add.
 * @returns {Promise<string>} - The ID of the newly added variation.
 */
export async function addVariation(variationData) {
  try {
    const variation = {
      ...variationData,
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
 *
 * @param {string} recipeId - The ID of the recipe.
 * @returns {Promise<Array>} - An array of variation objects.
 */
export async function getVariationsByRecipe(recipeId) {
  try {
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
 *
 * @param {string} variationId - The ID of the variation to retrieve.
 * @returns {Promise<Object>} - The variation object.
 */
export async function getVariationById(variationId) {
  try {
    const variationDoc = await getDoc(doc(db, 'variations', variationId));
    if (!variationDoc.exists()) {
      throw new Error('Variation not found');
    }
    return { id: variationDoc.id, ...variationDoc.data() };
  } catch (error) {
    console.error('Error fetching variation:', error);
    throw new Error('Failed to fetch variation');
  }
}

/**
 * Updates an existing variation in the "variations" collection.
 *
 * @param {string} variationId - The ID of the variation to update.
 * @param {Object} updatedData - The data to update.
 * @returns {Promise<void>}
 */
export async function updateVariation(variationId, updatedData) {
  try {
    const variationRef = doc(db, 'variations', variationId);
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
 *
 * @param {string} variationId - The ID of the variation to delete.
 * @returns {Promise<void>}
 */
export async function deleteVariation(variationId) {
  try {
    const variationRef = doc(db, 'variations', variationId);
    await deleteDoc(variationRef);
    console.log('Variation deleted successfully!');
  } catch (error) {
    console.error('Error deleting variation:', error);
    throw new Error('Failed to delete variation');
  }
}
