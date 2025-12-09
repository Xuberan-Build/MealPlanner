#!/usr/bin/env node

/**
 * Cleanup Script: Remove Partial Diet Types
 *
 * This script removes partial/invalid diet types from user accounts
 * Run with: node scripts/cleanup-diet-types.js
 */

const admin = require('firebase-admin');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Initialize Firebase Admin
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// List of partial diet types to remove (single characters or obviously incomplete)
const partialDietTypes = [
  'p', 'pu', 'Pue', 'Puer', 'Puert', 'Puerto',
  'm', 'me', 'med', 'medi', 'medit', 'mediter', 'mediterr', 'mediterra', 'mediterran',
  'i', 'it', 'ita', 'ital', 'itali', 'italia',
  'k', 'ke', 'ket',
  'v', 've', 'veg', 'vega',
  // Add any other partial types you see
];

// Keep only these valid diet types
const validDietTypes = [
  'Puerto Rican',
  'mediterranean',
  'Italian',
  'Keto',
  'Vegan',
  'Vegetarian',
  'Paleo',
  'Low-Carb',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher'
];

async function cleanupDietTypes(userId) {
  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log('❌ User document not found');
      return;
    }

    const userData = userDoc.data();
    const customDietTypes = userData.customDietTypes || [];

    console.log('\n📋 Current custom diet types:', customDietTypes);

    // Filter out partial/invalid types
    const cleanedDietTypes = customDietTypes.filter(type => {
      // Remove if it's in the partial list
      if (partialDietTypes.includes(type)) {
        console.log(`  🗑️  Removing partial: "${type}"`);
        return false;
      }

      // Remove if it's very short (likely incomplete)
      if (type.length <= 2) {
        console.log(`  🗑️  Removing too short: "${type}"`);
        return false;
      }

      // Keep it
      console.log(`  ✅ Keeping: "${type}"`);
      return true;
    });

    // Remove duplicates and sort
    const uniqueCleanedTypes = [...new Set(cleanedDietTypes)].sort();

    console.log('\n📋 Cleaned diet types:', uniqueCleanedTypes);
    console.log(`\nRemoved ${customDietTypes.length - uniqueCleanedTypes.length} invalid diet types`);

    // Ask for confirmation
    const answer = await new Promise((resolve) => {
      rl.question('\n⚠️  Do you want to save these changes? (yes/no): ', (answer) => {
        resolve(answer.toLowerCase());
      });
    });

    if (answer === 'yes') {
      await userRef.update({
        customDietTypes: uniqueCleanedTypes
      });
      console.log('\n✅ Diet types cleaned up successfully!');
    } else {
      console.log('\n❌ Changes cancelled');
    }

  } catch (error) {
    console.error('❌ Error cleaning up diet types:', error);
  } finally {
    rl.close();
    process.exit(0);
  }
}

// Get user ID from command line or prompt
async function main() {
  console.log('🧹 Diet Type Cleanup Script');
  console.log('=' .repeat(50));

  const userId = process.argv[2];

  if (userId) {
    console.log(`\nCleaning diet types for user: ${userId}\n`);
    await cleanupDietTypes(userId);
  } else {
    rl.question('\nEnter your User ID: ', async (inputUserId) => {
      await cleanupDietTypes(inputUserId.trim());
    });
  }
}

main();
