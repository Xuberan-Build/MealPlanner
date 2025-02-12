import { db } from '../firebase'; // Your Firebase config
import { collection, addDoc, getDocs, deleteDoc, doc } from 'firebase/firestore';

// Reference to the mealPlans collection
const mealPlansCollectionRef = collection(db, 'mealPlans');

/**
 * Save a meal plan to Firestore.
 * @param {string} planName - The name of the meal plan.
 * @param {object} mealPlan - The meal plan data (object of meals).
 * @returns {Promise<string>} - The document ID of the saved meal plan.
 */
export const saveMealPlanToFirestore = async (planName, mealPlan) => {
  try {
    const docRef = await addDoc(mealPlansCollectionRef, {
      name: planName,
      plan: mealPlan,
      savedAt: new Date().toISOString(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error saving meal plan:', error);
    throw new Error('Failed to save meal plan.');
  }
};

/**
 * Load all meal plans from Firestore.
 * @returns {Promise<Array>} - An array of saved meal plans.
 */
export const loadMealPlansFromFirestore = async () => {
  try {
    const querySnapshot = await getDocs(mealPlansCollectionRef);
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
    const planDocRef = doc(db, 'mealPlans', planId);
    await deleteDoc(planDocRef);
  } catch (error) {
    console.error('Error deleting meal plan:', error);
    throw new Error('Failed to delete meal plan.');
  }
};

const SavedMealPlans = ({ savedMealPlans, onLoadMealPlan, onDeleteMealPlan }) => {
    const handleDelete = async (planName) => {
      try {
        await deleteMealPlanFromFirestore(planName); // Delete from Firestore
        onDeleteMealPlan(planName); // Update the parent with the new list of plans
      } catch (error) {
        console.error('Error deleting meal plan:', error);
      }
    };
  
    return (
      <div>
        <h2>Saved Meal Plans</h2>
        <ul>
          {savedMealPlans.map((plan) => (
            <li key={plan.name}>
              <strong>{plan.name}</strong> (saved on {new Date(plan.savedAt).toLocaleDateString()})
              <button onClick={() => onLoadMealPlan(plan.plan)}>Load</button>
              <button onClick={() => handleDelete(plan.name)}>Delete</button>
            </li>
          ))}
        </ul>
      </div>
    );
  };
  
  export default SavedMealPlans;