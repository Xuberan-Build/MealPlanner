import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ShoppingListPage from '../ShoppingListPage';
import * as listService from '../../../services/ShoppingListService';
import * as pantryService from '../../../services/pantryService';

jest.mock('../../../components/layout/Header', () => () => null);
jest.mock('../../../components/layout/BottomNav', () => () => null);
jest.mock('../components/QuickAddBar', () => ({ onItemAdd }) => (
  <button type="button" onClick={() => onItemAdd('2 lb chicken breast')}>quick add chicken</button>
));
jest.mock('../components/CommonItemsBar', () => () => null);
jest.mock('../components/SavedShoppingLists', () => () => null);
jest.mock('../components/RecipeSelectionModal', () => (props) => {
  global.__recipeModalProps = props;
  return null;
});
jest.mock('../components/ProductPreferencesSettings', () => () => null);
jest.mock('../components/ProductMatchModal', () => () => null);
jest.mock('../components/TemplateLibrary', () => () => null);
jest.mock('../components/CreateTemplateModal', () => () => null);
jest.mock('../../../services/ShoppingListService', () => ({
  getUserShoppingLists: jest.fn(() => Promise.resolve([])),
  createShoppingList: jest.fn(() => Promise.resolve('list-1')),
  updateShoppingList: jest.fn(() => Promise.resolve()),
  findListForMealPlan: jest.fn(() => Promise.resolve(null)),
  linkListToMealPlan: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../services/pantryService', () => ({
  getPantry: jest.fn(),
  recordPurchases: jest.fn(() => Promise.resolve({ saved: [], records: [] })),
  undoPurchase: jest.fn(() => Promise.resolve(null)),
  markHave: jest.fn((item) => Promise.resolve({ id: 'new', name: item.name, quantity: null })),
  markNeed: jest.fn(() => Promise.resolve(null)),
}));
jest.mock('../../../services/productMatchingService', () => ({ matchItemsBatch: jest.fn(() => Promise.resolve(new Map())) }));
jest.mock('../../../services/userProductPreferencesService', () => ({ getUserPreferences: jest.fn(() => Promise.resolve({})) }));
jest.mock('../../../services/commonItemsService', () => ({
  trackItemUsage: jest.fn(),
  getCommonItems: jest.fn(() => Promise.resolve([])),
}));

const mealPlan = {
  monday: {
    dinner: {
      recipe: {
        id: 'r1',
        title: 'Tacos',
        servings: '4',
        ingredients: [
          { ingredientId: 'Garlic cloves', amount: '2', unit: 'cloves' },
          { ingredientId: 'olive oil', amount: '2', unit: 'tbsp' },
          { ingredientId: 'salt', amount: '', unit: '' },
        ],
      },
      servings: 8,
    },
  },
};

const productMatching = require('../../../services/productMatchingService');
const prefs = require('../../../services/userProductPreferencesService');
const common = require('../../../services/commonItemsService');

beforeEach(() => {
  // CRA's jest config resets mock implementations before every test.
  listService.getUserShoppingLists.mockResolvedValue([]);
  listService.createShoppingList.mockResolvedValue('list-1');
  listService.updateShoppingList.mockResolvedValue();
  listService.findListForMealPlan.mockResolvedValue(null);
  listService.linkListToMealPlan.mockResolvedValue();
  pantryService.recordPurchases.mockImplementation((items) => Promise.resolve({
    saved: [],
    records: items.map((it, i) => ({ pantryId: `pp-${it.name}-${i}`, created: true, previous: null })),
  }));
  pantryService.undoPurchase.mockResolvedValue(null);
  pantryService.markHave.mockImplementation((item) => Promise.resolve({ id: 'new', name: item.name, quantity: null }));
  pantryService.markNeed.mockResolvedValue(null);
  productMatching.matchItemsBatch.mockResolvedValue(new Map());
  prefs.getUserPreferences.mockResolvedValue({});
  common.getCommonItems.mockResolvedValue([]);
  pantryService.getPantry.mockResolvedValue([{ id: 'p1', name: 'Olive Oil', quantity: null, isStaple: true }]);
  try { localStorage.clear(); localStorage.setItem('enableSmartMatching', 'false'); } catch (e) { /* ignore */ }
});

