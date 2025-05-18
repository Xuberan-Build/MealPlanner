const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // You'll need to download this

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateMealPlans() {
  try {
    // Use a default userId for all meal plans
    // You can replace this with your actual userId
    const defaultUserId = 'your-user-id-here'; // Replace with your Firebase Auth user ID
    
    // Get all meal plans
    const snapshot = await db.collection('mealPlans').get();
    
    if (snapshot.empty) {
      console.log('No meal plans found');
      return;
    }
    
    console.log(`Found ${snapshot.size} meal plans to update`);
    
    // Update each meal plan
    const batch = db.batch();
    let updateCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      
      // Only update documents that don't have a userId
      if (!data.userId) {
        console.log(`Adding userId to meal plan: ${doc.id}`);
        batch.update(doc.ref, { userId: defaultUserId });
        updateCount++;
      }
    });
    
    // Commit the batch
    if (updateCount > 0) {
      await batch.commit();
      console.log(`Successfully updated ${updateCount} meal plans`);
    } else {
      console.log('No meal plans needed updating');
    }
  } catch (error) {
    console.error('Error updating meal plans:', error);
  } finally {
    // Clean up
    admin.app().delete();
  }
}

// Run the function
updateMealPlans();
