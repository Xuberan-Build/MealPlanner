const admin = require('firebase-admin');
const serviceAccount = require('../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Replace with your user ID after you find it
const YOUR_USER_ID = "bLSZjyUWkcdCLgYADEB6pJfuujo1"; 

async function migrateRecipes() {
  console.log("Starting recipe migration...");
  
  try {
    // First, print the current user ID from auth
    // We'll need this data for the next step
    console.log("Getting existing users...");
    const usersSnapshot = await db.collection('users').get();
    console.log("Users in database:");
    usersSnapshot.forEach(doc => {
      console.log(`User ID: ${doc.id}, Email: ${doc.data().email || 'No email'}`);
    });
    
    console.log("\nPress Ctrl+C now and edit this file to set YOUR_USER_ID to your user ID from above");
    console.log("Then run this script again");
    
    // Only proceed if the user has set the ID
    if (YOUR_USER_ID === "REPLACE_WITH_YOUR_USER_ID") {
      console.log("Please update the YOUR_USER_ID variable with your actual user ID");
      return;
    }
    
    // Get all recipes without a userId
    console.log("\nFinding recipes without user ID...");
    const recipesSnapshot = await db.collection('recipes').get();
    
    const recipesToMigrate = [];
    recipesSnapshot.forEach(doc => {
      const data = doc.data();
      if (!data.userId) {
        recipesToMigrate.push({
          id: doc.id,
          title: data.title || 'Unnamed Recipe'
        });
      }
    });
    
    console.log(`Found ${recipesToMigrate.length} recipes to migrate:`);
    recipesToMigrate.forEach(recipe => {
      console.log(`- ${recipe.title} (${recipe.id})`);
    });
    
    // Update each recipe
    console.log("\nMigrating recipes...");
    let migratedCount = 0;
    
    for (const recipe of recipesToMigrate) {
      await db.collection('recipes').doc(recipe.id).update({
        userId: YOUR_USER_ID,
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      migratedCount++;
      console.log(`Migrated ${migratedCount}/${recipesToMigrate.length}: ${recipe.title}`);
    }
    
    console.log(`\nSuccessfully migrated ${migratedCount} recipes to user: ${YOUR_USER_ID}`);
    
  } catch (error) {
    console.error("Error during migration:", error);
  }
}

// Run the migration
migrateRecipes()
  .then(() => {
    console.log("Migration complete!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });