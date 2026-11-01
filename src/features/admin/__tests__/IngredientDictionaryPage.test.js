import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import IngredientDictionaryPage from '../IngredientDictionaryPage';
import { buildDictionaryRows, filterRows } from '../dictionaryRows';

jest.mock('../../../components/layout/Header', () => () => null);
jest.mock('../../../components/layout/BottomNav', () => () => null);
jest.mock('../../../services/ingredientDictionaryService', () => ({
  isCurrentUserAdmin: jest.fn(),
  listPendingSuggestions: jest.fn(),
  loadIngredientDictionary: jest.fn(),
  resolveSuggestion: jest.fn(),
  saveAlias: jest.fn(),
  setAliasEnabled: jest.fn(),
}));

const service = require('../../../services/ingredientDictionaryService');

const renderPage = async () => {
  await act(async () => {
    render(<IngredientDictionaryPage />);
  });
};

beforeEach(() => {
  service.isCurrentUserAdmin.mockResolvedValue(true);
  service.loadIngredientDictionary.mockResolvedValue([
    { alias: 'jumbo oat', canonical: 'rolled oat', enabled: true, note: 'UK' },
    { alias: 'double cream', canonical: 'heavy cream', enabled: false },
  ]);
  service.listPendingSuggestions.mockResolvedValue([{ id: 's1', alias: 'porridge oat', canonical: 'rolled oat', context: '' }]);
  service.saveAlias.mockResolvedValue([]);
  service.setAliasEnabled.mockResolvedValue([]);
  service.resolveSuggestion.mockResolvedValue();
});

describe('dictionary rows', () => {
  test('built-ins and shared entries combine, showing what is in effect', () => {
    const rows = buildDictionaryRows({ 'double cream': 'heavy cream', evoo: 'extra virgin olive oil' }, [
      { alias: 'double cream', canonical: 'heavy cream', enabled: false },
      { alias: 'Jumbo Oats', canonical: 'rolled oats' },
    ]);
    expect(rows).toEqual([
      { alias: 'double cream', canonical: 'heavy cream', source: 'built-in', enabled: false, changedBuiltIn: true, note: '' },
      { alias: 'evoo', canonical: 'extra virgin olive oil', source: 'built-in', enabled: true, changedBuiltIn: false, note: '' },
      { alias: 'jumbo oat', canonical: 'rolled oat', source: 'shared', enabled: true, changedBuiltIn: false, note: '' },
    ]);
    expect(filterRows(rows, 'OAT').map((r) => r.alias)).toEqual(['jumbo oat']);
  });
});

describe('IngredientDictionaryPage', () => {
  test('non-admins see a clear message and no controls', async () => {
    service.isCurrentUserAdmin.mockResolvedValue(false);
    await renderPage();
    expect(screen.getByRole('alert')).toHaveTextContent('This page is for admins');
    expect(screen.queryByRole('button', { name: 'Save for everyone' })).toBeNull();
    expect(service.loadIngredientDictionary).not.toHaveBeenCalled();
  });

  test('admins add an alias with a live preview; loops are blocked', async () => {
    await renderPage();
    fireEvent.change(screen.getByLabelText('Name people use'), { target: { value: 'Porridge oats' } });
    fireEvent.change(screen.getByLabelText('Same product as'), { target: { value: 'old fashioned oats' } });
    // old fashioned oats already becomes rolled oats, so the preview follows the chain.
    expect(screen.getByText(/will show “Porridge oats” as/)).toHaveTextContent('Rolled Oat');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save for everyone' }));
    });
    expect(service.saveAlias).toHaveBeenCalledWith({ alias: 'Porridge oats', canonical: 'old fashioned oats', note: '' });
    expect(screen.getByRole('status')).toHaveTextContent('Saved for everyone.');

    fireEvent.change(screen.getByLabelText('Name people use'), { target: { value: 'rolled oats' } });
    fireEvent.change(screen.getByLabelText('Same product as'), { target: { value: 'old fashioned oats' } });
    expect(screen.getByRole('alert')).toHaveTextContent('would loop');
    expect(screen.getByRole('button', { name: 'Save for everyone' })).toBeDisabled();
  });

  test('aliases can be switched off and on (never deleted)', async () => {
    await renderPage();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Switch off Jumbo Oat' }));
    });
    expect(service.setAliasEnabled).toHaveBeenCalledWith('jumbo oat', false, 'rolled oat');

    const doubleCream = screen.getByRole('button', { name: 'Switch on Double Cream' });
    expect(within(doubleCream.closest('li')).getByText('Off')).toBeInTheDocument();
  });

  test('suggestions can be approved or rejected', async () => {
    await renderPage();
    const suggestions = screen.getByRole('heading', { name: /Suggestions from users/ }).closest('section');
    await act(async () => {
      fireEvent.click(within(suggestions).getByRole('button', { name: 'Approve' }));
    });
    expect(service.resolveSuggestion).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }), true);
    expect(screen.getByRole('status')).toHaveTextContent('Approved and saved for everyone.');
  });
});
