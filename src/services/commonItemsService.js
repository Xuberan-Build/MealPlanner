import { db, auth } from '../firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp
} from 'firebase/firestore';

/**
 * Track that a user added an item to their shopping list
 * @param {string} itemName - Name of the ingredient/item
 * @returns {Promise<void>}
 */
export const trackItemUsage = async (itemName) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    // Normalize item name (lowercase, trim)
    const normalizedName = itemName.trim().toLowerCase();

    // Create document ID from userId + itemName
    const docId = `${userId}_${normalizedName.replace(/\s+/g, '_')}`;

    const itemRef = doc(db, 'userItemHistory', docId);

    // Check if document exists
    const itemDoc = await getDoc(itemRef);

    if (itemDoc.exists()) {
      // Increment count
      await setDoc(itemRef, {
        count: increment(1),
        lastUsed: serverTimestamp()
      }, { merge: true });
    } else {
      // Create new tracking document
      await setDoc(itemRef, {
        userId,
        itemName: itemName.trim(), // Keep original casing for display
        normalizedName,
        count: 1,
        firstUsed: serverTimestamp(),
        lastUsed: serverTimestamp()
      });
    }

    console.log(`✅ Tracked usage for item: ${itemName}`);
  } catch (error) {
    console.error('Error tracking item usage:', error);
    // Don't throw - tracking is non-critical
  }
};

/**
 * Get user's most commonly added items
 * @param {number} limitCount - Number of items to return (default 10)
 * @returns {Promise<Array>} Array of {name, count, lastUsed}
 */
export const getCommonItems = async (limitCount = 10) => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const historyRef = collection(db, 'userItemHistory');
    const q = query(
      historyRef,
      where('userId', '==', userId),
      orderBy('count', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);

    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.itemName,
        count: data.count,
        lastUsed: data.lastUsed?.toDate() || null
      };
    });

    console.log(`📊 Retrieved ${items.length} common items`);
    return items;
  } catch (error) {
    console.error('Error getting common items:', error);
    return []; // Return empty array on error
  }
};

/**
 * Clear user's item history (for privacy/reset)
 * @returns {Promise<void>}
 */
export const clearItemHistory = async () => {
  try {
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const historyRef = collection(db, 'userItemHistory');
    const q = query(historyRef, where('userId', '==', userId));

    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));

    await Promise.all(deletePromises);
    console.log('✅ Cleared item history');
  } catch (error) {
    console.error('Error clearing item history:', error);
    throw error;
  }
};
