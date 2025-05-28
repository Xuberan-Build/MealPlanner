import { db, auth } from '../firebase'; // Your Firebase config
import { collection, addDoc, getDocs, deleteDoc, doc, query, where } from 'firebase/firestore';

/**
 * Save a meal plan to Firestore.
 * @param {string} planName - The name of the meal plan.
 * @param {object} mealPlan - The meal plan data (object of meals).
 * @returns {Promise<string>} - The document ID of the saved meal plan.
 */
export const saveMealPlanToFirestore = async (planName, mealPlan) => {
  try {
    const currentUser = auth.currentUser;
    const userId = currentUser ? currentUser.uid : 'anonymous';
    
    console.log('Current user:', currentUser ? currentUser.uid : 'No user logged in');
    
    const docRef = await addDoc(collection(db, 'mealPlans'), {
      name: planName,
      plan: mealPlan,
      savedAt: new Date().toISOString(),
      userId: userId // Always include userId
    });
    
    console.log('Meal plan saved with ID:', docRef.id, 'for user:', userId);
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw new Error('Failed to save meal plan: ' + error.message);
  }
};

/**
 * Load all meal plans from Firestore for the current user.
 * @returns {Promise<Array>} - An array of saved meal plans.
 */
export const loadMealPlansFromFirestore = async () => {
  try {
    const currentUser = auth.currentUser;
    const userId = currentUser ? currentUser.uid : 'anonymous';
    
    console.log('Loading meal plans for user:', userId);
    
    // For now, try to load all meal plans without filtering by userId
    const querySnapshot = await getDocs(collection(db, 'mealPlans'));
    
    console.log(`Found ${querySnapshot.size} total meal plans`);
    
    // Log each meal plan and its userId for debugging
    const savedPlans = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Plan ${doc.id}: userId = ${data.userId || 'MISSING'}, name = ${data.name || 'Unnamed'}`);
      savedPlans.push({ 
        id: doc.id,
        ...data
      });
    });
    
    return savedPlans;
  } catch (error) {
    console.error('Error loading meal plans:', error);
    throw new Error('Failed to load meal plans: ' + error.message);
  }
};

/**
 * Delete a meal plan from Firestore.
 * @param {string} planId - The document ID of the meal plan to delete.
 * @returns {Promise<void>}
 */
export const deleteMealPlanFromFirestore = async (planId) => {
  try {
    const currentUser = auth.currentUser;
    const userId = currentUser ? currentUser.uid : 'anonymous';
    
    console.log('Deleting meal plan:', planId);
    console.log('Current user:', userId);
    
    // For debugging, let's get the meal plan first to check its userId
    try {
      const planRef = doc(db, 'mealPlans', planId);
      const planDoc = await db.getDoc(planRef);
      
      if (planDoc.exists()) {
        const planData = planDoc.data();
        console.log(`Plan ${planId} has userId: ${planData.userId || 'MISSING'}`);
        console.log(`User ID match: ${planData.userId === userId}`);
      } else {
        console.log(`Plan ${planId} not found`);
      }
    } catch (err) {
      console.log('Error checking plan before delete:', err);
    }
    
    // Now try to delete
    await deleteDoc(doc(db, 'mealPlans', planId));
    console.log('Meal plan deleted successfully:', planId);
    
    return true;
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    throw new Error('Failed to delete meal plan: ' + error.message);
  }
};