test('generates, splits by pantry, saves, and records bought items', async () => {
  jest.useFakeTimers();
  render(
    <MemoryRouter initialEntries={[{ pathname: '/shopping-list', state: { mealPlan } }]}>
      <ShoppingListPage />
    </MemoryRouter>
  );

  await waitFor(() => expect(listService.createShoppingList).toHaveBeenCalled());
  const saved = listService.createShoppingList.mock.calls[0][0].items;
  expect(saved.find((i) => i.key === 'olive oil').pantryStatus).toBe('have');
  expect(saved.find((i) => i.key === 'olive oil').alreadyHave).toBe(true);

  expect(screen.getByText('Garlic')).toBeInTheDocument();
  // Shown the way it is bought, with the cooking amount underneath.
  expect(screen.getByText('1 head')).toBeInTheDocument();
  expect(screen.getByText('for 4 cloves')).toBeInTheDocument();
  expect(screen.getByText('Produce')).toBeInTheDocument();
  expect(screen.getByText(/already in pantry/)).toBeInTheDocument();
  // Already have is collapsed by default
  expect(screen.queryByText('Olive Oil')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Already have/ }));
  expect(screen.getByText('Olive Oil')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' }));
  expect(screen.getByText('1 of 2 bought')).toBeInTheDocument();
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(pantryService.recordPurchases).toHaveBeenCalledWith([{ name: 'Garlic', quantity: 4, unit: 'clove', listId: 'list-1' }]);
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(listService.updateShoppingList).toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'quick add chicken' }));
  expect(screen.getByText('Chicken breast')).toBeInTheDocument();
  expect(screen.getByText('2 lb')).toBeInTheDocument();
  jest.useRealTimers();
});

test('legacy saved list auto-loads, renders by aisle, and the pantry toggle moves items', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  listService.getUserShoppingLists.mockResolvedValue([{
    id: 'old-1',
    name: 'Old list',
    items: [
      { id: 'a', name: 'Black pepper', quantity: 1, unit: 'items', category: 'Produce', alreadyHave: false },
      { id: 'b', name: 'Milk', quantity: 473.176, unit: 'ml', category: 'Dairy', alreadyHave: true },
    ],
  }]);
  localStorage.setItem('lastActiveShoppingListId', 'old-1');

  render(
    <MemoryRouter initialEntries={['/shopping-list']}>
      <ShoppingListPage />
    </MemoryRouter>
  );

  expect(await screen.findByText('Old list')).toBeInTheDocument();
  expect(screen.getByText('Spices & Seasonings')).toBeInTheDocument();
  expect(screen.getByText('Black pepper')).toBeInTheDocument();
  // legacy alreadyHave -> Already have section (collapsed)
  expect(screen.queryByText('Milk')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Black pepper: Need' }));
  await waitFor(() => expect(pantryService.markHave).toHaveBeenCalled());
  expect(screen.queryByRole('checkbox', { name: 'Mark Black pepper as bought' })).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: /Already have/ }));
  fireEvent.click(screen.getByRole('button', { name: /Actually need Milk/ }));
  expect(screen.getByRole('checkbox', { name: 'Mark Milk as bought' })).toBeInTheDocument();
});


const savedList = (items) => [{ id: 'L1', name: 'Saved list', items }];
const garlicItem = { id: 'g', key: 'garlic', name: 'Garlic', quantity: 2, unit: 'clove', parts: [{ value: 2, unit: 'clove', category: 'count' }], sources: [] };

const renderSaved = async (items) => {
  pantryService.getPantry.mockResolvedValue([]);
  listService.getUserShoppingLists.mockResolvedValue(savedList(items));
  localStorage.setItem('lastActiveShoppingListId', 'L1');
  const utils = render(
    <MemoryRouter initialEntries={['/shopping-list']}>
      <ShoppingListPage />
    </MemoryRouter>
  );
  expect(await screen.findByText('Saved list')).toBeInTheDocument();
  return utils;
};

const lastSavedItems = () => {
  const calls = listService.updateShoppingList.mock.calls.filter((c) => c[1] && c[1].items);
  return calls.length ? calls[calls.length - 1][1].items : null;
};

