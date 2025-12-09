#!/usr/bin/env node

/**
 * Check User Data Across Environments
 *
 * This script checks what data exists for a user in both dev and prod environments
 */

const admin = require('firebase-admin');

// User email to check
const USER_EMAIL = 'santos.93.aus@gmail.com';

async function checkEnvironment(envName, serviceAccountPath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Checking ${envName.toUpperCase()} Environment`);
  console.log('='.repeat(60));

  try {
    const serviceAccount = require(serviceAccountPath);

    // Create a separate app instance for this environment
    const app = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    }, envName);

    const db = app.firestore();
    const auth = app.auth();

    // Find user by email
    let userId = null;
    try {
      const userRecord = await auth.getUserByEmail(USER_EMAIL);
      userId = userRecord.uid;
      console.log(`✓ User found: ${userId}`);
      console.log(`  Email: ${userRecord.email}`);
      console.log(`  Created: ${new Date(userRecord.metadata.creationTime).toLocaleString()}`);
      console.log(`  Last Sign In: ${new Date(userRecord.metadata.lastSignInTime).toLocaleString()}`);
    } catch (error) {
      console.log(`✗ User not found in auth`);
      await app.delete();
      return null;
    }

    // Check recipes
    const recipesSnapshot = await db.collection('recipes')
      .where('userId', '==', userId)
      .get();
    console.log(`\n📚 Recipes: ${recipesSnapshot.size}`);
    if (recipesSnapshot.size > 0 && recipesSnapshot.size <= 20) {
      recipesSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`  - ${data.title || 'Untitled'} (${doc.id})`);
      });
    }

    // Check meal plans
    const mealPlansSnapshot = await db.collection('mealPlans')
      .where('userId', '==', userId)
      .get();
    console.log(`\n📅 Meal Plans: ${mealPlansSnapshot.size}`);

    // Check shopping lists
    const shoppingListsSnapshot = await db.collection('shoppingLists')
      .where('userId', '==', userId)
      .get();
    console.log(`\n🛒 Shopping Lists: ${shoppingListsSnapshot.size}`);

    // Check user preferences
    const userPrefsSnapshot = await db.collection('userProductPreferences')
      .where('userId', '==', userId)
      .get();
    console.log(`\n⚙️  Product Preferences: ${userPrefsSnapshot.size}`);

    // Cleanup
    await app.delete();

    return {
      userId,
      recipes: recipesSnapshot.size,
      mealPlans: mealPlansSnapshot.size,
      shoppingLists: shoppingListsSnapshot.size,
      preferences: userPrefsSnapshot.size
    };

  } catch (error) {
    console.error(`Error checking ${envName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log(`Checking data for: ${USER_EMAIL}\n`);

  const devData = await checkEnvironment(
    'dev',
    '../private-secure/meal-planner-dev-141e2-firebase-adminsdk-fbsvc-adb9e2d637.json'
  );

  const prodData = await checkEnvironment(
    'prod',
    '../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json'
  );

  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));

  if (devData) {
    console.log(`\nDEV Environment:`);
    console.log(`  Recipes: ${devData.recipes}`);
    console.log(`  Meal Plans: ${devData.mealPlans}`);
    console.log(`  Shopping Lists: ${devData.shoppingLists}`);
    console.log(`  Preferences: ${devData.preferences}`);
  } else {
    console.log(`\nDEV: No data found`);
  }

  if (prodData) {
    console.log(`\nPROD Environment:`);
    console.log(`  Recipes: ${prodData.recipes}`);
    console.log(`  Meal Plans: ${prodData.mealPlans}`);
    console.log(`  Shopping Lists: ${prodData.shoppingLists}`);
    console.log(`  Preferences: ${prodData.preferences}`);
  } else {
    console.log(`\nPROD: No data found`);
  }

  console.log('\n');
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Script failed:', err);
    process.exit(1);
  });
