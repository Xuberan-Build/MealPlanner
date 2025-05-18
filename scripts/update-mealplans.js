const admin = require('firebase-admin');
const path = require('path');

// Use your existing service account key
const serviceAccount = require('../private-secure/meal-planner-v1-9be19-firebase-adminsdk-lm22a-130574c970.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateMealPlans() {
  try {
    // Replace this with your actual Firebase Auth user ID
    // If you don't know it, you can leave it as is and the script will show all user IDs in the database
    const defaultUserId = 'YOUR_USER_ID'; // Replace this if known
    
    console.log('Connecting to Firestore...');
    
    // First, let's see if there are any users in the auth collection to use as default
    let userId = defaultUserId;
    try {
      const usersSnapshot = await db.collection('users').limit(1).get();
      if (!usersSnapshot.empty) {
        userId = usersSnapshot.docs[0].id;
        console.log(`Found a user ID to use: ${userId}`);
      }
    } catch (err) {
      console.log('No users collection found, using default ID');
    }
    
    // Get all meal plans
    console.log('Fetching meal plans...');
    const snapshot = await db.collection('mealPlans').get();
    
    if (snapshot.empty) {
      console.log('No meal plans found');
      return;
    }
    
    console.log(`Found ${snapshot.size} meal plans`);
    
    // Check which meal plans already have userId
    const plansWithUserId = [];
    const plansWithoutUserId = [];
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) {
        plansWithUserId.push({
          id: doc.id,
          userId: data.userId,
          name: data.name || 'Unnamed plan'
        });
      } else {
        plansWithoutUserId.push({
          id: doc.id,
          name: data.name || 'Unnamed plan'
        });
      }
    });
    
    console.log(`Plans with userId: ${plansWithUserId.length}`);
    console.log(`Plans without userId: ${plansWithoutUserId.length}`);
    
    // Print the plans that have userId to help identify your user ID
    if (plansWithUserId.length > 0) {
      console.log('\nExisting user IDs in meal plans:');
      const userIds = new Set();
      plansWithUserId.forEach(plan => {
        userIds.add(plan.userId);
      });
      
      userIds.forEach(id => {
        console.log(`User ID: ${id}`);
      });
    }
    
    // If no plans need updating, exit
    if (plansWithoutUserId.length === 0) {
      console.log('No meal plans need updating!');
      return;
    }
    
    // Confirm to proceed
    console.log(`\nReady to add userId: ${userId} to ${plansWithoutUserId.length} meal plans.`);
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question('Do you want to proceed? (yes/no): ', async (answer) => {
      readline.close();
      
      if (answer.toLowerCase() !== 'yes') {
        console.log('Operation cancelled');
        await admin.app().delete();
        return;
      }
      
      try {
        // Update each meal plan in batches
        console.log('Updating meal plans...');
        let updateCount = 0;
        
        // Firebase only allows 500 operations per batch
        const batchSize = 450;
        
        for (let i = 0; i < plansWithoutUserId.length; i += batchSize) {
          const batch = db.batch();
          
          const chunk = plansWithoutUserId.slice(i, i + batchSize);
          
          chunk.forEach(plan => {
            const ref = db.collection('mealPlans').doc(plan.id);
            batch.update(ref, { userId: userId });
            console.log(`Adding userId to meal plan: ${plan.id} (${plan.name})`);
            updateCount++;
          });
          
          // Commit the batch
          await batch.commit();
          console.log(`Batch committed: ${chunk.length} updates`);
        }
        
        console.log(`Successfully updated ${updateCount} meal plans with userId: ${userId}`);
      } catch (error) {
        console.error('Error updating meal plans:', error);
      } finally {
        // Clean up
        await admin.app().delete();
        console.log('Done!');
      }
    });
  } catch (error) {
    console.error('Error:', error);
    await admin.app().delete();
  }
}

// Run the function
updateMealPlans();
