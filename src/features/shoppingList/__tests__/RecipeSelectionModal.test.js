import { baseServings, clampServings, recipeTitle } from '../components/RecipeSelectionModal';
import { buildItemsFromRecipe } from '../../../services/shoppingList/buildShoppingList';

jest.mock('../../../firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(), getDocs: jest.fn(), query: jest.fn(), where: jest.fn(),
}));

describe('shopping list Add Recipe modal servings', () => {
  test('string servings from forms are numbers, so + is 5 not "41"', () => {
    const recipe = { servings: '4' };
    const start = baseServings(recipe);
    expect(start).toBe(4);
    expect(clampServings(start + 1)).toBe(5);
  });
  test('unusual servings values', () => {
    expect(baseServings({ servings: '4-6' })).toBe(4);
    expect(baseServings({ servings: '4 servings' })).toBe(4);
    expect(baseServings({ servings: '' })).toBe(1);
    expect(clampServings('abc')).toBe(1);
    expect(clampServings(0)).toBe(1);
    expect(clampServings(500)).toBe(99);
  });
  test('the amounts added scale by servings / yield', () => {
    const recipe = { servings: '4', ingredients: [{ ingredientId: 'carrot', amount: '2', unit: '' }] };
    expect(buildItemsFromRecipe(recipe, clampServings(baseServings(recipe) + 1))[0].quantityText).toBe('2 1/2');
  });
  test('recipes use title', () => {
    expect(recipeTitle({ title: 'Cake' })).toBe('Cake');
    expect(recipeTitle({ name: 'Old' })).toBe('Old');
  });
});
