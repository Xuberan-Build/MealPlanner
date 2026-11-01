import {
  nextStockAfterPurchase,
  recordPurchases,
  undoPurchase,
  markHave,
  markNeed,
  updatePantryItem,
} from '../pantryService';
import { updateDoc, deleteDoc, addDoc, getDocs, doc, serverTimestamp } from 'firebase/firestore';

jest.mock('../../firebase', () => ({ db: {}, auth: { currentUser: { uid: 'u1' } } }));
jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => 'col'),
  doc: jest.fn((db, col, id) => ({ id })),
  addDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  getDocs: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  serverTimestamp: jest.fn(() => 'TS'),
}));

const snapOf = (docs) => ({
  forEach: (fn) => docs.forEach((d) => fn({ id: d.id, data: () => { const { id, ...rest } = d; return rest; } })),
});

beforeEach(() => {
  // CRA resets mock implementations before every test.
  doc.mockImplementation((db, col, id) => ({ id }));
  serverTimestamp.mockImplementation(() => 'TS');
  updateDoc.mockResolvedValue();
  deleteDoc.mockResolvedValue();
  addDoc.mockResolvedValue({ id: 'new-1' });
  getDocs.mockResolvedValue(snapOf([]));
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('nextStockAfterPurchase', () => {
  test('nothing in the pantry: the bought amount, flagged for the list', () => {
    expect(nextStockAfterPurchase(null, 2, 'cup', 'L1')).toEqual({ quantity: 2, unit: 'cup', fromPurchase: true, purchasedForListId: 'L1' });
  });
  test('user-entered amount is not inflated by buying for a list', () => {
    expect(nextStockAfterPurchase({ quantity: 1, unit: 'lb', fromPurchase: false }, 2, 'tbsp', 'L1')).toBeNull();
  });
  test('stock bought for another list is replaced (that one was used by its meals)', () => {
    expect(nextStockAfterPurchase({ quantity: 2, unit: 'cup', fromPurchase: true, purchasedForListId: 'L0' }, 2, 'cup', 'L1'))
      .toEqual({ quantity: 2, unit: 'cup', fromPurchase: true, purchasedForListId: 'L1' });
  });
  test('ran out (0) becomes the bought amount', () => {
    expect(nextStockAfterPurchase({ quantity: 0, unit: null }, 3, null, 'L1')).toMatchObject({ quantity: 3, fromPurchase: true });
  });
});

describe('recordPurchases / undoPurchase', () => {
  test('a new pantry doc is created and undo deletes it', async () => {
    const { records, saved } = await recordPurchases([{ name: 'Garlic', quantity: 2, unit: 'clove', listId: 'L1' }]);
    expect(records).toEqual([{ pantryId: 'new-1', created: true, previous: null }]);
    expect(saved[0]).toMatchObject({ quantity: 2, unit: 'clove', fromPurchase: true, purchasedForListId: 'L1' });
    await expect(undoPurchase(records[0])).resolves.toEqual({ removedId: 'new-1' });
    expect(deleteDoc).toHaveBeenCalledWith({ id: 'new-1' });
  });

  test('an updated doc gets its previous state back on undo', async () => {
    getDocs.mockResolvedValue(snapOf([{ id: 'p1', key: 'milk', name: 'Milk', quantity: 0, unit: null }]));
    const { records } = await recordPurchases([{ name: 'milk', quantity: 2, unit: 'cup', listId: 'L1' }]);
    expect(records[0]).toMatchObject({ pantryId: 'p1', created: false, previous: { quantity: 0, unit: null } });
    const res = await undoPurchase(records[0]);
    expect(res.saved).toMatchObject({ id: 'p1', quantity: 0, unit: null, fromPurchase: false });
  });
});

describe('markHave / markNeed never destroy pantry data', () => {
  test('markHave keeps a known amount', async () => {
    const match = { id: 'p1', name: 'Milk', quantity: 100, unit: 'ml' };
    await expect(markHave({ name: 'Milk' }, match)).resolves.toBe(match);
    expect(updateDoc).not.toHaveBeenCalled();
  });
  test('markHave on a run-out item puts it back in stock', async () => {
    const r = await markHave({ name: 'Milk' }, { id: 'p1', name: 'Milk', quantity: 0 });
    expect(r.quantity).toBeNull();
    expect(updateDoc).toHaveBeenCalledWith({ id: 'p1' }, expect.objectContaining({ quantity: null }));
  });
  test('markNeed never deletes; a user amount is left alone', async () => {
    const match = { id: 'p1', name: 'Butter', quantity: 1, unit: 'lb' };
    await expect(markNeed(match)).resolves.toBe(match);
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  });
  test('markNeed on unquantified stock marks it run out', async () => {
    const r = await markNeed({ id: 'p2', name: 'Rice', quantity: null });
    expect(r.quantity).toBe(0);
    expect(deleteDoc).not.toHaveBeenCalled();
  });
  test('editing an amount confirms it as the user\'s own stock', async () => {
    const updates = await updatePantryItem('p1', { quantity: 2, unit: 'cup' });
    expect(updates).toMatchObject({ quantity: 2, unit: 'cup', fromPurchase: false, purchasedForListId: null });
  });
});
