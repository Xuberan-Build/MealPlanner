import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  arrayUnion,
  query,
  where 
} from 'firebase/firestore';
import { db } from '../firebase';

class DietTypeService {
  constructor() {
    this.defaultDietTypes = [
      'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low-Carb',
      'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'
    ];
    this.cachedDietTypes = null;
    this.cacheExpiry = null;
  }

  /**
   * Get all diet types for a user (default + custom)
   * @param {string} userId - User ID
   * @returns {Promise<string[]>} Array of diet types
   */
  async getDietTypes(userId) {
    try {
      // Check cache first (5 minutes expiry)
      if (this.cachedDietTypes && this.cacheExpiry && Date.now() < this.cacheExpiry) {
        return this.cachedDietTypes;
      }

      if (!userId) {
        return this.defaultDietTypes;
      }

      // Get user's custom diet types from Firestore
      const userDocRef = doc(db, 'users', userId);
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', userId)));
      
      let customDietTypes = [];
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        customDietTypes = userData.customDietTypes || [];
      }

      // Combine default and custom, remove duplicates, sort alphabetically
      const allDietTypes = [...new Set([...this.defaultDietTypes, ...customDietTypes])]
        .sort((a, b) => a.localeCompare(b));

      // Cache results
      this.cachedDietTypes = allDietTypes;
      this.cacheExpiry = Date.now() + (5 * 60 * 1000); // 5 minutes

      return allDietTypes;
    } catch (error) {
      console.error('Error fetching diet types:', error);
      return this.defaultDietTypes;
    }
  }

  /**
   * Add a new custom diet type for a user
   * @param {string} userId - User ID
   * @param {string} dietType - New diet type to add
   * @returns {Promise<boolean>} Success status
   */
  async addCustomDietType(userId, dietType) {
    try {
      if (!userId || !dietType?.trim()) {
        return false;
      }

      const cleanDietType = dietType.trim();
      
      // Check if it already exists (case insensitive)
      const existingTypes = await this.getDietTypes(userId);
      const exists = existingTypes.some(type => 
        type.toLowerCase() === cleanDietType.toLowerCase()
      );

      if (exists) {
        return true; // Already exists, consider it a success
      }

      // Add to user's custom diet types
      const userDocRef = doc(db, 'users', userId);

      // Use setDoc with merge to create document if it doesn't exist
      await setDoc(userDocRef, {
        customDietTypes: arrayUnion(cleanDietType)
      }, { merge: true });

      // Clear cache to force refresh
      this.cachedDietTypes = null;
      this.cacheExpiry = null;

      return true;
    } catch (error) {
      console.error('Error adding custom diet type:', error);
      return false;
    }
  }

  /**
   * Search diet types with fuzzy matching
   * @param {string} searchTerm - Search term
   * @param {string[]} dietTypes - Array of diet types to search
   * @returns {string[]} Filtered and sorted diet types
   */
  searchDietTypes(searchTerm, dietTypes) {
    if (!searchTerm?.trim()) {
      return dietTypes;
    }

    const term = searchTerm.toLowerCase().trim();
    
    // Exact matches first, then starts-with, then contains
    const exactMatches = [];
    const startsWithMatches = [];
    const containsMatches = [];

    dietTypes.forEach(dietType => {
      const lowerDiet = dietType.toLowerCase();
      
      if (lowerDiet === term) {
        exactMatches.push(dietType);
      } else if (lowerDiet.startsWith(term)) {
        startsWithMatches.push(dietType);
      } else if (lowerDiet.includes(term)) {
        containsMatches.push(dietType);
      }
    });

    return [...exactMatches, ...startsWithMatches, ...containsMatches];
  }

  /**
   * Clear cached diet types (useful for testing or forced refresh)
   */
  clearCache() {
    this.cachedDietTypes = null;
    this.cacheExpiry = null;
  }
}

// Export singleton instance
export const dietTypeService = new DietTypeService();
export default dietTypeService;