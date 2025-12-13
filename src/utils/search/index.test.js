/**
 * Tests for Search Orchestrator
 */

import {
  searchRecipes,
  groupSearchResults,
  getSearchSuggestions,
  filterRecipes,
  searchAndFilter
} from './index';

describe('Search Orchestrator', () => {
  const mockRecipes = [
    {
      id: '1',
      title: 'Chicken Parmesan',
      dietType: 'Keto',
      mealType: 'Dinner',
      ingredients: ['chicken breast', 'parmesan cheese', 'marinara sauce']
    },
    {
      id: '2',
      title: 'Creamy Dijon Chicken',
      dietType: 'Keto',
      mealType: 'Dinner',
      ingredients: ['chicken breast', 'dijon mustard', 'cream']
    },
    {
      id: '3',
      title: 'Beef Stew',
      dietType: 'Paleo',
      mealType: 'Dinner',
      ingredients: ['beef', 'carrots', 'potatoes']
    },
    {
      id: '4',
      title: 'Vegan Chickpea Curry',
      dietType: 'Vegan',
      mealType: 'Lunch',
      ingredients: ['chickpeas', 'coconut milk', 'curry powder']
    },
    {
      id: '5',
      title: 'Grilled Chicken Salad',
      dietType: 'Paleo',
      mealType: 'Lunch',
      ingredients: ['chicken breast', 'lettuce', 'tomatoes']
    }
  ];

  describe('searchRecipes', () => {
    test('returns all recipes when no search term provided', () => {
      const results = searchRecipes(mockRecipes, '');
      expect(results).toHaveLength(mockRecipes.length);
    });

    test('returns empty array for null/undefined recipes', () => {
      expect(searchRecipes(null, 'chicken')).toEqual([]);
      expect(searchRecipes(undefined, 'chicken')).toEqual([]);
    });

    test('filters and sorts recipes by relevance', () => {
      const results = searchRecipes(mockRecipes, 'chicken');

      // Should return 3 chicken recipes
      expect(results).toHaveLength(3);

      // Should be sorted by score
      // "Chicken Parmesan" starts with "chicken" = highest score
      expect(results[0].title).toBe('Chicken Parmesan');
    });

    test('exact title match scores highest', () => {
      const results = searchRecipes(mockRecipes, 'beef stew', {
        includeScores: true
      });

      expect(results[0].title).toBe('Beef Stew');
      expect(results[0]._searchScore).toBeGreaterThan(0);
    });

    test('sorts by title alphabetically when scores are equal', () => {
      const results = searchRecipes(mockRecipes, 'dinner');

      // All have same score (meal type match), should be alphabetical
      const titles = results.map(r => r.title);
      const sortedTitles = [...titles].sort();
      expect(titles).toEqual(sortedTitles);
    });

    test('includes score metadata when requested', () => {
      const results = searchRecipes(mockRecipes, 'chicken', {
        includeScores: true
      });

      expect(results[0]._searchScore).toBeDefined();
      expect(results[0]._searchMatches).toBeDefined();
      expect(results[0]._matchDetails).toBeDefined();
    });

    test('excludes score metadata by default', () => {
      const results = searchRecipes(mockRecipes, 'chicken');

      expect(results[0]._searchScore).toBeUndefined();
      expect(results[0]._searchMatches).toBeUndefined();
      expect(results[0]._matchDetails).toBeUndefined();
    });

    test('matches ingredients', () => {
      const results = searchRecipes(mockRecipes, 'dijon');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Creamy Dijon Chicken');
    });

    test('matches diet type', () => {
      const results = searchRecipes(mockRecipes, 'vegan');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Vegan Chickpea Curry');
    });

    test('uses context-specific configuration', () => {
      const results = searchRecipes(mockRecipes, 'chicken', {
        context: 'MEAL_PLANNER'
      });

      // Should work with any valid context
      expect(results.length).toBeGreaterThan(0);
    });

    test('word boundary matching works correctly', () => {
      const results = searchRecipes(mockRecipes, 'chick');

      // Should match "chickpea" and all "chicken" recipes
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('groupSearchResults', () => {
    test('groups recipes by specified field', () => {
      const recipes = [mockRecipes[0], mockRecipes[1], mockRecipes[2]];
      const grouped = groupSearchResults(recipes, 'dietType');

      expect(grouped).toHaveProperty('Keto');
      expect(grouped).toHaveProperty('Paleo');
      expect(grouped.Keto).toHaveLength(2);
      expect(grouped.Paleo).toHaveLength(1);
    });

    test('handles recipes with missing groupBy field', () => {
      const recipes = [
        { id: '1', title: 'Recipe 1', dietType: 'Keto' },
        { id: '2', title: 'Recipe 2' } // No dietType
      ];
      const grouped = groupSearchResults(recipes, 'dietType');

      expect(grouped).toHaveProperty('Uncategorized');
      expect(grouped.Uncategorized).toHaveLength(1);
    });

    test('returns empty object for null recipes', () => {
      expect(groupSearchResults(null, 'dietType')).toEqual({});
      expect(groupSearchResults(undefined, 'dietType')).toEqual({});
    });

    test('returns empty object for empty array', () => {
      expect(groupSearchResults([], 'dietType')).toEqual({});
    });

    test('groups by different fields', () => {
      const grouped = groupSearchResults(mockRecipes, 'mealType');

      expect(grouped).toHaveProperty('Dinner');
      expect(grouped).toHaveProperty('Lunch');
      expect(grouped.Dinner.length).toBeGreaterThan(0);
      expect(grouped.Lunch.length).toBeGreaterThan(0);
    });
  });

  describe('getSearchSuggestions', () => {
    test('returns limited number of suggestions', () => {
      const suggestions = getSearchSuggestions(mockRecipes, 'chicken', 2);

      expect(suggestions).toHaveLength(2);
    });

    test('returns recipe titles sorted by relevance', () => {
      const suggestions = getSearchSuggestions(mockRecipes, 'chicken');

      expect(suggestions[0]).toBe('Chicken Parmesan');
      expect(suggestions).toContain('Creamy Dijon Chicken');
    });

    test('returns empty array for no matches', () => {
      const suggestions = getSearchSuggestions(mockRecipes, 'pizza');

      expect(suggestions).toEqual([]);
    });

    test('returns empty array for empty search term', () => {
      const suggestions = getSearchSuggestions(mockRecipes, '');

      expect(suggestions).toEqual([]);
    });

    test('filters out null/undefined titles', () => {
      const recipesWithNulls = [
        ...mockRecipes,
        { id: '99', title: null, ingredients: [] }
      ];
      const suggestions = getSearchSuggestions(recipesWithNulls, 'chicken');

      // Should not include null titles
      expect(suggestions.every(s => s !== null && s !== undefined)).toBe(true);
    });

    test('uses default max of 5 suggestions', () => {
      const manyRecipes = [
        ...mockRecipes,
        { id: '6', title: 'Chicken Tikka', dietType: 'Keto', ingredients: [] },
        { id: '7', title: 'Chicken Wings', dietType: 'Keto', ingredients: [] },
        { id: '8', title: 'Chicken Soup', dietType: 'Paleo', ingredients: [] }
      ];
      const suggestions = getSearchSuggestions(manyRecipes, 'chicken');

      expect(suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  describe('filterRecipes', () => {
    test('filters recipes that match search term', () => {
      const results = filterRecipes(mockRecipes, 'chicken');

      expect(results.length).toBeGreaterThan(0);
      results.forEach(recipe => {
        const titleMatch = recipe.title.toLowerCase().includes('chicken');
        const hasChickenIngredient = recipe.ingredients?.some(ing =>
          ing.toLowerCase().includes('chicken')
        );
        expect(titleMatch || hasChickenIngredient).toBe(true);
      });
    });

    test('returns all recipes for empty search term', () => {
      const results = filterRecipes(mockRecipes, '');

      expect(results).toHaveLength(mockRecipes.length);
    });

    test('returns empty array for null recipes', () => {
      expect(filterRecipes(null, 'chicken')).toEqual([]);
    });
  });

  describe('searchAndFilter', () => {
    test('combines search and filters', () => {
      const result = searchAndFilter(
        mockRecipes,
        'chicken',
        { dietTypes: ['Keto'] },
        { context: 'RECIPE_BOOK' }
      );

      expect(result.results).toHaveLength(2);
      expect(result.results.every(r => r.dietType === 'Keto')).toBe(true);
    });

    test('filters by multiple diet types', () => {
      const result = searchAndFilter(
        mockRecipes,
        'chicken',
        { dietTypes: ['Keto', 'Paleo'] }
      );

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results.every(r =>
        ['Keto', 'Paleo'].includes(r.dietType)
      )).toBe(true);
    });

    test('filters by meal types', () => {
      const result = searchAndFilter(
        mockRecipes,
        '',
        { mealTypes: ['Lunch'] }
      );

      expect(result.results.every(r => r.mealType === 'Lunch')).toBe(true);
    });

    test('returns grouped results when context specifies', () => {
      const result = searchAndFilter(
        mockRecipes,
        'chicken',
        {},
        { context: 'RECIPE_BOOK' }
      );

      expect(result.grouped).toBeDefined();
      expect(typeof result.grouped).toBe('object');
    });

    test('returns result count', () => {
      const result = searchAndFilter(mockRecipes, 'chicken');

      expect(result.resultCount).toBe(result.results.length);
    });

    test('handles empty filters', () => {
      const result = searchAndFilter(mockRecipes, 'chicken', {});

      expect(result.results.length).toBe(3); // All chicken recipes
    });
  });

  describe('Integration Tests', () => {
    test('end-to-end recipe search workflow', () => {
      // Search
      const searchResults = searchRecipes(mockRecipes, 'chicken', {
        includeScores: true
      });

      // Verify results are scored and sorted
      expect(searchResults.length).toBeGreaterThan(0);
      expect(searchResults[0]._searchScore).toBeGreaterThan(0);

      // Group results
      const grouped = groupSearchResults(searchResults, 'dietType');
      expect(Object.keys(grouped).length).toBeGreaterThan(0);

      // Get suggestions
      const suggestions = getSearchSuggestions(mockRecipes, 'chick');
      expect(suggestions.length).toBeGreaterThan(0);
    });

    test('handles case sensitivity consistently', () => {
      const lower = searchRecipes(mockRecipes, 'chicken');
      const upper = searchRecipes(mockRecipes, 'CHICKEN');
      const mixed = searchRecipes(mockRecipes, 'ChIcKeN');

      expect(lower.length).toBe(upper.length);
      expect(lower.length).toBe(mixed.length);
    });

    test('relevance ranking is consistent', () => {
      const results = searchRecipes(mockRecipes, 'chicken', {
        includeScores: true
      });

      // Scores should be in descending order
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]._searchScore).toBeGreaterThanOrEqual(
          results[i]._searchScore
        );
      }
    });
  });
});
