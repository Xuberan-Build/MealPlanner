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
    if (!currentUser) {
      console.warn('No user is logged in. Using temporary user ID for development.');
      // For development, you can use a temporary ID or throw an error
      // throw new Error('You must be logged in to save a meal plan');
    }

    const userId = currentUser ? currentUser.uid : 'development-user';
    
    const docRef = await addDoc(collection(db, 'mealPlans'), {
      name: planName,
      plan: mealPlan,
      savedAt: new Date().toISOString(),
      userId: userId // Add user ID to associate with the correct user
    });
    
    console.log('Meal plan saved with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw new Error('Failed to save meal plan.');
  }
};

/**
 * Load all meal plans from Firestore for the current user.
 * @returns {Promise<Array>} - An array of saved meal plans.
 */
export const loadMealPlansFromFirestore = async () => {
  try {
    const currentUser = auth.currentUser;
    let querySnapshot;
    
    if (currentUser) {
      // If logged in, get only user's meal plans
      const userPlansQuery = query(
        collection(db, 'mealPlans'),
        where('userId', '==', currentUser.uid)
      );
      querySnapshot = await getDocs(userPlansQuery);
    } else {
      // For development mode
      console.warn('No user is logged in. Using development mode to show development user plans.');
      const devPlansQuery = query(
        collection(db, 'mealPlans'),
        where('userId', '==', 'development-user')
      );
      querySnapshot = await getDocs(devPlansQuery);
    }
    
    const savedPlans = [];
    querySnapshot.forEach((doc) => {
      savedPlans.push({ id: doc.id, ...doc.data() });
    });
    
    return savedPlans;
  } catch (error) {
    console.error('Error loading meal plans:', error);
    throw new Error('Failed to load meal plans.');
  }
};

/**
 * Delete a meal plan from Firestore.
 * @param {string} planId - The document ID of the meal plan to delete.
 * @returns {Promise<void>}
 */
export const deleteMealPlanFromFirestore = async (planId) => {
  try {
    // We don't need to check auth here since Firestore rules will prevent
    // unauthorized deletions
    const planDocRef = doc(db, 'mealPlans', planId);
    await deleteDoc(planDocRef);
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    throw new Error('Failed to delete meal plan.');
  }
};