test('adding the same recipe from the modal twice adds both times', async () => {
  jest.useFakeTimers();
  await renderSaved([garlicItem]);
  const cake = { id: 'cake', title: 'Cake', servings: '4', ingredients: [
    { ingredientId: 'sugar', amount: '1', unit: 'cup' },
    { ingredientId: 'sugar', amount: '1', unit: 'cup' },
  ] };
  act(() => { global.__recipeModalProps.onRecipeAdd({ recipe: cake, servings: 4 }); });
  expect(screen.getByText('for 2 cups')).toBeInTheDocument();
  act(() => { global.__recipeModalProps.onRecipeAdd({ recipe: cake, servings: 8 }); });
  expect(screen.getByText('for 6 cups')).toBeInTheDocument();
  jest.useRealTimers();
});

test('bought -> unticked -> bought again records the purchase once and undoes it in between', async () => {
  jest.useFakeTimers();
  await renderSaved([garlicItem]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' }));
  await act(async () => { jest.advanceTimersByTime(3000); });
  expect(pantryService.recordPurchases).toHaveBeenCalledTimes(1);
  expect(pantryService.recordPurchases.mock.calls[0][0]).toEqual([{ name: 'Garlic', quantity: 2, unit: 'clove', listId: 'L1' }]);

  fireEvent.click(screen.getByRole('checkbox', { name: 'Unmark Garlic as bought' }));
  await act(async () => { await Promise.resolve(); });
  expect(pantryService.undoPurchase).toHaveBeenCalledWith({ pantryId: 'pp-Garlic-0', created: true, previous: null });

  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' }));
  await act(async () => { jest.advanceTimersByTime(3000); });
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(pantryService.recordPurchases).toHaveBeenCalledTimes(2);
  const saved = lastSavedItems().find((i) => i.key === 'garlic');
  expect(saved).toMatchObject({ completed: true, addedToPantry: true, pantryOverride: null });
  expect(saved.pantryAdded).toMatchObject({ pantryId: 'pp-Garlic-0' });
  jest.useRealTimers();
});

test('legacy items already recorded in the pantry are never sent twice', async () => {
  jest.useFakeTimers();
  await renderSaved([{ ...garlicItem, completed: true, addedToPantry: true }]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Unmark Garlic as bought' })); // untick
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' })); // tick again
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(pantryService.recordPurchases).not.toHaveBeenCalled();
  expect(lastSavedItems().find((i) => i.key === 'garlic')).toMatchObject({ completed: true, pantryOverride: null });
  jest.useRealTimers();
});

test('leaving the page saves pending edits right away together with the purchase records', async () => {
  const { unmount } = await renderSaved([garlicItem]);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' }));
  unmount();
  await waitFor(() => expect(listService.updateShoppingList).toHaveBeenCalled());
  expect(pantryService.recordPurchases).toHaveBeenCalledTimes(1);
  const saved = lastSavedItems().find((i) => i.key === 'garlic');
  expect(saved).toMatchObject({ completed: true, addedToPantry: true });
  expect(listService.updateShoppingList.mock.calls[0][0]).toBe('L1');
});

test('edits made while a generated list is being created do not create a second list', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  let resolveCreate;
  listService.createShoppingList.mockImplementation(() => new Promise((r) => { resolveCreate = r; }));
  render(
    <MemoryRouter initialEntries={[{ pathname: '/shopping-list', state: { mealPlan } }]}>
      <ShoppingListPage />
    </MemoryRouter>
  );
  await waitFor(() => expect(listService.createShoppingList).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Garlic as bought' }));
  fireEvent.click(screen.getByRole('button', { name: 'quick add chicken' }));
  await act(async () => { resolveCreate('list-1'); });
  await waitFor(() => expect(listService.updateShoppingList).toHaveBeenCalled(), { timeout: 3000 });
  expect(listService.createShoppingList).toHaveBeenCalledTimes(1);
  const [id, payload] = listService.updateShoppingList.mock.calls.find((c) => c[1] && c[1].items);
  expect(id).toBe('list-1');
  expect(payload.items.find((i) => i.key === 'garlic').completed).toBe(true);
  expect(payload.items.some((i) => /chicken/i.test(i.name))).toBe(true);
});

const renderFromPlan = (state) => render(
  <MemoryRouter initialEntries={[{ pathname: '/shopping-list', state }]}>
    <ShoppingListPage />
  </MemoryRouter>
);

test('a new list from a plan remembers the plan and is named after it', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  renderFromPlan({ mealPlan, planKeys: ['plan-1', 'working-1'], planName: 'Week 1' });

  await waitFor(() => expect(listService.createShoppingList).toHaveBeenCalledTimes(1));
  expect(listService.findListForMealPlan).toHaveBeenCalledWith(['plan-1', 'working-1']);
  expect(listService.createShoppingList.mock.calls[0][0]).toMatchObject({
    name: 'Week 1 - Shopping List',
    sourcePlanKeys: ['plan-1', 'working-1'],
    type: 'mealPlan',
  });
});

test('regenerating a plan updates its existing list instead of creating another', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  listService.findListForMealPlan.mockResolvedValue({
    id: 'L-plan',
    name: 'Week 1 - Shopping List',
    items: [
      // Previously generated at 4 servings, already ticked by the user.
      {
        id: 'garlic-old', key: 'garlic', name: 'Garlic', quantity: 2, unit: 'clove', completed: true,
        sources: [{ recipeId: 'r1', recipeTitle: 'Tacos', day: 'monday', meal: 'dinner', servings: 4,
          originalText: 'Garlic cloves', parts: [{ value: 2, unit: 'clove', category: 'count' }] }],
      },
      { id: 'm1', key: 'paper towel', name: 'Paper Towels', quantity: 1, unit: '', sources: [] },
    ],
  });
  renderFromPlan({ mealPlan, planKeys: ['plan-1'], planName: 'Week 1' });

  await waitFor(() => expect(listService.updateShoppingList).toHaveBeenCalled());
  expect(listService.createShoppingList).not.toHaveBeenCalled();
  expect(listService.linkListToMealPlan).toHaveBeenCalledWith('L-plan', ['plan-1']);

  const [id, payload] = listService.updateShoppingList.mock.calls[0];
  expect(id).toBe('L-plan');
  const garlic = payload.items.find((i) => i.key === 'garlic');
  expect(garlic).toMatchObject({ id: 'garlic-old', completed: true, quantity: 4 }); // re-scaled, still ticked
  expect(payload.items.find((i) => i.id === 'm1')).toBeTruthy(); // manual item kept
});

