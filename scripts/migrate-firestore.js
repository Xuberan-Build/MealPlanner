#!/usr/bin/env node

/**
 * Firestore Data Migration Script
 * Copies all collections from production to development environment
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize production Firebase Admin
const prodServiceAccount = require(path.join(__dirname, '../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json'));
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
  databaseURL: 'https://meal-planner-v1-9be19.firebaseio.com'
}, 'production');

// Initialize dev Firebase Admin
const devServiceAccount = require(path.join(__dirname, '../private-secure/meal-planner-dev-141e2-firebase-adminsdk-fbsvc-adb9e2d637.json'));
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
  databaseURL: 'https://meal-planner-dev-141e2.firebaseio.com'
}, 'development');

const prodDb = prodApp.firestore();
const devDb = devApp.firestore();

// Collections to migrate
const COLLECTIONS = [
  'dietTypes',
  'ingredients',
  'starterRecipes',
  'users',
  'recipes',
  'mealPlans',
  'shoppingLists',
  'shoppingListTemplates',
  'variations',
  'referrals',
  'userItemHistory',
  'userProductCache',
  'userProductPreferences',
  'productCache'
];

// Batch write limit
const BATCH_SIZE = 500;

// Collections with potentially large documents (write individually)
const LARGE_DOC_COLLECTIONS = ['productCache', 'userProductCache'];

/**
 * Copy a collection from production to dev
 */
async function copyCollection(collectionName) {
  console.log(`\n📦 Migrating collection: ${collectionName}`);

  try {
    const snapshot = await prodDb.collection(collectionName).get();

    if (snapshot.empty) {
      console.log(`   ⚠️  Collection is empty, skipping`);
      return { collection: collectionName, count: 0, success: true };
    }

    console.log(`   📊 Found ${snapshot.docs.length} documents`);

    // For collections with large documents, write individually
    if (LARGE_DOC_COLLECTIONS.includes(collectionName)) {
      let totalWritten = 0;
      for (const doc of snapshot.docs) {
        try {
          const docRef = devDb.collection(collectionName).doc(doc.id);
          await docRef.set(doc.data());
          totalWritten++;
          if (totalWritten % 10 === 0) {
            console.log(`   ✅ Written ${totalWritten}/${snapshot.docs.length} documents`);
          }
        } catch (docError) {
          console.log(`   ⚠️  Skipped document ${doc.id}: ${docError.message}`);
        }
      }
      console.log(`   ✅ Completed: ${totalWritten} documents migrated`);
      return { collection: collectionName, count: totalWritten, success: true };
    }

    // For normal collections, use batch writes
    let batch = devDb.batch();
    let batchCount = 0;
    let totalWritten = 0;

    for (const doc of snapshot.docs) {
      const docRef = devDb.collection(collectionName).doc(doc.id);
      batch.set(docRef, doc.data());
      batchCount++;

      // Commit batch when it reaches the limit
      if (batchCount >= BATCH_SIZE) {
        await batch.commit();
        totalWritten += batchCount;
        console.log(`   ✅ Written ${totalWritten}/${snapshot.docs.length} documents`);
        batch = devDb.batch();
        batchCount = 0;
      }
    }

    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      totalWritten += batchCount;
    }

    console.log(`   ✅ Completed: ${totalWritten} documents migrated`);
    return { collection: collectionName, count: totalWritten, success: true };

  } catch (error) {
    console.error(`   ❌ Error migrating ${collectionName}:`, error.message);
    return { collection: collectionName, count: 0, success: false, error: error.message };
  }
}

/**
 * Main migration function
 */
async function migrate() {
  console.log('🚀 Starting Firestore migration from Production to Development');
  console.log('📍 Source: meal-planner-v1-9be19 (production)');
  console.log('📍 Target: meal-planner-dev-141e2 (development)');
  console.log('⚠️  WARNING: This will overwrite existing data in development!');
  console.log('');

  const startTime = Date.now();
  const results = [];

  // Migrate each collection
  for (const collection of COLLECTIONS) {
    const result = await copyCollection(collection);
    results.push(result);
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary');
  console.log('='.repeat(60));

  let totalDocs = 0;
  let successCount = 0;
  let failCount = 0;

  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.collection.padEnd(25)} ${result.count} documents`);
    totalDocs += result.count;
    if (result.success) successCount++;
    else failCount++;
  });

  console.log('='.repeat(60));
  console.log(`✅ Successfully migrated: ${successCount}/${COLLECTIONS.length} collections`);
  console.log(`📝 Total documents copied: ${totalDocs}`);
  console.log(`⏱️  Duration: ${duration} seconds`);

  if (failCount > 0) {
    console.log(`\n⚠️  ${failCount} collection(s) failed to migrate`);
    process.exit(1);
  }

  console.log('\n🎉 Migration completed successfully!');
  process.exit(0);
}

// Run migration
migrate().catch(error => {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
});
