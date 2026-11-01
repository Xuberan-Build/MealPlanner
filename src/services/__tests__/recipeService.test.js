import { getRecipes, addRecipe, updateRecipe } from '../recipeService';

jest.mock('../../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
jest.mock('../userMetricsService', () => ({ trackRecipeAdded: jest.fn(), trackRecipeViewed: jest.fn() }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'recipes-ref'),
  query: jest.fn(() => 'query'),
  where: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn((db, col, id) => ({ path: `${col}/${id}` })),
  serverTimestamp: jest.fn(() => 'now'),
  orderBy: jest.fn(),
}));

const firestore = require('firebase/firestore');

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => console.log.mockRestore());

test('the document id wins over a stale `id` stored inside a copied recipe', async () => {
  firestore.getDocs.mockResolvedValue({
    docs: [
      { id: 'orig', data: () => ({ title: 'Lemon Chicken Orzo', userId: 'u1' }) },
      // A copy that was saved with the original's id inside its data.
      { id: 'copy', data: () => ({ id: 'orig', title: 'Lemon Chicken Orzo', userId: 'u1' }) },
    ],
  });
  const recipes = await getRecipes();
  expect(recipes.map((r) => r.id)).toEqual(['orig', 'copy']);
});

test('saving never stores an `id` field', async () => {
  firestore.addDoc.mockResolvedValue({ id: 'new-doc' });
  await addRecipe({ id: 'orig', title: 'Copy of Orzo', servings: '4' });
  const stored = firestore.addDoc.mock.calls[0][1];
  expect(stored).not.toHaveProperty('id');
  expect(stored).toMatchObject({ title: 'Copy of Orzo', userId: 'u1' });

  firestore.getDoc.mockResolvedValue({ exists: () => true, data: () => ({ userId: 'u1' }) });
  firestore.updateDoc.mockResolvedValue();
  await updateRecipe('orig', { id: 'something-else', title: 'Renamed' });
  const updated = firestore.updateDoc.mock.calls[0][1];
  expect(updated).not.toHaveProperty('id');
  expect(updated.title).toBe('Renamed');
});
