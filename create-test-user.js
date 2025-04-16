const admin = require('firebase-admin');
const serviceAccount = require('./scripts/meal-planner-v1-9be19-firebase-adminsdk-lm22a-0ff0ec2fdc.json');

// Initialize Firebase Admin with your service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestUser() {
  try {
    // Create a test user document
    const testUser = {
      uid: 'test-user-id',
      email: 'test@example.com',
      displayName: 'Test User',
      dietaryPreferences: ['Vegetarian'],
      allergies: ['Nuts'],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('users').doc(testUser.uid).set(testUser);
    console.log('Test user created successfully!');
  } catch (error) {
    console.error('Error creating test user:', error);
  } finally {
    process.exit(0);
  }
}

createTestUser();
