const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Path to your Firebase service account key file
const serviceAccount = require('/Users/Worker/Apps/mealv-2/scripts/meal-planner-v1-9be19-firebase-adminsdk-lm22a-0ff0ec2fdc.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const recipesCollectionRef = db.collection('recipes');

const exportRecipesToJSON = async () => {
  try {
    console.log('Starting export...');

    const snapshot = await recipesCollectionRef.get();
    const recipes = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    // Define the output file path
    const outputPath = path.join(__dirname, 'recipes_export.json');

    // Write the data to a JSON file with pretty-print (2 spaces indentation)
    fs.writeFileSync(outputPath, JSON.stringify(recipes, null, 2));
    console.log(`Data exported successfully to ${outputPath}`);
  } catch (error) {
    console.error('Error exporting recipes:', error);
  }
};

// Run the export function
exportRecipesToJSON();
