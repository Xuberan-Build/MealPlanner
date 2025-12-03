#!/usr/bin/env node

const admin = require('firebase-admin');
const path = require('path');

const prodServiceAccount = require(path.join(__dirname, '../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json'));
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
  databaseURL: 'https://meal-planner-v1-9be19.firebaseio.com'
}, 'production');

const devServiceAccount = require(path.join(__dirname, '../private-secure/meal-planner-dev-141e2-firebase-adminsdk-fbsvc-adb9e2d637.json'));
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
  databaseURL: 'https://meal-planner-dev-141e2.firebaseio.com'
}, 'development');

const prodDb = prodApp.firestore();
const devDb = devApp.firestore();

async function copyProductCache() {
  console.log('📦 Migrating productCache collection...');
  const snapshot = await prodDb.collection('productCache').get();
  console.log(`📊 Found ${snapshot.docs.length} documents`);

  let count = 0;
  for (const doc of snapshot.docs) {
    try {
      await devDb.collection('productCache').doc(doc.id).set(doc.data());
      count++;
      if (count % 10 === 0) {
        console.log(`   ✅ Written ${count}/${snapshot.docs.length} documents`);
      }
    } catch (e) {
      console.log(`   ⚠️ Skipped ${doc.id}: ${e.message}`);
    }
  }
  console.log(`✅ Completed: ${count} documents migrated`);
  process.exit(0);
}

copyProductCache().catch(e => {
  console.error('❌ Error:', e);
  process.exit(1);
});
