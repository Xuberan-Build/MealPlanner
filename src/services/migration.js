// migration.js
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  writeBatch,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = {
    apiKey: "AIzaSyBF8fq60g6feJVajlBnQJEBRwkrlgIX8sc",
    authDomain: "meal-planner-v1-9be19.firebaseapp.com",
    databaseURL: "https://meal-planner-v1-9be19-default-rtdb.firebaseio.com",
    projectId: "meal-planner-v1-9be19",
    storageBucket: "meal-planner-v1-9be19.appspot.com",
    messagingSenderId: "560827460340",
    appId: "1:560827460340:web:7b88aad6136b89d5fa4ca1",
    measurementId: "G-FZTKHMBBCT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Helper function to create clean IDs
const createCleanId = (str) => {
    if (!str || typeof str !== 'string') return 'unknown';
    return str.toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

// Helper function to chunk array into batches
const chunkArray = (array, size) => {
    const chunked = [];
    for (let i = 0; i < array.length; i += size) {
        chunked.push(array.slice(i, i + size));
    }
    return chunked;
};

// Extract unique ingredients from recipes
const extractIngredients = (recipes) => {
    const ingredientsMap = new Map();

    recipes.forEach(recipe => {
        recipe.ingredients.forEach(ingredient => {
            const id = createCleanId(ingredient.ingredientId);
            if (!ingredientsMap.has(id)) {
                ingredientsMap.set(id, {
                    id,
                    name: ingredient.ingredientId,
                    category: 'Other', // You might want to add proper categorization
                    units: ['g', 'oz', 'cup', 'tbsp', 'tsp', 'piece', 'whole'],
                    metadata: {
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        isActive: true
                    }
                });
            }
        });
    });

    return Array.from(ingredientsMap.values());
};

// Extract sauces from recipes
const extractSauces = (recipes) => {
    const saucesMap = new Map();

    recipes.forEach(recipe => {
        if (recipe.sauceId) {
            const id = createCleanId(recipe.sauceId);
            if (!saucesMap.has(id)) {
                saucesMap.set(id, {
                    id,
                    name: recipe.sauceId,
                    ingredients: [], // You might want to add proper ingredients
                    instructions: '',
                    metadata: {
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp(),
                        isActive: true
                    }
                });
            }
        }
    });

    return Array.from(saucesMap.values());
};

// Import ingredients into Firestore
async function importIngredients(ingredients) {
    const batches = chunkArray(ingredients, 500);

    for (const batchIngredients of batches) {
        const batch = writeBatch(db);

        batchIngredients.forEach(ingredient => {
            const ingredientRef = doc(collection(db, 'ingredients'), ingredient.id);
            batch.set(ingredientRef, ingredient);
        });

        await batch.commit();
    }
    console.log(`Imported ${ingredients.length} ingredients`);
}

// Import sauces into Firestore
async function importSauces(sauces) {
    const batches = chunkArray(sauces, 500);

    for (const batchSauces of batches) {
        const batch = writeBatch(db);

        batchSauces.forEach(sauce => {
            const sauceRef = doc(collection(db, 'sauces'), sauce.id);
            batch.set(sauceRef, sauce);
        });

        await batch.commit();
    }
    console.log(`Imported ${sauces.length} sauces`);
}

// Import recipes into Firestore
async function importRecipes(recipes) {
    const batches = chunkArray(recipes, 500);

    for (const batchRecipes of batches) {
        const batch = writeBatch(db);

        batchRecipes.forEach(recipe => {
            const recipeRef = doc(collection(db, 'recipes'), recipe.id);
            // Ensure all required fields are present
            const recipeData = {
                ...recipe,
                cookingTime: recipe.cookingTime || 0,
                servings: recipe.servings || 1,
                image: recipe.image || '',
                sides: recipe.sides || [],
                sauceId: recipe.sauceId || null,
                metadata: {
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    isActive: true
                }
            };
            batch.set(recipeRef, recipeData);
        });

        await batch.commit();
    }
    console.log(`Imported ${recipes.length} recipes`);
}

// Main migration function
async function runMigration() {
    try {
        console.log('Starting migration...');

        // Read recipes data
        const recipesData = JSON.parse(fs.readFileSync('./recipe.json', 'utf8'));

        // Extract and import ingredients first
        const ingredients = extractIngredients(recipesData);
        await importIngredients(ingredients);

        // Extract and import sauces second
        const sauces = extractSauces(recipesData);
        await importSauces(sauces);

        // Import recipes last (after dependencies are in place)
        await importRecipes(recipesData);

        console.log('Migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
        // Log detailed error information
        if (error.code) {
            console.error('Error code:', error.code);
        }
        if (error.details) {
            console.error('Error details:', error.details);
        }
    }
}

// Run the migration
runMigration();
