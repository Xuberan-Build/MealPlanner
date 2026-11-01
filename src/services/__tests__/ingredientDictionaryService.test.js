import {
  applyCachedIngredientDictionary,
  loadIngredientDictionary,
  isCurrentUserAdmin,
  saveAlias,
  setAliasEnabled,
  suggestAlias,
  resolveSuggestion,
  entryIdFor,
} from '../ingredientDictionaryService';
import { resolveIngredientKey, resetIngredientAliasesForTests } from '../../utils/ingredientAliases';

jest.mock('../../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'admin-1' } } }));
jest.mock('firebase/firestore', () => ({
  addDoc: jest.fn(),
  collection: jest.fn((db, name) => name),
  doc: jest.fn((db, col, id) => `${col}/${id}`),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn((c) => c),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => 'now'),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

const firestore = require('firebase/firestore');
const snap = (id, data) => ({ id, data: () => data });

// CRA resets mock implementations before every test, so set them here.
beforeEach(() => {
  firestore.collection.mockImplementation((db, name) => name);
  firestore.doc.mockImplementation((db, col, id) => `${col}/${id}`);
  firestore.query.mockImplementation((c) => c);
  firestore.serverTimestamp.mockImplementation(() => 'now');
  localStorage.clear();
  resetIngredientAliasesForTests();
  firestore.getDocs.mockResolvedValue({ docs: [] });
  firestore.setDoc.mockResolvedValue();
  firestore.updateDoc.mockResolvedValue();
  firestore.addDoc.mockResolvedValue({ id: 's1' });
});

test('loading applies the shared dictionary for everyone and caches it', async () => {
  firestore.getDocs.mockResolvedValue({
    docs: [snap('jumbo-oat', { alias: 'jumbo oat', canonical: 'rolled oat', enabled: true })],
  });
  await loadIngredientDictionary();
  expect(resolveIngredientKey('jumbo oat')).toBe('rolled oat');

  // A fresh start uses the cache synchronously, before the network.
  resetIngredientAliasesForTests();
  expect(resolveIngredientKey('jumbo oat')).toBe('jumbo oat');
  applyCachedIngredientDictionary();
  expect(resolveIngredientKey('jumbo oat')).toBe('rolled oat');
});

test('a failed load keeps the aliases already in effect', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  firestore.getDocs.mockRejectedValue(new Error('offline'));
  expect(await loadIngredientDictionary()).toBeNull();
  expect(resolveIngredientKey('old fashioned oat')).toBe('rolled oat'); // built-in still works
  warn.mockRestore();
});

test('admin check reads admins/{uid}', async () => {
  firestore.getDoc.mockResolvedValue({ exists: () => true });
  expect(await isCurrentUserAdmin()).toBe(true);
  expect(firestore.doc).toHaveBeenCalledWith({}, 'admins', 'admin-1');
  firestore.getDoc.mockRejectedValue(new Error('denied'));
  expect(await isCurrentUserAdmin()).toBe(false);
});

test('saving stores normalized keys and refuses loops', async () => {
  await saveAlias({ alias: 'Jumbo Oats', canonical: 'Rolled Oats', note: 'UK name' });
  expect(firestore.setDoc).toHaveBeenCalledWith(
    'ingredientDictionary/jumbo-oat',
    expect.objectContaining({ alias: 'jumbo oat', canonical: 'rolled oat', enabled: true, note: 'UK name', updatedBy: 'admin-1' }),
    { merge: true }
  );
  await expect(saveAlias({ alias: 'rolled oats', canonical: 'old fashioned oats' })).rejects.toThrow(/loop/);
  expect(entryIdFor('old fashioned oat')).toBe('old-fashioned-oat');
});

test('switching off writes enabled:false (nothing is deleted)', async () => {
  await setAliasEnabled('Garbanzo Beans', false, 'chickpea');
  expect(firestore.setDoc).toHaveBeenCalledWith(
    'ingredientDictionary/garbanzo-bean',
    expect.objectContaining({ alias: 'garbanzo bean', canonical: 'chickpea', enabled: false }),
    { merge: true }
  );
});

test('users suggest; approving saves the alias and marks the suggestion', async () => {
  expect(await suggestAlias({ alias: 'Porridge Oats', canonical: 'rolled oats', context: 'renamed on list' })).toBe('s1');
  expect(firestore.addDoc.mock.calls[0][1]).toMatchObject({
    alias: 'porridge oat', canonical: 'rolled oat', suggestedBy: 'admin-1', status: 'pending',
  });
  expect(await suggestAlias({ alias: 'rice', canonical: 'Rice' })).toBeNull(); // same thing

  await resolveSuggestion({ id: 's1', alias: 'porridge oat', canonical: 'rolled oat' }, true);
  expect(firestore.setDoc).toHaveBeenCalledWith('ingredientDictionary/porridge-oat', expect.objectContaining({ canonical: 'rolled oat' }), { merge: true });
  expect(firestore.updateDoc).toHaveBeenCalledWith('ingredientAliasSuggestions/s1', expect.objectContaining({ status: 'approved' }));

  await resolveSuggestion({ id: 's2', alias: 'x', canonical: 'y' }, false);
  expect(firestore.updateDoc).toHaveBeenLastCalledWith('ingredientAliasSuggestions/s2', expect.objectContaining({ status: 'rejected' }));
});