test('the list is saved before product matching finishes', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  localStorage.setItem('enableSmartMatching', 'true');
  let finishMatching;
  productMatching.matchItemsBatch.mockImplementation(() => new Promise((r) => { finishMatching = r; }));
  renderFromPlan({ mealPlan, planKeys: ['plan-1'] });

  await waitFor(() => expect(listService.createShoppingList).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(productMatching.matchItemsBatch).toHaveBeenCalledTimes(1));
  const garlic = listService.createShoppingList.mock.calls[0][0].items.find((i) => i.key === 'garlic');
  expect(garlic.productMatch).toBeUndefined();

  const product = { code: '123', name: 'Fresh Garlic' };
  await act(async () => {
    finishMatching(new Map([[garlic.id, [{ product, score: 0.9, reason: 'Excellent match' }]]]));
  });
  await waitFor(() => {
    const update = listService.updateShoppingList.mock.calls.find((c) => c[1]?.items?.some((i) => i.productMatch));
    expect(update).toBeTruthy();
    expect(update[1].items.find((i) => i.key === 'garlic').productMatch.selectedProduct).toEqual(product);
  }, { timeout: 3000 });
});

test('product matching failing never blocks or breaks the list', async () => {
  pantryService.getPantry.mockResolvedValue([]);
  localStorage.setItem('enableSmartMatching', 'true');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  productMatching.matchItemsBatch.mockRejectedValue(new Error('offline'));
  renderFromPlan({ mealPlan, planKeys: ['plan-1'] });

  await waitFor(() => expect(listService.createShoppingList).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(warn).toHaveBeenCalledWith('Product matching is unavailable right now:', expect.any(Error)));
  expect(screen.getByText('Garlic')).toBeInTheDocument();
  warn.mockRestore();
});
