import dietTypeService from '../dietTypeService';
import { getDocs, setDoc, updateDoc, deleteDoc, query, where, collection, doc } from 'firebase/firestore';

// Mock Firebase
jest.mock('../../firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  orderBy: jest.fn(),
  getDoc: jest.fn()
}));

describe('DietTypeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dietTypeService.clearCache();
  });

  describe('getDietTypes', () => {
    it('should return system diet types when no user ID provided', async () => {
      const result = await dietTypeService.getDietTypes(null);

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('Vegetarian');
      expect(result).toContain('Vegan');
      expect(result).toContain('Keto');
    });

    it('should fetch and combine system and custom diet types', async () => {
      const mockDietTypes = [
        {
          id: 'dt1',
          data: () => ({
            name: 'Custom Diet',
            createdBy: 'user123',
            isArchived: false
          })
        }
      ];

      getDocs.mockResolvedValue({
        empty: false,
        docs: mockDietTypes
      });

      const result = await dietTypeService.getDietTypes('user123');

      expect(result).toBeInstanceOf(Array);
      expect(result.length).toBeGreaterThan(10); // System types + custom
      expect(result).toContain('Custom Diet');
      expect(result).toContain('Vegetarian');
    });

    it('should cache results for 5 minutes', async () => {
      getDocs.mockResolvedValue({ empty: false, docs: [] });

      // First call
      await dietTypeService.getDietTypes('user123');
      expect(getDocs).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      await dietTypeService.getDietTypes('user123');
      expect(getDocs).toHaveBeenCalledTimes(1); // Still 1, used cache
    });

    it('should filter archived diet types by default', async () => {
      const mockDietTypes = [
        {
          id: 'dt1',
          data: () => ({
            name: 'Active Diet',
            createdBy: 'user123',
            isArchived: false
          })
        },
        {
          id: 'dt2',
          data: () => ({
            name: 'Archived Diet',
            createdBy: 'user123',
            isArchived: true
          })
        }
      ];

      getDocs.mockResolvedValue({
        empty: false,
        docs: mockDietTypes
      });

      const result = await dietTypeService.getDietTypes('user123');

      expect(result).toContain('Active Diet');
      expect(result).not.toContain('Archived Diet');
    });

    it('should include archived diet types when option is set', async () => {
      const mockDietTypes = [
        {
          id: 'dt1',
          data: () => ({
            name: 'Active Diet',
            createdBy: 'user123',
            isArchived: false
          })
        },
        {
          id: 'dt2',
          data: () => ({
            name: 'Archived Diet',
            createdBy: 'user123',
            isArchived: true
          })
        }
      ];

      getDocs.mockResolvedValue({
        empty: false,
        docs: mockDietTypes
      });

      const result = await dietTypeService.getDietTypes('user123', { includeArchived: true });

      expect(result.some(dt => dt.name === 'Active Diet')).toBe(true);
      expect(result.some(dt => dt.name === 'Archived Diet')).toBe(true);
    });
  });

  describe('createDietType', () => {
    it('should create a new custom diet type', async () => {
      const dietTypeData = {
        name: 'Mediterranean',
        description: 'Mediterranean diet'
      };

      getDocs.mockResolvedValue({ empty: true, docs: [] });
      doc.mockReturnValue({ id: 'newDietTypeId' });
      setDoc.mockResolvedValue();

      const result = await dietTypeService.createDietType(dietTypeData, 'user123');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Mediterranean');
      expect(result).toHaveProperty('createdBy', 'user123');
      expect(setDoc).toHaveBeenCalled();
    });

    it('should throw error if diet type already exists', async () => {
      const dietTypeData = {
        name: 'Vegetarian'
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [{ id: 'existing', data: () => ({ name: 'Vegetarian' }) }]
      });

      await expect(
        dietTypeService.createDietType(dietTypeData, 'user123')
      ).rejects.toThrow('already exists');
    });

    it('should validate diet type name length', async () => {
      const dietTypeData = {
        name: '' // Empty name
      };

      await expect(
        dietTypeService.createDietType(dietTypeData, 'user123')
      ).rejects.toThrow();
    });

    it('should trim and normalize diet type name', async () => {
      const dietTypeData = {
        name: '  Mediterranean  '
      };

      getDocs.mockResolvedValue({ empty: true, docs: [] });
      doc.mockReturnValue({ id: 'newDietTypeId' });
      setDoc.mockResolvedValue();

      const result = await dietTypeService.createDietType(dietTypeData, 'user123');

      expect(result.name).toBe('Mediterranean'); // Trimmed
    });
  });

  describe('updateDietType', () => {
    it('should update a diet type with permission check', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Custom Diet',
          createdBy: 'user123',
          isArchived: false
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockDietType]
      });
      updateDoc.mockResolvedValue();

      const updates = {
        name: 'Updated Diet',
        description: 'New description'
      };

      const result = await dietTypeService.updateDietType('dt1', updates, 'user123');

      expect(result).toHaveProperty('name', 'Updated Diet');
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should prevent non-owner from updating diet type', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Custom Diet',
          createdBy: 'user123',
          isArchived: false
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockDietType]
      });

      await expect(
        dietTypeService.updateDietType('dt1', { name: 'Hacked' }, 'user456')
      ).rejects.toThrow('permission');
    });

    it('should prevent updating system diet types', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Vegetarian',
          createdBy: 'system',
          isArchived: false
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockDietType]
      });

      await expect(
        dietTypeService.updateDietType('dt1', { name: 'New Name' }, 'user123')
      ).rejects.toThrow('System diet types cannot be modified');
    });
  });

  describe('deleteDietType', () => {
    it('should soft delete a custom diet type', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Custom Diet',
          createdBy: 'user123',
          isArchived: false
        })
      };

      getDocs.mockResolvedValueOnce({
        empty: false,
        docs: [mockDietType]
      });

      // Mock recipes with this diet type
      getDocs.mockResolvedValueOnce({
        size: 5,
        docs: []
      });

      updateDoc.mockResolvedValue();

      const result = await dietTypeService.deleteDietType('dt1', 'user123');

      expect(result).toHaveProperty('affectedRecipes', 5);
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should prevent deleting system diet types', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Vegetarian',
          createdBy: 'system',
          isArchived: false
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockDietType]
      });

      await expect(
        dietTypeService.deleteDietType('dt1', 'user123')
      ).rejects.toThrow('System diet types cannot be deleted');
    });

    it('should prevent non-owner from deleting', async () => {
      const mockDietType = {
        id: 'dt1',
        data: () => ({
          name: 'Custom Diet',
          createdBy: 'user123',
          isArchived: false
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockDietType]
      });

      await expect(
        dietTypeService.deleteDietType('dt1', 'user456')
      ).rejects.toThrow('permission');
    });
  });

  describe('suggestDietTypes', () => {
    it('should suggest Vegan for plant-based ingredients', async () => {
      const ingredients = ['tofu', 'broccoli', 'quinoa', 'chickpeas'];

      const result = await dietTypeService.suggestDietTypes(ingredients);

      expect(result).toBeInstanceOf(Array);
      const veganSuggestion = result.find(s => s.dietType === 'Vegan');
      expect(veganSuggestion).toBeDefined();
      expect(veganSuggestion.confidence).toBe('high');
    });

    it('should suggest Gluten-Free when no gluten ingredients', async () => {
      const ingredients = ['rice', 'chicken', 'vegetables'];

      const result = await dietTypeService.suggestDietTypes(ingredients);

      const glutenFreeSuggestion = result.find(s => s.dietType === 'Gluten-Free');
      expect(glutenFreeSuggestion).toBeDefined();
    });

    it('should not suggest Vegan for meat ingredients', async () => {
      const ingredients = ['chicken', 'beef', 'pork'];

      const result = await dietTypeService.suggestDietTypes(ingredients);

      const veganSuggestion = result.find(s => s.dietType === 'Vegan');
      expect(veganSuggestion).toBeUndefined();
    });

    it('should provide reasons for suggestions', async () => {
      const ingredients = ['tofu', 'almond milk', 'quinoa'];

      const result = await dietTypeService.suggestDietTypes(ingredients);

      const veganSuggestion = result.find(s => s.dietType === 'Vegan');
      expect(veganSuggestion.reason).toBeTruthy();
      expect(veganSuggestion.reason.length).toBeGreaterThan(0);
    });

    it('should exclude already assigned diet types', async () => {
      const ingredients = ['tofu', 'vegetables'];
      const currentDietTypes = ['Vegan'];

      const result = await dietTypeService.suggestDietTypes(ingredients, currentDietTypes);

      const veganSuggestion = result.find(s => s.dietType === 'Vegan');
      expect(veganSuggestion).toBeUndefined();
    });
  });

  describe('searchDietTypes', () => {
    const mockDietTypes = ['Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low-Carb'];

    it('should return exact matches first', () => {
      const result = dietTypeService.searchDietTypes('vegan', mockDietTypes);

      expect(result[0]).toBe('Vegan');
    });

    it('should return starts-with matches second', () => {
      const result = dietTypeService.searchDietTypes('veg', mockDietTypes);

      expect(result[0]).toBe('Vegan');
      expect(result[1]).toBe('Vegetarian');
    });

    it('should return contains matches last', () => {
      const result = dietTypeService.searchDietTypes('carb', mockDietTypes);

      expect(result).toContain('Low-Carb');
    });

    it('should be case insensitive', () => {
      const result = dietTypeService.searchDietTypes('VEGAN', mockDietTypes);

      expect(result[0]).toBe('Vegan');
    });

    it('should return all diet types when search term is empty', () => {
      const result = dietTypeService.searchDietTypes('', mockDietTypes);

      expect(result).toEqual(mockDietTypes);
    });
  });

  describe('getUserPreferences', () => {
    it('should return user preferences', async () => {
      const mockPreference = {
        id: 'pref1',
        data: () => ({
          favorites: ['dt1', 'dt2'],
          hidden: ['dt3'],
          defaultDietTypes: ['dt1']
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockPreference]
      });

      const result = await dietTypeService.getUserPreferences('user123');

      expect(result).toHaveProperty('favorites');
      expect(result).toHaveProperty('hidden');
      expect(result).toHaveProperty('defaultDietTypes');
      expect(result.favorites).toEqual(['dt1', 'dt2']);
    });

    it('should return default preferences when none exist', async () => {
      getDocs.mockResolvedValue({
        empty: true,
        docs: []
      });

      const result = await dietTypeService.getUserPreferences('user123');

      expect(result).toEqual({
        favorites: [],
        hidden: [],
        defaultDietTypes: []
      });
    });
  });

  describe('addDietTypeToRecipe', () => {
    it('should add diet type to recipe dietTypes array', async () => {
      const mockRecipe = {
        id: 'recipe1',
        data: () => ({
          name: 'Test Recipe',
          userId: 'user123',
          dietTypes: ['Vegetarian']
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockRecipe]
      });
      updateDoc.mockResolvedValue();

      const result = await dietTypeService.addDietTypeToRecipe('recipe1', 'Vegan', 'user123');

      expect(result).toBe(true);
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should prevent adding duplicate diet types', async () => {
      const mockRecipe = {
        id: 'recipe1',
        data: () => ({
          name: 'Test Recipe',
          userId: 'user123',
          dietTypes: ['Vegan']
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockRecipe]
      });

      const result = await dietTypeService.addDietTypeToRecipe('recipe1', 'Vegan', 'user123');

      expect(result).toBe(true);
      expect(updateDoc).not.toHaveBeenCalled(); // No update needed
    });

    it('should prevent non-owner from modifying recipe', async () => {
      const mockRecipe = {
        id: 'recipe1',
        data: () => ({
          name: 'Test Recipe',
          userId: 'user123',
          dietTypes: []
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockRecipe]
      });

      await expect(
        dietTypeService.addDietTypeToRecipe('recipe1', 'Vegan', 'user456')
      ).rejects.toThrow('permission');
    });
  });

  describe('removeDietTypeFromRecipe', () => {
    it('should remove diet type from recipe', async () => {
      const mockRecipe = {
        id: 'recipe1',
        data: () => ({
          name: 'Test Recipe',
          userId: 'user123',
          dietTypes: ['Vegan', 'Gluten-Free']
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockRecipe]
      });
      updateDoc.mockResolvedValue();

      const result = await dietTypeService.removeDietTypeFromRecipe('recipe1', 'Vegan', 'user123');

      expect(result).toBe(true);
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should handle removing non-existent diet type', async () => {
      const mockRecipe = {
        id: 'recipe1',
        data: () => ({
          name: 'Test Recipe',
          userId: 'user123',
          dietTypes: ['Vegan']
        })
      };

      getDocs.mockResolvedValue({
        empty: false,
        docs: [mockRecipe]
      });

      const result = await dietTypeService.removeDietTypeFromRecipe('recipe1', 'Keto', 'user123');

      expect(result).toBe(true);
      expect(updateDoc).not.toHaveBeenCalled(); // No update needed
    });
  });

  describe('validateDietType', () => {
    it('should validate correct diet type data', () => {
      const dietTypeData = {
        name: 'Mediterranean',
        description: 'Mediterranean diet'
      };

      const result = dietTypeService.validateDietType(dietTypeData);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject missing name', () => {
      const dietTypeData = {
        description: 'Some description'
      };

      const result = dietTypeService.validateDietType(dietTypeData);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Name is required');
    });

    it('should reject name that is too long', () => {
      const dietTypeData = {
        name: 'A'.repeat(51) // 51 characters
      };

      const result = dietTypeService.validateDietType(dietTypeData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('50 characters'))).toBe(true);
    });

    it('should reject description that is too long', () => {
      const dietTypeData = {
        name: 'Test',
        description: 'A'.repeat(501) // 501 characters
      };

      const result = dietTypeService.validateDietType(dietTypeData);

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('500 characters'))).toBe(true);
    });
  });

  describe('Cache Management', () => {
    it('should clear cache', async () => {
      getDocs.mockResolvedValue({ empty: false, docs: [] });

      // First call
      await dietTypeService.getDietTypes('user123');
      expect(getDocs).toHaveBeenCalledTimes(1);

      // Clear cache
      dietTypeService.clearCache();

      // Second call should fetch again
      await dietTypeService.getDietTypes('user123');
      expect(getDocs).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after create', async () => {
      getDocs.mockResolvedValue({ empty: true, docs: [] });
      doc.mockReturnValue({ id: 'newDietTypeId' });
      setDoc.mockResolvedValue();

      // First call to populate cache
      await dietTypeService.getDietTypes('user123');

      // Create new diet type
      await dietTypeService.createDietType({ name: 'New Diet' }, 'user123');

      // Next call should fetch fresh data
      await dietTypeService.getDietTypes('user123');

      // getDocs should be called 3 times: initial fetch, create check, post-create fetch
      expect(getDocs).toHaveBeenCalledTimes(3);
    });
  });
});
