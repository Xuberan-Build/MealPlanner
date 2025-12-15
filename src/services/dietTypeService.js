/**
 * Enhanced Diet Type Service
 * Comprehensive CRUD operations, recommendations, and user preferences
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  arrayUnion,
  arrayRemove,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';

class DietTypeService {
  constructor() {
    // 5-minute cache
    this.cache = new Map();
    this.cacheExpiry = 5 * 60 * 1000;

    // Default system diet types
    this.defaultDietTypes = [
      {
        name: 'Vegetarian',
        description: 'No meat or fish',
        icon: '🌱',
        color: '#4CAF50',
        isDefault: true,
        keywords: ['veggie', 'meatless', 'vegetarian'],
        incompatibleIngredients: ['chicken', 'beef', 'pork', 'fish', 'meat', 'bacon', 'sausage']
      },
      {
        name: 'Vegan',
        description: 'No animal products',
        icon: '🥬',
        color: '#8BC34A',
        isDefault: true,
        keywords: ['vegan', 'plant-based'],
        incompatibleIngredients: ['chicken', 'beef', 'pork', 'fish', 'meat', 'dairy', 'milk', 'cheese', 'eggs', 'honey', 'butter']
      },
      {
        name: 'Keto',
        description: 'Low-carb, high-fat',
        icon: '🥑',
        color: '#FF9800',
        isDefault: true,
        keywords: ['keto', 'low-carb', 'ketogenic'],
        incompatibleIngredients: ['bread', 'pasta', 'rice', 'potato', 'sugar', 'flour']
      },
      {
        name: 'Paleo',
        description: 'Whole foods, no processed foods',
        icon: '🍖',
        color: '#795548',
        isDefault: true,
        keywords: ['paleo', 'caveman', 'primal'],
        incompatibleIngredients: ['dairy', 'grains', 'legumes', 'processed']
      },
      {
        name: 'Low-Carb',
        description: 'Reduced carbohydrate intake',
        icon: '🥗',
        color: '#9C27B0',
        isDefault: true,
        keywords: ['low-carb', 'reduced-carb'],
        incompatibleIngredients: ['bread', 'pasta', 'rice', 'potato']
      },
      {
        name: 'Gluten-Free',
        description: 'No gluten-containing grains',
        icon: '🌾',
        color: '#FFC107',
        isDefault: true,
        keywords: ['gluten-free', 'gf', 'celiac'],
        incompatibleIngredients: ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye']
      },
      {
        name: 'Dairy-Free',
        description: 'No dairy products',
        icon: '🥛',
        color: '#00BCD4',
        isDefault: true,
        keywords: ['dairy-free', 'lactose-free', 'no-dairy'],
        incompatibleIngredients: ['milk', 'cheese', 'butter', 'cream', 'yogurt', 'dairy']
      },
      {
        name: 'Nut-Free',
        description: 'No nuts or nut products',
        icon: '🥜',
        color: '#F44336',
        isDefault: true,
        keywords: ['nut-free', 'no-nuts'],
        incompatibleIngredients: ['peanut', 'almond', 'cashew', 'walnut', 'pecan', 'nuts']
      },
      {
        name: 'Halal',
        description: 'Prepared according to Islamic law',
        icon: '☪️',
        color: '#4CAF50',
        isDefault: true,
        keywords: ['halal', 'islamic'],
        incompatibleIngredients: ['pork', 'bacon', 'ham', 'alcohol']
      },
      {
        name: 'Kosher',
        description: 'Prepared according to Jewish law',
        icon: '✡️',
        color: '#2196F3',
        isDefault: true,
        keywords: ['kosher', 'jewish'],
        incompatibleIngredients: ['pork', 'shellfish', 'bacon']
      }
    ];
  }

  // ========== CRUD OPERATIONS ==========

  /**
   * Get all diet types for a user (system + custom)
   * @param {string} userId - User ID
   * @param {Object} options - { includeHidden, includeInactive, sortBy }
   * @returns {Promise<Array>} Array of diet type objects
   */
  async getDietTypes(userId, options = {}) {
    const {
      includeHidden = false,
      includeInactive = false,
      sortBy = 'name'
    } = options;

    try {
      // Check cache
      const cacheKey = `dietTypes_${userId || 'global'}_${JSON.stringify(options)}`;
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }

      // Get global diet types from Firestore
      const globalDietTypesRef = collection(db, 'globalDietTypes');
      const globalSnapshot = await getDocs(globalDietTypesRef);

      const globalDietTypes = globalSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Merge with defaults for any missing system types
      const allDietTypes = [...globalDietTypes];

      // Add defaults if not in Firestore yet
      for (const defaultType of this.defaultDietTypes) {
        if (!allDietTypes.find(dt => dt.name === defaultType.name)) {
          allDietTypes.push({
            ...defaultType,
            id: defaultType.name.toLowerCase().replace(/\s+/g, '-'),
            createdBy: 'system',
            createdAt: Timestamp.now(),
            isActive: true
          });
        }
      }

      // Get user preferences if userId provided
      let userPreferences = null;
      if (userId) {
        userPreferences = await this.getUserPreferences(userId);
      }

      // Filter based on options and preferences
      let filteredTypes = allDietTypes.filter(dt => {
        // Filter inactive types
        if (!includeInactive && dt.isActive === false) return false;

        // Filter hidden types (based on user preferences)
        if (!includeHidden && userPreferences?.hidden?.includes(dt.name)) return false;

        return true;
      });

      // Sort
      filteredTypes.sort((a, b) => {
        // Favorites first if user has preferences
        if (userPreferences?.favorites) {
          const aIsFavorite = userPreferences.favorites.includes(a.name);
          const bIsFavorite = userPreferences.favorites.includes(b.name);
          if (aIsFavorite && !bIsFavorite) return -1;
          if (!aIsFavorite && bIsFavorite) return 1;
        }

        // Then sort by specified field
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }

        return 0;
      });

      // Cache result
      this.cache.set(cacheKey, {
        data: filteredTypes,
        timestamp: Date.now()
      });

      return filteredTypes;
    } catch (error) {
      console.error('Error getting diet types:', error);
      // Fallback to defaults
      return this.defaultDietTypes;
    }
  }

  /**
   * Create a new custom diet type
   * @param {Object} dietTypeData - { name, description, icon, color, keywords, incompatibleIngredients }
   * @param {string} userId - Creator user ID
   * @returns {Promise<string>} Diet type ID
   */
  async createDietType(dietTypeData, userId) {
    try {
      // Validate
      const validation = this.validateDietType(dietTypeData);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for duplicates
      const existingTypes = await this.getDietTypes(userId);
      const duplicate = existingTypes.find(
        dt => dt.name.toLowerCase() === dietTypeData.name.toLowerCase()
      );
      if (duplicate) {
        throw new Error(`Diet type "${dietTypeData.name}" already exists`);
      }

      // Create document
      const dietTypeId = dietTypeData.name.toLowerCase().replace(/\s+/g, '-');
      const dietTypeRef = doc(db, 'globalDietTypes', dietTypeId);

      const newDietType = {
        name: dietTypeData.name.trim(),
        description: dietTypeData.description || '',
        icon: dietTypeData.icon || '🍽️',
        color: dietTypeData.color || '#757575',
        keywords: dietTypeData.keywords || [],
        incompatibleIngredients: dietTypeData.incompatibleIngredients || [],
        isDefault: false,
        isActive: true,
        createdBy: userId,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(dietTypeRef, newDietType);

      // Clear cache
      this.clearCache();

      return dietTypeId;
    } catch (error) {
      console.error('Error creating diet type:', error);
      throw error;
    }
  }

  /**
   * Update an existing diet type
   * @param {string} dietTypeId - Diet type ID
   * @param {Object} updates - Fields to update
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<void>}
   */
  async updateDietType(dietTypeId, updates, userId) {
    try {
      const dietTypeRef = doc(db, 'globalDietTypes', dietTypeId);
      const dietTypeDoc = await getDoc(dietTypeRef);

      if (!dietTypeDoc.exists()) {
        throw new Error('Diet type not found');
      }

      const dietType = dietTypeDoc.data();

      // Permission check
      if (dietType.createdBy === 'system') {
        throw new Error('Cannot modify system diet types');
      }

      if (dietType.createdBy !== userId) {
        throw new Error('You can only modify your own custom diet types');
      }

      // Validate updates
      if (updates.name) {
        const validation = this.validateDietType({ ...dietType, ...updates });
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
      }

      // Update document
      await updateDoc(dietTypeRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });

      // Clear cache
      this.clearCache();
    } catch (error) {
      console.error('Error updating diet type:', error);
      throw error;
    }
  }

  /**
   * Delete (archive) a diet type
   * @param {string} dietTypeId - Diet type ID
   * @param {string} userId - User ID (for permission check)
   * @returns {Promise<number>} Number of affected recipes
   */
  async deleteDietType(dietTypeId, userId) {
    try {
      const dietTypeRef = doc(db, 'globalDietTypes', dietTypeId);
      const dietTypeDoc = await getDoc(dietTypeRef);

      if (!dietTypeDoc.exists()) {
        throw new Error('Diet type not found');
      }

      const dietType = dietTypeDoc.data();

      // Permission check
      if (dietType.createdBy === 'system') {
        throw new Error('Cannot delete system diet types');
      }

      if (dietType.createdBy !== userId) {
        throw new Error('You can only delete your own custom diet types');
      }

      // Count affected recipes
      const affectedCount = await this.countRecipesWithDietType(dietType.name, userId);

      // Soft delete (archive) instead of hard delete
      await updateDoc(dietTypeRef, {
        isActive: false,
        deletedAt: Timestamp.now(),
        deletedBy: userId
      });

      // Clear cache
      this.clearCache();

      return affectedCount;
    } catch (error) {
      console.error('Error deleting diet type:', error);
      throw error;
    }
  }

  // ========== MULTI-DIET SUPPORT ==========

  /**
   * Add diet type to a recipe
   * @param {string} recipeId - Recipe ID
   * @param {string} dietTypeName - Diet type name
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async addDietTypeToRecipe(recipeId, dietTypeName, userId) {
    try {
      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      const recipe = recipeDoc.data();

      // Permission check
      if (recipe.userId !== userId) {
        throw new Error('You can only modify your own recipes');
      }

      // Get current dietTypes array
      const currentDietTypes = recipe.dietTypes || [recipe.dietType].filter(Boolean);

      // Check if already exists
      if (currentDietTypes.includes(dietTypeName)) {
        return; // Already added
      }

      // Add to array
      const newDietTypes = [...currentDietTypes, dietTypeName];

      // Update recipe
      await updateDoc(recipeRef, {
        dietTypes: newDietTypes,
        dietType: newDietTypes[0], // Backwards compat
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error adding diet type to recipe:', error);
      throw error;
    }
  }

  /**
   * Remove diet type from a recipe
   * @param {string} recipeId - Recipe ID
   * @param {string} dietTypeName - Diet type name
   * @param {string} userId - User ID
   * @returns {Promise<void>}
   */
  async removeDietTypeFromRecipe(recipeId, dietTypeName, userId) {
    try {
      const recipeRef = doc(db, 'recipes', recipeId);
      const recipeDoc = await getDoc(recipeRef);

      if (!recipeDoc.exists()) {
        throw new Error('Recipe not found');
      }

      const recipe = recipeDoc.data();

      // Permission check
      if (recipe.userId !== userId) {
        throw new Error('You can only modify your own recipes');
      }

      // Get current dietTypes array
      const currentDietTypes = recipe.dietTypes || [recipe.dietType].filter(Boolean);

      // Remove from array
      const newDietTypes = currentDietTypes.filter(dt => dt !== dietTypeName);

      // Update recipe
      await updateDoc(recipeRef, {
        dietTypes: newDietTypes,
        dietType: newDietTypes[0] || '', // Backwards compat
        updatedAt: Timestamp.now()
      });
    } catch (error) {
      console.error('Error removing diet type from recipe:', error);
      throw error;
    }
  }

  // ========== RECOMMENDATIONS ==========

  /**
   * Suggest diet types based on ingredients
   * @param {Array} ingredients - Array of ingredient strings or objects
   * @param {Array} currentDietTypes - Currently assigned diet types
   * @returns {Promise<Array>} Array of { dietType, confidence, reason }
   */
  async suggestDietTypes(ingredients, currentDietTypes = []) {
    try {
      const allDietTypes = await this.getDietTypes();
      const suggestions = [];

      // Normalize ingredients to lowercase strings
      const ingredientStrings = ingredients.map(ing =>
        typeof ing === 'string' ? ing.toLowerCase() : (ing.ingredientId || ing.name || '').toLowerCase()
      );

      // Check each diet type
      for (const dietType of allDietTypes) {
        // Skip if already assigned
        if (currentDietTypes.includes(dietType.name)) {
          continue;
        }

        // Check for incompatible ingredients
        const incompatibleIngredients = dietType.incompatibleIngredients || [];
        let hasIncompatible = false;

        for (const incompatible of incompatibleIngredients) {
          if (ingredientStrings.some(ing => ing.includes(incompatible.toLowerCase()))) {
            hasIncompatible = true;
            break;
          }
        }

        if (hasIncompatible) {
          continue; // Skip this diet type
        }

        // Calculate confidence based on keywords
        let confidence = 75; // Base confidence if no incompatible ingredients

        const keywords = dietType.keywords || [];
        for (const keyword of keywords) {
          if (ingredientStrings.some(ing => ing.includes(keyword.toLowerCase()))) {
            confidence = Math.min(100, confidence + 15);
          }
        }

        if (confidence >= 50) {
          suggestions.push({
            dietType: dietType.name,
            confidence,
            reason: hasIncompatible
              ? `Contains incompatible ingredients`
              : `No incompatible ingredients found`,
            icon: dietType.icon,
            color: dietType.color
          });
        }
      }

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      return suggestions;
    } catch (error) {
      console.error('Error suggesting diet types:', error);
      return [];
    }
  }

  // ========== USER PREFERENCES ==========

  /**
   * Get user's diet type preferences
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Preferences object
   */
  async getUserPreferences(userId) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      const prefsDoc = await getDoc(prefsRef);

      if (prefsDoc.exists()) {
        return prefsDoc.data();
      }

      // Return defaults
      return {
        favorites: [],
        hidden: [],
        defaultForNewRecipes: null,
        recentlyUsed: []
      };
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return {
        favorites: [],
        hidden: [],
        defaultForNewRecipes: null,
        recentlyUsed: []
      };
    }
  }

  /**
   * Update user's diet type preferences
   * @param {string} userId - User ID
   * @param {Object} preferences - Preferences to update
   * @returns {Promise<void>}
   */
  async updateUserPreferences(userId, preferences) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, preferences, { merge: true });

      // Clear cache
      this.clearCache();
    } catch (error) {
      console.error('Error updating user preferences:', error);
      throw error;
    }
  }

  /**
   * Add diet type to favorites
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Diet type name
   * @returns {Promise<void>}
   */
  async addFavorite(userId, dietTypeName) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, {
        favorites: arrayUnion(dietTypeName)
      }, { merge: true });

      this.clearCache();
    } catch (error) {
      console.error('Error adding favorite:', error);
      throw error;
    }
  }

  /**
   * Remove diet type from favorites
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Diet type name
   * @returns {Promise<void>}
   */
  async removeFavorite(userId, dietTypeName) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, {
        favorites: arrayRemove(dietTypeName)
      }, { merge: true });

      this.clearCache();
    } catch (error) {
      console.error('Error removing favorite:', error);
      throw error;
    }
  }

  /**
   * Hide a diet type
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Diet type name
   * @returns {Promise<void>}
   */
  async hideDietType(userId, dietTypeName) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, {
        hidden: arrayUnion(dietTypeName)
      }, { merge: true });

      this.clearCache();
    } catch (error) {
      console.error('Error hiding diet type:', error);
      throw error;
    }
  }

  /**
   * Show a hidden diet type
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Diet type name
   * @returns {Promise<void>}
   */
  async showDietType(userId, dietTypeName) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, {
        hidden: arrayRemove(dietTypeName)
      }, { merge: true });

      this.clearCache();
    } catch (error) {
      console.error('Error showing diet type:', error);
      throw error;
    }
  }

  // ========== VALIDATION ==========

  /**
   * Validate diet type data
   * @param {Object} dietTypeData - Diet type object
   * @returns {Object} { valid, errors }
   */
  validateDietType(dietTypeData) {
    const errors = [];

    // Name validation
    if (!dietTypeData.name || typeof dietTypeData.name !== 'string') {
      errors.push('Name is required and must be a string');
    } else if (dietTypeData.name.trim().length < 1) {
      errors.push('Name must be at least 1 character');
    } else if (dietTypeData.name.length > 50) {
      errors.push('Name must be 50 characters or less');
    }

    // Keywords validation
    if (dietTypeData.keywords && Array.isArray(dietTypeData.keywords)) {
      if (dietTypeData.keywords.length > 10) {
        errors.push('Maximum 10 keywords allowed');
      }
      dietTypeData.keywords.forEach((keyword, index) => {
        if (typeof keyword !== 'string' || keyword.length > 30) {
          errors.push(`Keyword ${index + 1} must be a string of 30 characters or less`);
        }
      });
    }

    // Color validation
    if (dietTypeData.color && !/^#[0-9A-F]{6}$/i.test(dietTypeData.color)) {
      errors.push('Color must be a valid hex code (e.g., #4CAF50)');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ========== UTILITIES ==========

  /**
   * Count recipes using a specific diet type
   * @param {string} dietTypeName - Diet type name
   * @param {string} userId - User ID
   * @returns {Promise<number>} Count of recipes
   */
  async countRecipesWithDietType(dietTypeName, userId) {
    try {
      const recipesRef = collection(db, 'recipes');
      const q = query(
        recipesRef,
        where('userId', '==', userId),
        where('dietType', '==', dietTypeName)
      );
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error('Error counting recipes:', error);
      return 0;
    }
  }

  /**
   * Bulk update recipes when renaming a diet type
   * @param {string} oldName - Old diet type name
   * @param {string} newName - New diet type name
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of updated recipes
   */
  async bulkUpdateRecipeDietTypes(oldName, newName, userId) {
    try {
      const recipesRef = collection(db, 'recipes');
      const q = query(
        recipesRef,
        where('userId', '==', userId),
        where('dietType', '==', oldName)
      );

      const snapshot = await getDocs(q);
      const batch = writeBatch(db);

      snapshot.docs.forEach(doc => {
        batch.update(doc.ref, {
          dietType: newName,
          updatedAt: Timestamp.now()
        });
      });

      await batch.commit();
      return snapshot.size;
    } catch (error) {
      console.error('Error bulk updating recipes:', error);
      throw error;
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

// Export singleton instance
const dietTypeService = new DietTypeService();
export default dietTypeService;
