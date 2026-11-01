import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PantryPage, { parseAmountInput, pantryAmountText } from '../PantryPage';
import * as service from '../../../services/pantryService';

jest.mock('../../../components/layout/Header', () => () => <div />);
jest.mock('../../../components/layout/BottomNav', () => () => <div />);
jest.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u1' } }) }));
jest.mock('../../../services/pantryService', () => ({
  COMMON_STAPLES: ['Salt', 'Olive Oil'],
  getPantry: jest.fn(),
  upsertPantryItem: jest.fn(),
  updatePantryItem: jest.fn(),
  removePantryItem: jest.fn(),
  setStaple: jest.fn(),
  seedCommonStaples: jest.fn(),
}));

const renderPage = () => render(<MemoryRouter><PantryPage /></MemoryRouter>);

describe('PantryPage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('empty state offers common staples (opt-in only)', async () => {
    service.getPantry.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('Your pantry is empty')).toBeInTheDocument();
    expect(service.seedCommonStaples).not.toHaveBeenCalled();
    service.seedCommonStaples.mockResolvedValue([]);
    fireEvent.click(screen.getByRole('button', { name: /add common staples/i }));
    await waitFor(() => expect(service.seedCommonStaples).toHaveBeenCalled());
  });

  test('groups items by aisle and adds a new item', async () => {
    service.getPantry.mockResolvedValue([
      { id: '1', name: 'Salt', isStaple: true, quantity: null, unit: null, aisleId: 'spices' },
      { id: '2', name: 'Rice', isStaple: false, quantity: 2, unit: 'cup', aisleId: 'grains-pasta' },
    ]);
    service.upsertPantryItem.mockResolvedValue({ id: '3', name: 'Banana', quantity: 3, unit: null, isStaple: false, aisleId: 'produce' });
    renderPage();
    expect(await screen.findByText('Spices & Seasonings')).toBeInTheDocument();
    expect(screen.getByText('Pantry: Grains & Pasta')).toBeInTheDocument();
    expect(screen.getByText('Always have')).toBeInTheDocument();
    expect(screen.getByText('2 cups')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'bananas' } });
    fireEvent.change(screen.getByLabelText(/Amount, optional/), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));
    expect(await screen.findByText('Banana')).toBeInTheDocument();
    expect(service.upsertPantryItem).toHaveBeenCalledWith({ name: 'bananas', quantity: 3, unit: null }, expect.any(Array));
    expect(screen.getByText('Produce')).toBeInTheDocument();
  });

  test('helpers', () => {
    expect(parseAmountInput('2 cups')).toEqual({ quantity: 2, unit: 'cup' });
    expect(parseAmountInput('2 cans of tomatoes')).toEqual({ quantity: 2, unit: 'can' });
    expect(parseAmountInput('2 x 400g tins')).toEqual({ quantity: 2, unit: 'can' });
    expect(parseAmountInput('500 g')).toEqual({ quantity: 500, unit: 'g' });
    expect(parseAmountInput('3 glasses')).toEqual({ quantity: 3, unit: null });
    expect(parseAmountInput('Ran out')).toEqual({ quantity: null, unit: null });
    expect(parseAmountInput('1/2')).toEqual({ quantity: 0.5, unit: null });
    expect(parseAmountInput('')).toEqual({ quantity: null, unit: null });
    expect(pantryAmountText({ quantity: 0 })).toBe('Ran out');
    expect(pantryAmountText({ quantity: null })).toBe('In stock');
    expect(pantryAmountText({ quantity: 1.5, unit: 'cup' })).toBe('1 1/2 cups');
  });
});
