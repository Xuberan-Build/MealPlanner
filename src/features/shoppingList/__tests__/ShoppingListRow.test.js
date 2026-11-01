import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ShoppingListRow from '../components/ShoppingListRow';
import { annotateList } from '../listModel';
import { buildItemsFromRecipe } from '../../../services/shoppingList/buildShoppingList';

jest.mock('../components/ProductMatchModal', () => () => null);

const recipe = {
  title: 'Tacos',
  servings: '',
  ingredients: [
    { ingredientId: 'flour', amount: '1', unit: 'cup' },
    { ingredientId: 'salt', amount: '', unit: '' },
  ],
};

const view = (pantry = []) => annotateList(buildItemsFromRecipe(recipe, 4), pantry);

test('buy row shows name, amount, sources, servings hint and toggles bought', () => {
  const flour = view([{ id: 'p', name: 'Flour', quantity: 0.5, unit: 'cup' }]).find((i) => i.key === 'flour');
  const onToggleBought = jest.fn();
  const onPantryChange = jest.fn();
  render(<ul><ShoppingListRow item={flour} onToggleBought={onToggleBought} onPantryChange={onPantryChange} onEdit={() => {}} /></ul>);
  expect(screen.getByText('Flour')).toBeInTheDocument();
  expect(screen.getByText('need 1/2 cup (have some)')).toBeInTheDocument();
  expect(screen.getByText('from: Tacos')).toBeInTheDocument();
  expect(screen.getByText(/recipe servings missing/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Mark Flour as bought' }));
  expect(onToggleBought).toHaveBeenCalledWith(flour);
  fireEvent.click(screen.getByRole('button', { name: 'Flour: Have some' }));
  expect(onPantryChange).toHaveBeenCalledWith('have', flour);
});

test('have row offers "Actually need it"', () => {
  const salt = view([{ id: 's', name: 'Salt', quantity: null, isStaple: true }]).find((i) => i.key === 'salt');
  const onPantryChange = jest.fn();
  render(<ul><ShoppingListRow item={salt} variant="have" onPantryChange={onPantryChange} onEdit={() => {}} /></ul>);
  expect(screen.getByText('to taste')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Actually need Salt/ }));
  expect(onPantryChange).toHaveBeenCalledWith('need', salt);
});

test('shows the package size next to the amount', () => {
  const paste = annotateList(
    buildItemsFromRecipe({ title: 'Stew', servings: '4', ingredients: [{ ingredientId: '(6 oz) can tomato paste', amount: '1', unit: '' }] }, 4),
    []
  )[0];
  render(<ul><ShoppingListRow item={paste} onToggleBought={() => {}} onPantryChange={() => {}} onEdit={() => {}} /></ul>);
  expect(screen.getByText('Tomato Paste')).toBeInTheDocument();
  expect(screen.getByText('1 can · 6 oz')).toBeInTheDocument();
});

test('shows what to buy in the store, with the cooking amount underneath', () => {
  const broccoli = annotateList(
    buildItemsFromRecipe({ title: 'Plate', servings: '1', ingredients: [{ ingredientId: 'Broccoli', amount: '1 1/2', unit: 'cup' }] }, 4),
    []
  )[0];
  render(<ul><ShoppingListRow item={broccoli} onToggleBought={() => {}} onPantryChange={() => {}} onEdit={() => {}} /></ul>);
  expect(screen.getByText('2 heads (≈ 1 1/4 lb)')).toBeInTheDocument();
  expect(screen.getByText('for 6 cups')).toBeInTheDocument();
});

test('items the store table does not know keep their recipe amount', () => {
  const sumac = annotateList(
    buildItemsFromRecipe({ title: 'Plate', servings: '1', ingredients: [{ ingredientId: 'Sumac', amount: '1', unit: 'tsp' }] }, 1),
    []
  )[0];
  render(<ul><ShoppingListRow item={sumac} onToggleBought={() => {}} onPantryChange={() => {}} onEdit={() => {}} /></ul>);
  expect(screen.getByText('1 tsp')).toBeInTheDocument();
  expect(screen.queryByText(/^for /)).toBeNull();
});
