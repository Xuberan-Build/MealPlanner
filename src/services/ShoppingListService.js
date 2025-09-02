// src/services/ShoppingListService.js
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase';
import { auth } from '../firebase';

const SHOPPING_LISTS_COLLECTION = 'shoppingLists';

/**
 * Create a new shopping list
 * @param {Object} listData - Shopping list data
 * @returns {Promise<string>} - Document ID of created list
 */
export const createShoppingList = async (listData) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to create shopping lists');
    }

    const shoppingListDoc = {
      ...listData,
      userId: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true
    };

    const docRef = await addDoc(collection(db, SHOPPING_LISTS_COLLECTION), shoppingListDoc);
    console.log('Shopping list created with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error creating shopping list:', error);
    throw error;
  }
};

/**
 * Get all shopping lists for the current user
 * @returns {Promise<Array>} - Array of shopping lists
 */
export const getUserShoppingLists = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated to fetch shopping lists');
    }

    const q = query(
      collection(db, SHOPPING_LISTS_COLLECTION),
      where('userId', '==', user.uid),
      where('isActive', '==', true),
      orderBy('updatedAt', 'desc')
    );

    const querySnapshot = await getDocs(q);
    const shoppingLists = [];

    querySnapshot.forEach((doc) => {
      shoppingLists.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      });
    });

    console.log('Fetched shopping lists:', shoppingLists.length);
    return shoppingLists;
  } catch (error) {
    console.error('Error fetching shopping lists:', error);
    throw error;
  }
};

/**
 * Get a specific shopping list by ID
 * @param {string} listId - Shopping list ID
 * @returns {Promise<Object>} - Shopping list data
 */
export const getShoppingList = async (listId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const docRef = doc(db, SHOPPING_LISTS_COLLECTION, listId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Verify user owns this list
      if (data.userId !== user.uid) {
        throw new Error('Unauthorized access to shopping list');
      }

      return {
        id: docSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate(),
        updatedAt: data.updatedAt?.toDate()
      };
    } else {
      throw new Error('Shopping list not found');
    }
  } catch (error) {
    console.error('Error fetching shopping list:', error);
    throw error;
  }
};

/**
 * Update a shopping list
 * @param {string} listId - Shopping list ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<void>}
 */
export const updateShoppingList = async (listId, updates) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const docRef = doc(db, SHOPPING_LISTS_COLLECTION, listId);
    
    // Verify user owns this list first
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== user.uid) {
      throw new Error('Unauthorized access to shopping list');
    }

    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });

    console.log('Shopping list updated:', listId);
  } catch (error) {
    console.error('Error updating shopping list:', error);
    throw error;
  }
};

/**
 * Delete a shopping list (soft delete)
 * @param {string} listId - Shopping list ID
 * @returns {Promise<void>}
 */
export const deleteShoppingList = async (listId) => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('User must be authenticated');
    }

    const docRef = doc(db, SHOPPING_LISTS_COLLECTION, listId);
    
    // Verify user owns this list first
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists() || docSnap.data().userId !== user.uid) {
      throw new Error('Unauthorized access to shopping list');
    }

    // Soft delete by marking as inactive
    await updateDoc(docRef, {
      isActive: false,
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    console.log('Shopping list deleted:', listId);
  } catch (error) {
    console.error('Error deleting shopping list:', error);
    throw error;
  }
};

/**
 * Add item to shopping list
 * @param {string} listId - Shopping list ID
 * @param {Object} item - Item to add
 * @returns {Promise<void>}
 */
export const addItemToList = async (listId, item) => {
  try {
    const shoppingList = await getShoppingList(listId);
    const updatedItems = [...(shoppingList.items || []), {
      ...item,
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date(),
      completed: false
    }];

    await updateShoppingList(listId, { items: updatedItems });
  } catch (error) {
    console.error('Error adding item to shopping list:', error);
    throw error;
  }
};

/**
 * Remove item from shopping list
 * @param {string} listId - Shopping list ID
 * @param {string} itemId - Item ID to remove
 * @returns {Promise<void>}
 */
export const removeItemFromList = async (listId, itemId) => {
  try {
    const shoppingList = await getShoppingList(listId);
    const updatedItems = (shoppingList.items || []).filter(item => item.id !== itemId);

    await updateShoppingList(listId, { items: updatedItems });
  } catch (error) {
    console.error('Error removing item from shopping list:', error);
    throw error;
  }
};

/**
 * Update item in shopping list
 * @param {string} listId - Shopping list ID
 * @param {string} itemId - Item ID to update
 * @param {Object} updates - Updates to apply to the item
 * @returns {Promise<void>}
 */
export const updateItemInList = async (listId, itemId, updates) => {
  try {
    const shoppingList = await getShoppingList(listId);
    const updatedItems = (shoppingList.items || []).map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );

    await updateShoppingList(listId, { items: updatedItems });
  } catch (error) {
    console.error('Error updating item in shopping list:', error);
    throw error;
  }
};

/**
 * Create shopping list from meal plan
 * @param {Object} mealPlan - Meal plan data
 * @param {string} listName - Name for the shopping list
 * @returns {Promise<string>} - Created shopping list ID
 */
export const createListFromMealPlan = async (mealPlan, listName = 'Meal Plan Shopping List') => {
  try {
    // Use existing ShoppingListGenerator logic to create items
    const { combineIngredients } = await import('../features/mealPlanner/components/ShoppingListGenerator');
    
    // Extract and process ingredients (similar to existing logic)
    const allIngredients = [];
    
    Object.values(mealPlan).forEach(dayMeals => {
      if (!dayMeals) return;
      
      Object.values(dayMeals).forEach(mealData => {
        let recipe, servings;
        
        if (mealData?.recipe && typeof mealData?.servings !== 'undefined') {
          recipe = mealData.recipe;
          servings = mealData.servings;
        } else if (mealData?.title) {
          recipe = mealData;
          servings = mealData.selectedServings || mealData.servings || 1;
        } else {
          return;
        }

        if (!recipe?.ingredients) return;

        const recipeServings = recipe.servings || 1;
        const servingMultiplier = servings / recipeServings;

        recipe.ingredients.forEach(ingredient => {
          if (ingredient.ingredientId && ingredient.amount) {
            const adjustedAmount = ingredient.amount * servingMultiplier;
            
            allIngredients.push({
              ...ingredient,
              adjustedAmount: adjustedAmount
            });
          }
        });
      });
    });

    // Convert to shopping list format
    const items = allIngredients.map(ingredient => ({
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: ingredient.ingredientId,
      quantity: ingredient.adjustedAmount,
      unit: ingredient.unit || 'items',
      category: ingredient.category || 'Other',
      estimatedCost: 0,
      completed: false,
      alreadyHave: false,
      notes: '',
      addedAt: new Date()
    }));

    const listData = {
      name: listName,
      items,
      type: 'mealPlan',
      source: 'Generated from meal plan'
    };

    return await createShoppingList(listData);
  } catch (error) {
    console.error('Error creating shopping list from meal plan:', error);
    throw error;
  }
};