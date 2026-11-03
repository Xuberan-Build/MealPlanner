import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import DietTypeDropdown from '../DietTypeDropdown';

jest.mock('../../../../../firebase', () => ({ auth: {} }));
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: (auth, cb) => { cb({ uid: 'u1' }); return () => {}; },
}));
jest.mock('../../../../../services/dietTypeService', () => ({
  __esModule: true,
  default: { getDietTypes: jest.fn(), addCustomDietType: jest.fn() },
}));

const dietTypeService = require('../../../../../services/dietTypeService').default;

beforeEach(() => {
  dietTypeService.getDietTypes.mockResolvedValue([{ id: 'h', name: 'Haitian' }, { id: 'v', name: 'vegan ' }]);
  dietTypeService.addCustomDietType.mockImplementation(async (uid, name) => ({ id: 'n', name }));
});

const renderDropdown = async (props = {}) => {
  const setDietType = jest.fn();
  await act(async () => {
    render(<DietTypeDropdown dietType="" setDietType={setDietType} {...props} />);
  });
  return setDietType;
};

test('suggests the user types with canonical names and commits canonical values', async () => {
  const setDietType = await renderDropdown();
  const input = screen.getByRole('combobox', { name: 'Diet Type' });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'hai' } });
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('Haitian');
  await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
  expect(setDietType).toHaveBeenLastCalledWith('Haitian');
  expect(dietTypeService.addCustomDietType).not.toHaveBeenCalled();
});

test('a brand-new value is saved as a custom diet type, canonical', async () => {
  const setDietType = await renderDropdown();
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'soul food' } });
  await act(async () => { fireEvent.click(screen.getByRole('option', { name: 'Create "Soul Food"' })); });
  expect(setDietType).toHaveBeenLastCalledWith('Soul Food');
  expect(dietTypeService.addCustomDietType).toHaveBeenCalledWith('u1', 'Soul Food');
  expect(screen.getByRole('status')).toHaveTextContent('Added “Soul Food”');
});

test('a typo offers the existing type instead of creating one', async () => {
  await renderDropdown();
  const input = screen.getByRole('combobox');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'glutn free' } });
  expect(screen.getAllByRole('option')[0]).toHaveTextContent('Did you mean Gluten-Free?');
  expect(screen.queryByRole('option', { name: /Create/ })).not.toBeInTheDocument();
});
