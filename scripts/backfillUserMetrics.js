#!/usr/bin/env node

/**
 * Backfill User Metrics Script
 *
 * This script calculates and updates user metrics for existing users
 * by counting their recipes, meal plans, and shopping lists.
 *
 * Usage: node scripts/backfillUserMetrics.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
// You'll need to set the path to your service account key
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT ||
  path.join(__dirname, '../serviceAccountKey.json');

try {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:');
  console.error('Please ensure you have a service account key file.');
  console.error('You can download it from Firebase Console > Project Settings > Service Accounts');
  console.error(`Expected location: ${serviceAccountPath}`);
  console.error('Or set FIREBASE_SERVICE_ACCOUNT environment variable');
  process.exit(1);
}

const db = admin.firestore();

// User IDs to backfill
const USER_IDS = [
  '1AXfHesQsTbXbQWuxzsKByCWynh2',
  '5V7fmyOADDR58xTGDjecE8iFX6N2',
  'JkHEWHcN2FU85jb3VGSlGBco9wC2',
  'NdzMA1et2jcVpvFiBuWyZdhe2g63',
  'UwU2UNYBnXX3knkd21j9DGkn9vG2',
  'bLSZjyUWkcdCLgYADEB6pJfuujo1',
  'fAKGGk1nOUdnUsHde8YOq5xbwsm2',
  'q1977GkdlFZSPUgYBqVQZeSePgE3'
];

/**
 * Default metrics structure
 */
const DEFAULT_METRICS = {
  // Recipe tracking
  totalRecipesAdded: 0,
  totalRecipesViewed: 0,
  favoriteRecipes: [],

  // Meal plan tracking
  totalMealPlansCreated: 0,
  totalMealPlansCompleted: 0,
  lastMealPlanDate: null,

  // Shopping list tracking
  totalShoppingListsGenerated: 0,
  lastShoppingListDate: null,

  // Feature usage tracking
  featureUsage: {
    recipeBook: 0,
    mealPlanner: 0,
    shoppingList: 0,
    profile: 0
  },

  // Engagement metrics
  lastActiveDate: null,
  accountCreatedDate: null,
  totalSessions: 0
};

/**
 * Count documents in a collection for a specific user
 */
async function countUserDocuments(collectionName, userId) {
  try {
    const snapshot = await db.collection(collectionName)
      .where('userId', '==', userId)
      .get();
    return snapshot.size;
  } catch (error) {
    console.error(`Error counting ${collectionName} for user ${userId}:`, error.message);
    return 0;
  }
}

/**
 * Get the most recent document date for a collection
 */
async function getMostRecentDate(collectionName, userId, dateField = 'createdAt') {
  try {
    const snapshot = await db.collection(collectionName)
      .where('userId', '==', userId)
      .orderBy(dateField, 'desc')
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const date = doc.data()[dateField];

    // Handle both Timestamp and string dates
    if (date && date.toDate) {
      return date;
    } else if (date) {
      return admin.firestore.Timestamp.fromDate(new Date(date));
    }

    return null;
  } catch (error) {
    console.error(`Error getting most recent ${collectionName} date for user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Backfill metrics for a single user
 */
async function backfillUserMetrics(userId) {
  console.log(`\n📊 Processing user: ${userId}`);

  try {
    // Check if user document exists
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log(`⚠️  User document not found: ${userId}`);
      console.log(`   Creating user document with metrics...`);
      // Create user document with default metrics
      await userRef.set({
        metrics: {
          ...DEFAULT_METRICS,
          accountCreatedDate: admin.firestore.FieldValue.serverTimestamp()
        }
      });
    }

    // Count recipes
    const recipesCount = await countUserDocuments('recipes', userId);
    console.log(`   📖 Recipes: ${recipesCount}`);

    // Count meal plans
    const mealPlansCount = await countUserDocuments('mealPlans', userId);
    console.log(`   🍽️  Meal Plans: ${mealPlansCount}`);

    // Count shopping lists (only active ones)
    const shoppingListsSnapshot = await db.collection('shoppingLists')
      .where('userId', '==', userId)
      .where('isActive', '==', true)
      .get();
    const shoppingListsCount = shoppingListsSnapshot.size;
    console.log(`   🛒 Shopping Lists: ${shoppingListsCount}`);

    // Get most recent dates
    const lastMealPlanDate = await getMostRecentDate('mealPlans', userId, 'savedAt');
    const lastShoppingListDate = await getMostRecentDate('shoppingLists', userId, 'createdAt');

    // Get existing user data to preserve any existing metrics
    const userData = userDoc.exists ? userDoc.data() : {};
    const existingMetrics = userData.metrics || {};

    // Build updated metrics object, preserving existing values where appropriate
    const updatedMetrics = {
      ...DEFAULT_METRICS,
      ...existingMetrics,
      // Update counted values
      totalRecipesAdded: recipesCount,
      totalMealPlansCreated: mealPlansCount,
      totalShoppingListsGenerated: shoppingListsCount,
      // Update dates if we found them
      lastMealPlanDate: lastMealPlanDate || existingMetrics.lastMealPlanDate || null,
      lastShoppingListDate: lastShoppingListDate || existingMetrics.lastShoppingListDate || null,
      // Set account created date if not already set
      accountCreatedDate: existingMetrics.accountCreatedDate || admin.firestore.FieldValue.serverTimestamp(),
      // Preserve existing feature usage
      featureUsage: {
        ...DEFAULT_METRICS.featureUsage,
        ...(existingMetrics.featureUsage || {})
      },
      // Preserve favorite recipes
      favoriteRecipes: existingMetrics.favoriteRecipes || []
    };

    // Update user document with metrics
    await userRef.update({
      metrics: updatedMetrics
    });

    console.log(`   ✅ Metrics updated successfully`);

    return {
      userId,
      success: true,
      metrics: {
        recipes: recipesCount,
        mealPlans: mealPlansCount,
        shoppingLists: shoppingListsCount
      }
    };
  } catch (error) {
    console.error(`   ❌ Error processing user ${userId}:`, error.message);
    return {
      userId,
      success: false,
      error: error.message
    };
  }
}

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Starting user metrics backfill...');
  console.log(`📝 Processing ${USER_IDS.length} users\n`);

  const results = [];

  // Process each user
  for (const userId of USER_IDS) {
    const result = await backfillUserMetrics(userId);
    results.push(result);
  }

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📈 BACKFILL SUMMARY');
  console.log('='.repeat(60));

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(`\n✅ Successful: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);

  if (successful.length > 0) {
    console.log('\n📊 Metrics by User:');
    successful.forEach(result => {
      console.log(`\n   User: ${result.userId}`);
      console.log(`   - Recipes: ${result.metrics.recipes}`);
      console.log(`   - Meal Plans: ${result.metrics.mealPlans}`);
      console.log(`   - Shopping Lists: ${result.metrics.shoppingLists}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed Users:');
    failed.forEach(result => {
      console.log(`   - ${result.userId}: ${result.error}`);
    });
  }

  console.log('\n✨ Backfill complete!\n');
}

// Run the script
main()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
