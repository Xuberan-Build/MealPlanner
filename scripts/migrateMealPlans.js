/ scripts/migrateMealPlans.js

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  getDocs, 
  updateDoc, 
  doc, 
  serverTimestamp 
} = require('firebase/firestore');

// Your Firebase configuration
// Replace these with your actual Firebase configuration values from .env file
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// The user ID to assign meal plans to
// Replace this with your actual user ID
const targetUserId = "YOUR_USER_ID_HERE";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/**
 * Migrates meal plans without a userId or with 'anonymous' userId to the specified user
 */
async function migrateMealPlansToUser() {
  try {
    console.log(`Starting meal plan migration to user: ${targetUserId}`);
    
    // Get all meal plans
    const mealPlansRef = collection(db, 'mealPlans');
    const allMealPlansSnapshot = await getDocs(mealPlansRef);
    
    const mealPlansToMigrate = [];
    
    allMealPlansSnapshot.forEach(doc => {
      const data = doc.data();
      // Check for missing userId or anonymous userId
      if (!data.userId || data.userId === 'anonymous') {
        mealPlansToMigrate.push({
          id: doc.id,
          ...data
        });
      }
    });
    
    if (mealPlansToMigrate.length === 0) {
      console.log("No meal plans found without a proper userId.");
      return;
    }
    
    console.log(`Found ${mealPlansToMigrate.length} meal plans to migrate.`);
    
    // Update each meal plan with the target userId
    let migrationCount = 0;
    for (const mealPlan of mealPlansToMigrate) {
      const mealPlanRef = doc(db, 'mealPlans', mealPlan.id);
      await updateDoc(mealPlanRef, {
        userId: targetUserId,
        migratedAt: serverTimestamp()
      });
      migrationCount++;
      console.log(`Migrated meal plan: ${mealPlan.name || 'Unnamed'} (${mealPlan.id})`);
    }
    
    console.log(`Successfully migrated ${migrationCount} meal plans to user: ${targetUserId}`);
  } catch (error) {
    console.error('Error during meal plan migration:', error);
  }
}

// Execute the migration
migrateMealPlansToUser().then(() => {
  console.log("Meal plan migration process completed.");
  process.exit(0);
}).catch(error => {
  console.error("Meal plan migration failed:", error);
  process.exit(1);
});