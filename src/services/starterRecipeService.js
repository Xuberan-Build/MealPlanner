// src/services/starterRecipeService.js

import { db } from '../firebase';
import { 
  collection, 
  doc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  serverTimestamp 
} from 'firebase/firestore';

// Predefined starter recipes
const STARTER_RECIPES = [
  {
    title: "Simple Pancakes",
    mealType: "Breakfast",
    dietType: "Vegetarian",
    ingredients: [
      { amount: 1, unit: "cup", ingredientId: "all-purpose-flour" },
      { amount: 2, unit: "tbsp", ingredientId: "sugar" },
      { amount: 1, unit: "tsp", ingredientId: "baking-powder" },
      { amount: 1, unit: "cup", ingredientId: "milk" },
      { amount: 1, unit: "", ingredientId: "egg" },
      { amount: 2, unit: "tbsp", ingredientId: "butter" }
    ],
    instructions: "1. Mix dry ingredients. 2. Add wet ingredients and stir until just combined. 3. Cook on a hot griddle until bubbles form, then flip.",
    notes: "Great for a quick breakfast!",
    prepTime: "15 minutes"
  },
  {
    title: "Classic Caesar Salad",
    mealType: "Lunch",
    dietType: "Other",
    ingredients: [
      { amount: 1, unit: "head", ingredientId: "romaine-lettuce" },
      { amount: 1/4, unit: "cup", ingredientId: "parmesan-cheese" },
      { amount: 1, unit: "cup", ingredientId: "croutons" },
      { amount: 2, unit: "tbsp", ingredientId: "olive-oil" },
      { amount: 1, unit: "tsp", ingredientId: "lemon-juice" },
      { amount: 1, unit: "", ingredientId: "garlic-clove" }
    ],
    instructions: "1. Wash and chop lettuce. 2. Mix dressing ingredients. 3. Toss with lettuce, add cheese and croutons.",
    notes: "Add grilled chicken for a more substantial meal.",
    prepTime: "10 minutes"
  },
  {
    title: "Spaghetti with Tomato Sauce",
    mealType: "Dinner",
    dietType: "Vegetarian",
    ingredients: [
      { amount: 8, unit: "oz", ingredientId: "spaghetti" },
      { amount: 1, unit: "can", ingredientId: "tomato-sauce" },
      { amount: 1, unit: "", ingredientId: "onion" },
      { amount: 2, unit: "cloves", ingredientId: "garlic" },
      { amount: 1, unit: "tbsp", ingredientId: "olive-oil" },
      { amount: 1, unit: "tsp", ingredientId: "dried-basil" }
    ],
    instructions: "1. Cook pasta according to package. 2. Sauté onion and garlic in oil. 3. Add sauce and seasonings, simmer 10 minutes. 4. Combine with pasta.",
    notes: "Great base recipe that can be customized with vegetables or protein.",
    prepTime: "20 minutes"
  }
];

/**
 * Seeds starter recipes for a new user's account.
 * @param {string} userId - The user ID to create recipes for
 * @returns {Promise<void>}
 */
export async function seedStarterRecipesForUser(userId) {
  try {
    console.log(`Starting to seed recipes for user: ${userId}`);
    
    // Check if user already has recipes to avoid duplicates
    const recipesRef = collection(db, 'recipes');
    const q = query(recipesRef, where("userId", "==", userId));
    const existingRecipes = await getDocs(q);
    
    if (!existingRecipes.empty) {
      console.log(`User ${userId} already has recipes, skipping seeding`);
      return;
    }
    
    // Use a batch write for better performance and atomicity
    const batch = writeBatch(db);
    
    // Add each starter recipe for this user
    STARTER_RECIPES.forEach((recipeData) => {
      const newRecipeRef = doc(recipesRef);
      batch.set(newRecipeRef, {
        ...recipeData,
        userId: userId,
        isStarterRecipe: true, // Flag to identify starter recipes
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    
    // Commit the batch
    await batch.commit();
    console.log(`Successfully seeded ${STARTER_RECIPES.length} recipes for user: ${userId}`);
  } catch (error) {
    console.error('Error seeding starter recipes:', error);
    throw new Error(`Failed to seed starter recipes: ${error.message}`);
  }
}

/**
 * Function to get all available starter recipes (admin use)
 * @returns {Array} Array of starter recipe templates
 */
export function getStarterRecipeTemplates() {
  return [...STARTER_RECIPES];
}