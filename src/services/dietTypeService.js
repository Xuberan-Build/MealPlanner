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
  query,
  where,
  arrayUnion,
  arrayRemove,
  writeBatch,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { canonicalDietType, dietTypeKey, normalizeDietTypeList } from '../utils/dietTypes/normalize';
import { dedupeDietTypeObjects } from '../utils/dietTypes/collection';
import { searchDietTypeItems } from '../utils/dietTypes/suggest';

/**
 * Diet type names are normalized on read: getDietTypes() returns one object per
 * dietTypeKey with the canonical display name ("vegan", "Vegan " and "VEGAN" docs come back
 * as a single "Vegan" with `mergedIds` listing the folded duplicates). Nothing is rewritten
 * in Firestore on read. Creating stores the canonical name and returns the existing type
 * when one with the same key already exists.
 */

/** Does a favorites/hidden list refer to this (possibly merged) diet type? */
const prefIncludes = (list, dietType) => {
  if (!Array.isArray(list) || list.length === 0 || !dietType) return false;
  const ids = new Set([dietType.id, ...(dietType.mergedIds || [])].filter(Boolean));
  const key = dietType.key || dietTypeKey(dietType.name);
  return list.some((entry) => ids.has(entry) || (key && dietTypeKey(entry) === key));
};

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

      const docs = globalSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Docs merged by scripts/normalizeDietTypes.mjs point at their keeper; fold their
      // ids into it so favorites/hidden stored by the old id keep working.
      const mergedInto = new Map();
      for (const d of docs) {
        if (d.mergedInto) {
          if (!mergedInto.has(d.mergedInto)) mergedInto.set(d.mergedInto, []);
          mergedInto.get(d.mergedInto).push(d.id);
        }
      }
      const globalDietTypes = docs
        .filter(d => !d.mergedInto)
        .map(d => (mergedInto.has(d.id) ? { ...d, mergedIds: mergedInto.get(d.id) } : d));

      // Merge with defaults for any missing system types (matched by key, not exact name)
      const allDietTypes = [...globalDietTypes];
      const presentKeys = new Set(
        globalDietTypes.filter(dt => includeInactive || dt.isActive !== false).map(dt => dietTypeKey(dt.name))
      );

      // Add defaults if not in Firestore yet
      for (const defaultType of this.defaultDietTypes) {
        if (!presentKeys.has(dietTypeKey(defaultType.name))) {
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

      // Inactive types are dropped before dedupe so an archived duplicate can't shadow an
      // active one; then one object per key with the canonical name.
      const visibleTypes = allDietTypes.filter(dt => includeInactive || dt.isActive !== false);
      let filteredTypes = dedupeDietTypeObjects(visibleTypes).filter(dt => {
        // Filter hidden types (based on user preferences; stored as names or ids)
        if (!includeHidden && prefIncludes(userPreferences?.hidden, dt)) return false;

        return true;
      });

      // Sort
      filteredTypes.sort((a, b) => {
        // Favorites first if user has preferences
        if (userPreferences?.favorites) {
          const aIsFavorite = prefIncludes(userPreferences.favorites, a);
          const bIsFavorite = prefIncludes(userPreferences.favorites, b);
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
      return this.defaultDietTypes.map(dt => ({
        ...dt,
        id: dt.name.toLowerCase().replace(/\s+/g, '-'),
        createdBy: 'system',
        isActive: true
      }));
    }
  }

  /**
   * Create a new custom diet type. The name is stored in canonical form ("gluten free" ->
   * "Gluten-Free"). If a diet type with the same key already exists, nothing is written
   * and the existing one is returned (with `existing: true`).
   * @param {Object} dietTypeData - { name, description, icon, color, keywords, incompatibleIngredients }
   * @param {string} userId - Creator user ID
   * @returns {Promise<Object>} The created (or existing) diet type object, including `id`
   */
  async createDietType(dietTypeData, userId) {
    try {
      const name = canonicalDietType(dietTypeData?.name);

      // Validate
      const validation = this.validateDietType({ ...dietTypeData, name: name || '' });
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Same key already exists -> return it instead of creating a near-duplicate
      const key = dietTypeKey(name);
      const existingTypes = await this.getDietTypes(userId, { includeHidden: true });
      const duplicate = existingTypes.find(dt => (dt.key || dietTypeKey(dt.name)) === key);
      if (duplicate) {
        return { ...duplicate, existing: true };
      }

      // Never overwrite an existing document (e.g. an archived type with the same slug)
      const baseId = name.toLowerCase().replace(/\s+/g, '-');
      let dietTypeId = baseId;
      let dietTypeRef = doc(db, 'globalDietTypes', dietTypeId);
      let taken = null;
      try {
        taken = await getDoc(dietTypeRef);
      } catch (lookupError) {
        taken = null; // Lookup failure: setDoc below still won't merge into anything unexpected
      }
      if (taken && typeof taken.exists === 'function' && taken.exists()) {
        dietTypeId = `${baseId}-${Date.now().toString(36)}`;
        dietTypeRef = doc(db, 'globalDietTypes', dietTypeId);
      }

      const newDietType = {
        name,
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

      return { id: dietTypeId, key, ...newDietType };
    } catch (error) {
      console.error('Error creating diet type:', error);
      throw error;
    }
  }

  /**
   * Add a custom diet type by name (used by the recipe details / recipe form typeaheads).
   * Never throws: returns the created or existing diet type, or null on failure / blank name.
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Name as typed
   * @returns {Promise<Object|null>}
   */
  async addCustomDietType(userId, dietTypeName) {
    if (!userId || !canonicalDietType(dietTypeName)) return null;
    try {
      return await this.createDietType({ name: dietTypeName }, userId);
    } catch (error) {
      console.error('Error adding custom diet type:', error);
      return null;
    }
  }

  /**
   * Rank and filter diet types (strings or { name } objects) by a search term:
   * exact > alias > prefix > word-start > substring > typo. Returns the original items.
   * @param {string} searchTerm
   * @param {Array} dietTypes
   * @returns {Array}
   */
  searchDietTypes(searchTerm, dietTypes = []) {
    return searchDietTypeItems(searchTerm, dietTypes);
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

      // Validate updates (names are stored canonical and must stay unique by key)
      const finalUpdates = { ...updates };
      if (updates.name !== undefined) {
        finalUpdates.name = canonicalDietType(updates.name) || '';
        const validation = this.validateDietType({ ...dietType, ...finalUpdates });
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        const key = dietTypeKey(finalUpdates.name);
        if (key !== dietTypeKey(dietType.name)) {
          const existingTypes = await this.getDietTypes(userId, { includeHidden: true });
          const clash = existingTypes.find(dt =>
            dt.id !== dietTypeId &&
            !(dt.mergedIds || []).includes(dietTypeId) &&
            (dt.key || dietTypeKey(dt.name)) === key
          );
          if (clash) {
            throw new Error(`Diet type "${clash.name}" already exists`);
          }
        }
      }

      // Update document
      await updateDoc(dietTypeRef, {
        ...finalUpdates,
        updatedAt: Timestamp.now()
      });

      // Clear cache
      this.clearCache();

      return finalUpdates;
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

      // Get current dietTypes array (canonical, deduped)
      const currentDietTypes = normalizeDietTypeList(
        recipe.dietTypes && recipe.dietTypes.length ? recipe.dietTypes : [recipe.dietType]
      );
      const name = canonicalDietType(dietTypeName);
      if (!name) {
        return;
      }

      // Check if already exists (by key: "GF" == "Gluten-Free")
      if (currentDietTypes.some(dt => dietTypeKey(dt) === dietTypeKey(name))) {
        return; // Already added
      }

      // Add to array
      const newDietTypes = [...currentDietTypes, name];

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

      // Get current dietTypes array (canonical, deduped)
      const currentDietTypes = normalizeDietTypeList(
        recipe.dietTypes && recipe.dietTypes.length ? recipe.dietTypes : [recipe.dietType]
      );

      // Remove from array (every spelling of it)
      const removeKey = dietTypeKey(dietTypeName);
      const newDietTypes = currentDietTypes.filter(dt => dietTypeKey(dt) !== removeKey);

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
      const currentKeys = new Set((currentDietTypes || []).map(dietTypeKey));

      // Normalize ingredients to lowercase strings
      const ingredientStrings = ingredients.map(ing =>
        typeof ing === 'string' ? ing.toLowerCase() : (ing.ingredientId || ing.name || '').toLowerCase()
      );

      // Check each diet type
      for (const dietType of allDietTypes) {
        // Skip if already assigned
        if (currentKeys.has(dietTypeKey(dietType.name))) {
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

  /**
   * Alias of showDietType (DietTypeContext calls it unhideDietType)
   * @param {string} userId - User ID
   * @param {string} dietTypeName - Diet type name or id
   * @returns {Promise<void>}
   */
  async unhideDietType(userId, dietTypeName) {
    return this.showDietType(userId, dietTypeName);
  }

  /**
   * Set the diet types pre-selected for new recipes
   * @param {string} userId - User ID
   * @param {string[]} dietTypeIds - Diet type ids
   * @returns {Promise<void>}
   */
  async setDefaultDietTypes(userId, dietTypeIds) {
    try {
      const prefsRef = doc(db, 'users', userId, 'dietTypePreferences', 'default');
      await setDoc(prefsRef, {
        defaultDietTypes: Array.isArray(dietTypeIds) ? dietTypeIds : []
      }, { merge: true });

      this.clearCache();
    } catch (error) {
      console.error('Error setting default diet types:', error);
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
