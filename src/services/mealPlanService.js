import { db, auth } from '../firebase'; // Your Firebase config
import { collection, addDoc, getDocs, deleteDoc, doc, query, where, getDoc, updateDoc } from 'firebase/firestore';

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
      throw new Error('User must be logged in to save meal plans');
    }
    
    const userId = currentUser.uid;
    console.log('Current user:', userId);
    
    const docRef = await addDoc(collection(db, 'mealPlans'), {
      name: planName,
      plan: mealPlan,
      savedAt: new Date().toISOString(),
      userId: userId
    });
    
    console.log('Meal plan saved with ID:', docRef.id, 'for user:', userId);
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw new Error('Failed to save meal plan: ' + error.message);
  }
};

/**
 * Update an existing meal plan in Firestore.
 * @param {string} planId - The document ID of the meal plan to update.
 * @param {string} planName - The updated name of the meal plan.
 * @param {object} mealPlan - The updated meal plan data.
 * @returns {Promise<void>}
 */
export const updateMealPlanInFirestore = async (planId, planName, mealPlan) => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User must be logged in to update meal plans');
    }
    
    const userId = currentUser.uid;
    console.log('Updating meal plan:', planId, 'for user:', userId);
    
    // Get the document reference
    const planRef = doc(db, 'mealPlans', planId);
    
    // Verify the plan exists and belongs to the current user
    const planDoc = await getDoc(planRef);
    if (!planDoc.exists()) {
      throw new Error('Meal plan not found');
    }
    
    const planData = planDoc.data();
    if (planData.userId !== userId) {
      throw new Error('Unauthorized to update this meal plan');
    }
    
    // Update the document
    await updateDoc(planRef, {
      name: planName,
      plan: mealPlan,
      updatedAt: new Date().toISOString(),
      // Keep the original savedAt date
    });
    
    console.log('Meal plan updated successfully:', planId);
  } catch (error) {
    console.error('Error updating meal plan:', error);
    throw new Error('Failed to update meal plan: ' + error.message);
  }
};

/**
 * Load all meal plans from Firestore for the current user.
 * @returns {Promise<Array>} - An array of saved meal plans.
 */
export const loadMealPlansFromFirestore = async () => {
  try {
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      throw new Error('User must be logged in to load meal plans');
    }
    
    const userId = currentUser.uid;
    console.log('Loading meal plans for user:', userId);
    
    // Query only the current user's meal plans
    const q = query(collection(db, 'mealPlans'), where('userId', '==', userId));
    const querySnapshot = await getDocs(q);
    
    console.log(`Found ${querySnapshot.size} meal plans for user ${userId}`);
    
    const savedPlans = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      console.log(`Plan ${doc.id}: name = ${data.name || 'Unnamed'}`);
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
    
    if (!currentUser) {
      throw new Error('User must be logged in to delete meal plans');
    }
    
    const userId = currentUser.uid;
    console.log('Deleting meal plan:', planId);
    console.log('Current user:', userId);
    
    // For debugging, let's get the meal plan first to check its userId
    try {
      const planRef = doc(db, 'mealPlans', planId);
      const planDoc = await getDoc(planRef);
      
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