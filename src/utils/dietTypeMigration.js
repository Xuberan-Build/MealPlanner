import {
  collection,
  doc,
  getDocs,
  writeBatch,
  query,
  where,
  limit,
  orderBy,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Migration utilities for converting old diet type system to new architecture
 *
 * Old System:
 * - Default diet types hardcoded in service
 * - Custom diet types stored in users/{userId}.customDietTypes array
 * - Recipes have single dietType string field
 *
 * New System:
 * - All diet types in globalDietTypes collection
 * - System diet types have createdBy: 'system'
 * - Custom diet types have createdBy: userId
 * - Recipes have dietTypes array field (with backward compatible dietType string)
 * - User preferences in users/{userId}/dietTypePreferences subcollection
 */

/**
 * System diet types that should be created
 */
const SYSTEM_DIET_TYPES = [
  'Vegetarian',
  'Vegan',
  'Keto',
  'Paleo',
  'Low-Carb',
  'Gluten-Free',
  'Dairy-Free',
  'Nut-Free',
  'Halal',
  'Kosher'
];

/**
 * Step 1: Initialize system diet types in globalDietTypes collection
 *
 * @returns {Promise<Object>} Migration result
 */
export async function initializeSystemDietTypes() {
  console.log('Starting system diet types initialization...');

  try {
    const batch = writeBatch(db);
    const results = {
      created: 0,
      skipped: 0,
      errors: []
    };

    for (const dietTypeName of SYSTEM_DIET_TYPES) {
      try {
        // Check if it already exists
        const q = query(
          collection(db, 'globalDietTypes'),
          where('name', '==', dietTypeName),
          limit(1)
        );
        const existingDocs = await getDocs(q);

        if (!existingDocs.empty) {
          console.log(`System diet type "${dietTypeName}" already exists, skipping...`);
          results.skipped++;
          continue;
        }

        // Create new system diet type
        const dietTypeRef = doc(collection(db, 'globalDietTypes'));
        batch.set(dietTypeRef, {
          name: dietTypeName,
          description: `System diet type: ${dietTypeName}`,
          createdBy: 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isArchived: false,
          recipeCount: 0,
          metadata: {
            isSystemType: true,
            version: 1
          }
        });

        results.created++;
      } catch (err) {
        console.error(`Error processing "${dietTypeName}":`, err);
        results.errors.push({ dietType: dietTypeName, error: err.message });
      }
    }

    // Commit batch
    if (results.created > 0) {
      await batch.commit();
      console.log(`Created ${results.created} system diet types`);
    }

    return results;
  } catch (error) {
    console.error('Error initializing system diet types:', error);
    throw error;
  }
}

/**
 * Step 2: Migrate custom diet types from users collection to globalDietTypes
 *
 * @param {number} batchSize - Number of users to process per batch (default: 100)
 * @returns {Promise<Object>} Migration result
 */
export async function migrateCustomDietTypes(batchSize = 100) {
  console.log('Starting custom diet types migration...');

  try {
    const results = {
      usersProcessed: 0,
      dietTypesCreated: 0,
      dietTypesSkipped: 0,
      errors: []
    };

    // Get all users with customDietTypes
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);

    // Track global diet types to avoid duplicates
    const globalDietTypeNames = new Set();

    // Get existing global diet types
    const existingDietTypesSnapshot = await getDocs(collection(db, 'globalDietTypes'));
    existingDietTypesSnapshot.forEach(doc => {
      const data = doc.data();
      globalDietTypeNames.add(data.name.toLowerCase());
    });

    let batch = writeBatch(db);
    let operationCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const customDietTypes = userData.customDietTypes || [];

        if (customDietTypes.length === 0) {
          continue;
        }

        results.usersProcessed++;

        for (const dietTypeName of customDietTypes) {
          const normalizedName = dietTypeName.toLowerCase();

          // Skip if already exists globally
          if (globalDietTypeNames.has(normalizedName)) {
            results.dietTypesSkipped++;
            continue;
          }

          // Create new global diet type
          const dietTypeRef = doc(collection(db, 'globalDietTypes'));
          batch.set(dietTypeRef, {
            name: dietTypeName,
            description: `Custom diet type created by user`,
            createdBy: userDoc.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isArchived: false,
            recipeCount: 0,
            metadata: {
              migratedFrom: 'users.customDietTypes',
              version: 1
            }
          });

          globalDietTypeNames.add(normalizedName);
          results.dietTypesCreated++;
          operationCount++;

          // Commit batch if limit reached
          if (operationCount >= batchSize) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
            console.log(`Migrated ${results.dietTypesCreated} custom diet types so far...`);
          }
        }
      } catch (err) {
        console.error(`Error processing user ${userDoc.id}:`, err);
        results.errors.push({ userId: userDoc.id, error: err.message });
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Migration complete: ${results.dietTypesCreated} custom diet types created`);
    return results;
  } catch (error) {
    console.error('Error migrating custom diet types:', error);
    throw error;
  }
}

/**
 * Step 3: Migrate recipe dietType (string) to dietTypes (array)
 *
 * @param {number} batchSize - Number of recipes to process per batch (default: 100)
 * @returns {Promise<Object>} Migration result
 */
export async function migrateRecipeDietTypes(batchSize = 100) {
  console.log('Starting recipe diet types migration...');

  try {
    const results = {
      recipesProcessed: 0,
      recipesUpdated: 0,
      recipesSkipped: 0,
      errors: []
    };

    // Get all recipes
    const recipesRef = collection(db, 'recipes');
    const recipesSnapshot = await getDocs(recipesRef);

    let batch = writeBatch(db);
    let operationCount = 0;

    for (const recipeDoc of recipesSnapshot.docs) {
      try {
        const recipeData = recipeDoc.data();
        results.recipesProcessed++;

        // Skip if already has dietTypes array
        if (recipeData.dietTypes && Array.isArray(recipeData.dietTypes)) {
          results.recipesSkipped++;
          continue;
        }

        // Get the single dietType value
        const singleDietType = recipeData.dietType;

        // Update recipe with dietTypes array
        const updates = {
          updatedAt: new Date().toISOString()
        };

        if (singleDietType && singleDietType.trim()) {
          // Add dietTypes array while keeping legacy dietType
          updates.dietTypes = [singleDietType.trim()];
        } else {
          // No diet type, set empty array
          updates.dietTypes = [];
        }

        batch.update(doc(db, 'recipes', recipeDoc.id), updates);

        results.recipesUpdated++;
        operationCount++;

        // Commit batch if limit reached
        if (operationCount >= batchSize) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
          console.log(`Migrated ${results.recipesUpdated} recipes so far...`);
        }
      } catch (err) {
        console.error(`Error processing recipe ${recipeDoc.id}:`, err);
        results.errors.push({ recipeId: recipeDoc.id, error: err.message });
      }
    }

    // Commit remaining operations
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log(`Migration complete: ${results.recipesUpdated} recipes updated`);
    return results;
  } catch (error) {
    console.error('Error migrating recipe diet types:', error);
    throw error;
  }
}

/**
 * Step 4: Update recipe counts for all diet types
 *
 * @returns {Promise<Object>} Migration result
 */
export async function updateDietTypeRecipeCounts() {
  console.log('Updating diet type recipe counts...');

  try {
    const results = {
      dietTypesProcessed: 0,
      countsUpdated: 0,
      errors: []
    };

    // Get all diet types
    const dietTypesSnapshot = await getDocs(collection(db, 'globalDietTypes'));

    // Get all recipes
    const recipesSnapshot = await getDocs(collection(db, 'recipes'));
    const recipes = recipesSnapshot.docs.map(doc => doc.data());

    // Count recipes for each diet type
    const batch = writeBatch(db);

    for (const dietTypeDoc of dietTypesSnapshot.docs) {
      try {
        const dietTypeName = dietTypeDoc.data().name;
        results.dietTypesProcessed++;

        // Count recipes with this diet type (check both array and legacy field)
        const count = recipes.filter(recipe => {
          const hasDietType = recipe.dietTypes?.includes(dietTypeName);
          const hasLegacyDietType = recipe.dietType === dietTypeName;
          return hasDietType || hasLegacyDietType;
        }).length;

        // Update count
        batch.update(doc(db, 'globalDietTypes', dietTypeDoc.id), {
          recipeCount: count,
          updatedAt: new Date().toISOString()
        });

        results.countsUpdated++;
      } catch (err) {
        console.error(`Error processing diet type ${dietTypeDoc.id}:`, err);
        results.errors.push({ dietTypeId: dietTypeDoc.id, error: err.message });
      }
    }

    // Commit batch
    if (results.countsUpdated > 0) {
      await batch.commit();
    }

    console.log(`Updated counts for ${results.countsUpdated} diet types`);
    return results;
  } catch (error) {
    console.error('Error updating diet type counts:', error);
    throw error;
  }
}

/**
 * Run complete migration in order
 *
 * @param {Object} options - Migration options
 * @param {boolean} options.skipSystemTypes - Skip system types initialization (default: false)
 * @param {boolean} options.skipCustomTypes - Skip custom types migration (default: false)
 * @param {boolean} options.skipRecipes - Skip recipe migration (default: false)
 * @param {boolean} options.skipCounts - Skip count updates (default: false)
 * @param {number} options.batchSize - Batch size for operations (default: 100)
 * @returns {Promise<Object>} Complete migration result
 */
export async function runCompleteMigration(options = {}) {
  const {
    skipSystemTypes = false,
    skipCustomTypes = false,
    skipRecipes = false,
    skipCounts = false,
    batchSize = 100
  } = options;

  console.log('Starting complete diet type migration...');
  console.log('Options:', options);

  const results = {
    startTime: new Date().toISOString(),
    steps: {},
    totalTime: 0,
    success: false
  };

  try {
    const startTime = Date.now();

    // Step 1: Initialize system diet types
    if (!skipSystemTypes) {
      console.log('\n--- Step 1: Initialize System Diet Types ---');
      results.steps.systemTypes = await initializeSystemDietTypes();
    }

    // Step 2: Migrate custom diet types
    if (!skipCustomTypes) {
      console.log('\n--- Step 2: Migrate Custom Diet Types ---');
      results.steps.customTypes = await migrateCustomDietTypes(batchSize);
    }

    // Step 3: Migrate recipe diet types
    if (!skipRecipes) {
      console.log('\n--- Step 3: Migrate Recipe Diet Types ---');
      results.steps.recipes = await migrateRecipeDietTypes(batchSize);
    }

    // Step 4: Update recipe counts
    if (!skipCounts) {
      console.log('\n--- Step 4: Update Recipe Counts ---');
      results.steps.counts = await updateDietTypeRecipeCounts();
    }

    results.totalTime = Date.now() - startTime;
    results.endTime = new Date().toISOString();
    results.success = true;

    console.log('\n=== Migration Complete ===');
    console.log(`Total time: ${(results.totalTime / 1000).toFixed(2)}s`);
    console.log('Results:', JSON.stringify(results, null, 2));

    return results;
  } catch (error) {
    console.error('\n=== Migration Failed ===');
    console.error('Error:', error);
    results.error = error.message;
    results.success = false;
    return results;
  }
}

/**
 * Verify migration completed successfully
 *
 * @returns {Promise<Object>} Verification result
 */
export async function verifyMigration() {
  console.log('Verifying migration...');

  const verification = {
    systemDietTypes: 0,
    customDietTypes: 0,
    totalDietTypes: 0,
    recipesWithArray: 0,
    recipesWithLegacy: 0,
    totalRecipes: 0,
    issues: []
  };

  try {
    // Check diet types
    const dietTypesSnapshot = await getDocs(collection(db, 'globalDietTypes'));
    verification.totalDietTypes = dietTypesSnapshot.size;

    dietTypesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.createdBy === 'system') {
        verification.systemDietTypes++;
      } else {
        verification.customDietTypes++;
      }
    });

    // Check recipes
    const recipesSnapshot = await getDocs(collection(db, 'recipes'));
    verification.totalRecipes = recipesSnapshot.size;

    recipesSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.dietTypes && Array.isArray(data.dietTypes)) {
        verification.recipesWithArray++;
      }
      if (data.dietType) {
        verification.recipesWithLegacy++;
      }
    });

    // Check for issues
    if (verification.systemDietTypes !== SYSTEM_DIET_TYPES.length) {
      verification.issues.push(
        `Expected ${SYSTEM_DIET_TYPES.length} system diet types, found ${verification.systemDietTypes}`
      );
    }

    if (verification.recipesWithArray !== verification.totalRecipes) {
      verification.issues.push(
        `Not all recipes have dietTypes array: ${verification.recipesWithArray}/${verification.totalRecipes}`
      );
    }

    console.log('Verification complete:', verification);
    return verification;
  } catch (error) {
    console.error('Error verifying migration:', error);
    verification.error = error.message;
    return verification;
  }
}

/**
 * Rollback migration (use with caution!)
 *
 * WARNING: This will delete all globalDietTypes and remove dietTypes arrays from recipes
 *
 * @param {boolean} confirm - Must be true to execute
 * @returns {Promise<Object>} Rollback result
 */
export async function rollbackMigration(confirm = false) {
  if (!confirm) {
    throw new Error('Rollback requires explicit confirmation (pass confirm: true)');
  }

  console.log('WARNING: Starting migration rollback...');

  const results = {
    dietTypesDeleted: 0,
    recipesReverted: 0,
    errors: []
  };

  try {
    // Delete all global diet types
    const dietTypesSnapshot = await getDocs(collection(db, 'globalDietTypes'));
    let batch = writeBatch(db);
    let count = 0;

    for (const dietTypeDoc of dietTypesSnapshot.docs) {
      batch.delete(doc(db, 'globalDietTypes', dietTypeDoc.id));
      count++;

      if (count >= 100) {
        await batch.commit();
        results.dietTypesDeleted += count;
        batch = writeBatch(db);
        count = 0;
      }
    }

    if (count > 0) {
      await batch.commit();
      results.dietTypesDeleted += count;
    }

    // Remove dietTypes arrays from recipes
    const recipesSnapshot = await getDocs(collection(db, 'recipes'));
    batch = writeBatch(db);
    count = 0;

    for (const recipeDoc of recipesSnapshot.docs) {
      const recipeData = recipeDoc.data();

      if (recipeData.dietTypes) {
        batch.update(doc(db, 'recipes', recipeDoc.id), {
          dietTypes: null
        });
        count++;

        if (count >= 100) {
          await batch.commit();
          results.recipesReverted += count;
          batch = writeBatch(db);
          count = 0;
        }
      }
    }

    if (count > 0) {
      await batch.commit();
      results.recipesReverted += count;
    }

    console.log('Rollback complete:', results);
    return results;
  } catch (error) {
    console.error('Error during rollback:', error);
    throw error;
  }
}

export default {
  initializeSystemDietTypes,
  migrateCustomDietTypes,
  migrateRecipeDietTypes,
  updateDietTypeRecipeCounts,
  runCompleteMigration,
  verifyMigration,
  rollbackMigration
};
