const admin = require('firebase-admin');
const serviceAccount = require('../scripts/meal-planner-v1-9be19-firebase-adminsdk-lm22a-0ff0ec2fdc.json');

// Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const DEFAULT_USER_ID = 'default-user-id'; // Replace with your actual user ID once you have one

async function updateCollection(collectionName) {
  console.log(`Processing collection: ${collectionName}`);
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`No documents found in ${collectionName}`);
    return;
  }
  
  console.log(`Found ${snapshot.size} documents in ${collectionName}`);
  
  // Process in batches of 450 (below Firestore's 500 limit)
  const batches = [];
  let batch = db.batch();
  let operationCount = 0;
  
  snapshot.forEach(doc => {
    // Check if document already has userId field
    const data = doc.data();
    if (data.userId) {
      console.log(`Document ${doc.id} already has userId: ${data.userId}`);
      return;
    }
    
    if (operationCount >= 450) {
      batches.push(batch);
      batch = db.batch();
      operationCount = 0;
    }
    
    const docRef = db.collection(collectionName).doc(doc.id);
    batch.update(docRef, { userId: DEFAULT_USER_ID });
    operationCount++;
  });
  
  // Add the last batch if it contains operations
  if (operationCount > 0) {
    batches.push(batch);
  }
  
  // Commit all batches
  console.log(`Committing ${batches.length} batches for ${collectionName}`);
  for (let i = 0; i < batches.length; i++) {
    await batches[i].commit();
    console.log(`Batch ${i + 1}/${batches.length} committed`);
  }
  
  console.log(`Updated ${operationCount} documents in ${collectionName}`);
}

async function updateAllCollections() {
  const collections = ['recipes', 'ingredients', 'mealPlans', 'sauces', 'variations'];
  
  try {
    for (const collection of collections) {
      await updateCollection(collection);
    }
    console.log('Migration complete!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    // Terminate the app
    process.exit(0);
  }
}

// Run the update
updateAllCollections();
