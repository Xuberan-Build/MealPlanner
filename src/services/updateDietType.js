// Use CommonJS to import Firebase and Firestore functions
const { db } = require('../firebase');  // Adjust path to Firebase config
const { collection, getDocs, updateDoc, doc } = require('firebase/firestore');  // Firestore functions

// Function to update the mealType and dietType fields
const updateDietAndMealTypeFields = async () => {
  try {
    const recipesCollection = collection(db, 'recipes');  // Access 'recipes' collection in Firestore
    const querySnapshot = await getDocs(recipesCollection);  // Get all recipe documents

    console.log(`Fetched ${querySnapshot.size} recipes from Firestore.`);  // Log number of documents

    querySnapshot.forEach(async (recipeDoc) => {
      const recipeData = recipeDoc.data();  // Get recipe data
      // Valid mealType values - must match MEAL_TYPES from src/constants/mealPlanner.js
      const mealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks', 'Desserts'];
      const recipeRef = doc(db, 'recipes', recipeDoc.id);  // Reference to the document

      console.log(`Processing recipe: ${recipeDoc.id}, mealType: ${recipeData.mealType}`);

      // Check if the current mealType is valid
      if (mealTypes.includes(recipeData.mealType)) {
        // If mealType is valid (Breakfast, Lunch, Dinner, or Snacks), keep it in mealType
        // Set dietType to 'Other' or another value if dietType is missing
        await updateDoc(recipeRef, {
          dietType: recipeData.dietType || 'Other',  // Default to 'Other' if dietType is missing
        });

        console.log(`Updated recipe ${recipeDoc.id} with valid mealType ${recipeData.mealType}.`);

      } else {
        // If mealType contains dietary information, move it to dietType and set mealType to 'Other'
        await updateDoc(recipeRef, {
          mealType: 'Other',  // Set mealType to 'Other' if it's not one of the valid meal types
          dietType: recipeData.mealType || 'Other',  // Move old mealType to dietType
        });

        console.log(`Updated recipe ${recipeDoc.id}: Moved mealType to dietType.`);
      }
    });

  } catch (error) {
    console.error("Error updating recipes: ", error);
  }
};

// Run the update function
updateDietAndMealTypeFields().catch(console.error);
