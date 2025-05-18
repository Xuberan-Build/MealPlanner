const admin = require('firebase-admin');
const serviceAccount = require('../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Your user ID
const YOUR_USER_ID = "bLSZjyUWkcdCLgYADEB6pJfuujo1"; 

async function migrateDefaultUserRecipes() {
  console.log("Starting migration of 'default-user-id' recipes...");
  
  try {
    // Get all recipes with userId 'default-user-id'
    const recipesQuery = await db.collection('recipes')
      .where('userId', '==', 'default-user-id')
      .get();
    
    if (recipesQuery.empty) {
      console.log("No recipes found with userId 'default-user-id'.");
      return;
    }
    
    const recipesToMigrate = [];
    recipesQuery.forEach(doc => {
      const data = doc.data();
      recipesToMigrate.push({
        id: doc.id,
        title: data.title || 'Unnamed Recipe'
      });
    });
    
    console.log(`Found ${recipesToMigrate.length} recipes with userId 'default-user-id':`);
    recipesToMigrate.forEach(recipe => {
      console.log(`- ${recipe.title} (${recipe.id})`);
    });
    
    // Update each recipe
    console.log("\nMigrating recipes...");
    let migratedCount = 0;
    
    for (const recipe of recipesToMigrate) {
      await db.collection('recipes').doc(recipe.id).update({
        userId: YOUR_USER_ID,
        previousUserId: 'default-user-id', // Store the previous userId
        migratedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      migratedCount++;
      console.log(`Migrated ${migratedCount}/${recipesToMigrate.length}: ${recipe.title}`);
    }
    
    console.log(`\nSuccessfully migrated ${migratedCount} recipes from 'default-user-id' to your user ID: ${YOUR_USER_ID}`);
    
  } catch (error) {
    console.error("Error during migration:", error);
  }
}

// Run the migration
migrateDefaultUserRecipes()
  .then(() => {
    console.log("Migration complete!");
    process.exit(0);
  })
  .catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
  });