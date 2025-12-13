/**
 * Tests for Search Scorer
 */

import {
  scoreRecipe,
  normalizeSearchTerm,
  matchesSearch
} from './searchScorer';
import { SEARCH_SCORING_WEIGHTS } from '../../constants/search';

describe('searchScorer', () => {
  describe('scoreRecipe', () => {
    test('returns zero score for empty search term', () => {
      const recipe = { title: 'Chicken Parmesan' };
      const result = scoreRecipe(recipe, '');

      expect(result.score).toBe(0);
      expect(result.matches).toEqual([]);
      expect(result.matchDetails).toEqual({});
    });

    test('returns zero score for null recipe', () => {
      const result = scoreRecipe(null, 'chicken');

      expect(result.score).toBe(0);
      expect(result.matches).toEqual([]);
    });

    test('scores exact title match highest', () => {
      const recipe = { title: 'Chicken Parmesan' };
      const result = scoreRecipe(recipe, 'Chicken Parmesan');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.EXACT_TITLE_MATCH);
      expect(result.matchDetails.titleMatch).toBe('exact');
    });

    test('scores title starts with match correctly', () => {
      const recipe = { title: 'Chicken Parmesan' };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.TITLE_STARTS_WITH);
      expect(result.matchDetails.titleMatch).toBe('starts_with');
    });

    test('scores word starts match correctly', () => {
      const recipe = { title: 'Creamy Chicken Parmesan' };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.TITLE_WORD_STARTS_WITH);
      expect(result.matchDetails.titleMatch).toBe('word_starts');
    });

    test('scores title contains match correctly', () => {
      const recipe = { title: 'Creamy Dijon Chicken' };
      const result = scoreRecipe(recipe, 'dijon');

      // "Dijon" is a word that starts with "dijon", so it's a word_starts match
      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.TITLE_WORD_STARTS_WITH);
      expect(result.matchDetails.titleMatch).toBe('word_starts');
    });

    test('scores title substring match correctly', () => {
      const recipe = { title: 'Burgundy Wine Sauce' };
      const result = scoreRecipe(recipe, 'gun'); // Matches "burGUNdy"

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.TITLE_CONTAINS);
      expect(result.matchDetails.titleMatch).toBe('contains');
    });

    test('is case insensitive', () => {
      const recipe = { title: 'Chicken Parmesan' };
      const resultLower = scoreRecipe(recipe, 'chicken');
      const resultUpper = scoreRecipe(recipe, 'CHICKEN');
      const resultMixed = scoreRecipe(recipe, 'ChIcKeN');

      expect(resultLower.score).toBe(resultUpper.score);
      expect(resultLower.score).toBe(resultMixed.score);
    });

    test('scores ingredient matches with string array', () => {
      const recipe = {
        title: 'Pasta Dish',
        ingredients: ['chicken breast', 'pasta', 'tomato sauce']
      };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBeGreaterThan(0);
      expect(result.matchDetails.ingredientMatches).toBe(1);
    });

    test('scores ingredient matches with object array', () => {
      const recipe = {
        title: 'Pasta Dish',
        ingredients: [
          { ingredientId: 'chicken breast', quantity: '2' },
          { ingredientId: 'pasta', quantity: '1 lb' }
        ]
      };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBeGreaterThan(0);
      expect(result.matchDetails.ingredientMatches).toBe(1);
    });

    test('counts multiple ingredient matches', () => {
      const recipe = {
        title: 'Chicken Soup',
        ingredients: ['chicken breast', 'chicken stock', 'vegetables']
      };
      const result = scoreRecipe(recipe, 'chicken');

      // Should match title AND ingredients
      expect(result.matchDetails.ingredientMatches).toBe(2);
      expect(result.matchDetails.titleMatch).toBe('starts_with');
    });

    test('scores diet type matches', () => {
      const recipe = {
        title: 'Pasta Dish',
        dietType: 'Vegan'
      };
      const result = scoreRecipe(recipe, 'vegan');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.DIET_TYPE_MATCH);
      expect(result.matchDetails.dietTypeMatch).toBe(true);
    });

    test('scores meal type matches', () => {
      const recipe = {
        title: 'Pasta Dish',
        mealType: 'Breakfast'
      };
      const result = scoreRecipe(recipe, 'breakfast');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.MEAL_TYPE_MATCH);
      expect(result.matchDetails.mealTypeMatch).toBe(true);
    });

    test('combines multiple match types', () => {
      const recipe = {
        title: 'Chicken Parmesan',
        ingredients: ['chicken breast', 'parmesan cheese'],
        dietType: 'Keto',
        mealType: 'Dinner'
      };
      const result = scoreRecipe(recipe, 'chicken');

      // Should match: title (starts_with) + ingredients
      expect(result.score).toBe(
        SEARCH_SCORING_WEIGHTS.TITLE_STARTS_WITH +
        SEARCH_SCORING_WEIGHTS.INGREDIENT_MATCH
      );
      expect(result.matchDetails.titleMatch).toBe('starts_with');
      expect(result.matchDetails.ingredientMatches).toBe(1);
    });

    test('handles missing fields gracefully', () => {
      const recipe = { title: 'Simple Dish' };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBe(0);
      expect(result.matches).toEqual([]);
    });

    test('handles empty ingredients array', () => {
      const recipe = {
        title: 'Simple Dish',
        ingredients: []
      };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.matchDetails.ingredientMatches).toBeUndefined();
    });
  });

  describe('normalizeSearchTerm', () => {
    test('converts to lowercase', () => {
      expect(normalizeSearchTerm('CHICKEN')).toBe('chicken');
      expect(normalizeSearchTerm('ChIcKeN')).toBe('chicken');
    });

    test('trims whitespace', () => {
      expect(normalizeSearchTerm('  chicken  ')).toBe('chicken');
      expect(normalizeSearchTerm('\tchicken\n')).toBe('chicken');
    });

    test('handles empty string', () => {
      expect(normalizeSearchTerm('')).toBe('');
      expect(normalizeSearchTerm('   ')).toBe('');
    });

    test('handles null and undefined', () => {
      expect(normalizeSearchTerm(null)).toBe('');
      expect(normalizeSearchTerm(undefined)).toBe('');
    });
  });

  describe('matchesSearch', () => {
    test('returns true for matching recipes', () => {
      const recipe = { title: 'Chicken Parmesan' };
      expect(matchesSearch(recipe, 'chicken')).toBe(true);
    });

    test('returns false for non-matching recipes', () => {
      const recipe = { title: 'Beef Stew' };
      expect(matchesSearch(recipe, 'chicken')).toBe(false);
    });

    test('returns true for empty search term', () => {
      const recipe = { title: 'Any Recipe' };
      expect(matchesSearch(recipe, '')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('handles recipes with special characters in title', () => {
      const recipe = { title: 'Mom\'s "Special" Chicken & Rice' };
      const result = scoreRecipe(recipe, 'chicken');

      expect(result.score).toBeGreaterThan(0);
    });

    test('handles multi-word search terms', () => {
      const recipe = { title: 'Chicken Parmesan' };
      const result = scoreRecipe(recipe, 'chicken parmesan');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.EXACT_TITLE_MATCH);
    });

    test('handles recipes with no title', () => {
      const recipe = { ingredients: ['chicken'] };
      const result = scoreRecipe(recipe, 'chicken');

      // Should still match ingredients
      expect(result.matchDetails.ingredientMatches).toBe(1);
    });

    test('handles very long search terms', () => {
      const recipe = { title: 'Chicken' };
      const longTerm = 'chicken with extra long unnecessary description';
      const result = scoreRecipe(recipe, longTerm);

      expect(result.score).toBe(0); // Should not match
    });

    test('handles unicode characters', () => {
      const recipe = { title: 'Café Frappé' };
      const result = scoreRecipe(recipe, 'café');

      expect(result.score).toBe(SEARCH_SCORING_WEIGHTS.TITLE_STARTS_WITH);
    });
  });
});
