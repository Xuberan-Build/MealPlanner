// recipeCleanup.js
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  writeBatch
} from 'firebase/firestore';

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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const VALID_MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Desserts'];

function cleanupRecipeData(data) {
    // Clean string (remove quotes and trim)
    const cleanString = (str) => str?.replace(/"/g, '').trim() || '';

    // Get FMD phase from string if present
    function extractFMDPhase(str) {
        const cleaned = cleanString(str);
        if (cleaned.toLowerCase().includes('fmd')) {
            const match = cleaned.match(/phase\s*(\d)/i);
            if (match) {
                return `FMD - Phase ${match[1]}`;
            }
        }
        return null;
    }

    // Get meal type from string or determine based on context
    function determineMealType(str) {
        const cleaned = cleanString(str).toLowerCase();

        // Check if it's already a valid meal type
        const matchedType = VALID_MEAL_TYPES.find(type =>
            cleaned === type.toLowerCase());
        if (matchedType) return matchedType;

        // For now, set to "Other" - we can add more logic if needed
        return 'Other';
    }

    const oldMealType = data.mealType;
    const oldDietType = data.dietType;

    // Extract FMD phase if present in mealType
    const fmdPhase = extractFMDPhase(oldMealType);

    return {
        // Only update if changes are needed
        updates: {
            mealType: determineMealType(oldMealType),
            dietType: fmdPhase || oldDietType || 'None'
        },
        // Return true if any changes were made
        hasChanges: fmdPhase !== null ||
                   cleanString(oldMealType) !== oldMealType ||
                   cleanString(oldDietType) !== oldDietType
    };
}

async function updateRecipes() {
    const recipes = collection(db, 'recipes');
    const snapshot = await getDocs(recipes);
    const batch = writeBatch(db);
    const updates = [];

    // First pass - analyze current data
    console.log('Current values:');
    const currentMealTypes = new Set();
    const currentDietTypes = new Set();

    snapshot.forEach(doc => {
        const data = doc.data();
        currentMealTypes.add(data.mealType);
        currentDietTypes.add(data.dietType);
    });

    console.log('\nCurrent meal types:', Array.from(currentMealTypes));
    console.log('Current diet types:', Array.from(currentDietTypes));

    // Second pass - plan updates
    snapshot.forEach(recipeDoc => {
        const data = recipeDoc.data();
        const { updates, hasChanges } = cleanupRecipeData(data);

        if (hasChanges) {
            updates.push({
                id: recipeDoc.id,
                title: data.title,
                oldValues: {
                    mealType: data.mealType,
                    dietType: data.dietType
                },
                newValues: updates
            });

            batch.update(doc(db, 'recipes', recipeDoc.id), updates);
        }
    });

    // Show proposed changes
    if (updates.length > 0) {
        console.log('\nProposed changes:');
        updates.forEach(update => {
            console.log(`\nRecipe: ${update.title}`);
            console.log('Old values:', update.oldValues);
            console.log('New values:', update.newValues);
        });

        console.log(`\nReady to update ${updates.length} recipes. Type 'yes' to continue:`);
        const response = await new Promise(resolve => {
            process.stdin.once('data', data => {
                resolve(data.toString().trim());
            });
        });

        if (response.toLowerCase() === 'yes') {
            await batch.commit();
            console.log('Updates completed successfully!');
        } else {
            console.log('Update cancelled.');
        }
    } else {
        console.log('\nNo updates needed.');
    }
}

updateRecipes().catch(console.error);
