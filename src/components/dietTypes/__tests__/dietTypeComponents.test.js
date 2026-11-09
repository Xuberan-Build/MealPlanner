import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DietTypeBadgeGroup } from '../DietTypeBadge';
import DietTypeSelector from '../DietTypeSelector';
import DietTypeManager from '../DietTypeManager';

const mockCreateDietType = jest.fn();
const mockDietTypes = [
  { id: 'vegan', name: 'Vegan', createdBy: 'system' },
  { id: 'u-vegan', name: 'vegan ', createdBy: 'u1' }, // duplicate spelling: shown once
  { id: 'haitian', name: 'Haitian', createdBy: 'u1' },
];

jest.mock('../../../hooks/useDietTypes', () => {
  const { dedupeDietTypeObjects } = jest.requireActual('../../../utils/dietTypes/collection');
  const { searchDietTypeItems } = jest.requireActual('../../../utils/dietTypes/suggest');
  return {
    useDietTypes: () => {
      const all = dedupeDietTypeObjects(mockDietTypes);
      return {
        dietTypes: all,
        allDietTypes: all,
        loading: false,
        error: null,
        totalCount: all.length,
        visibleCount: all.length,
        favoritesCount: 0,
        customCount: 1,
        createDietType: mockCreateDietType,
        updateDietType: jest.fn(),
        deleteDietType: jest.fn(),
        searchDietTypes: (term, list) => searchDietTypeItems(term, list || all),
        canEditDietType: () => false,
        canDeleteDietType: () => false,
      };
    },
    useDietTypePreferences: () => ({
      toggleFavorite: jest.fn(),
      toggleHidden: jest.fn(),
      isFavorite: () => false,
      isHidden: () => false,
    }),
    useDietTypeSearch: () => ({
      searchTerm: '',
      setSearchTerm: jest.fn(),
      results: [],
      isSearching: false,
      clearSearch: jest.fn(),
    }),
  };
});

describe('DietTypeBadgeGroup', () => {
  test('canonical names, one badge per key, blanks dropped', () => {
    render(<DietTypeBadgeGroup dietTypes={['vegan', 'Vegan ', 'GF', 'Not Specified']} />);
    expect(screen.getAllByText(/./).map((el) => el.textContent)).toEqual(expect.arrayContaining(['Vegan', 'Gluten-Free']));
    expect(screen.getAllByText('Vegan')).toHaveLength(1);
    expect(screen.queryByText('Not Specified')).not.toBeInTheDocument();
  });

  test('renders nothing when only blanks', () => {
    const { container } = render(<DietTypeBadgeGroup dietTypes={['Not Specified', '']} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DietTypeSelector', () => {
  const setup = (selected = []) => {
    const onChange = jest.fn();
    render(<DietTypeSelector selectedDietTypes={selected} onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    return { onChange, input };
  };

  test('alias search adds the canonical name', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'gf' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Gluten-Free']);
  });

  test('typo shows Did you mean, no Add', () => {
    const { onChange, input } = setup();
    fireEvent.change(input, { target: { value: 'Haitain' } });
    expect(screen.getByText(/Did you mean/)).toHaveTextContent('Did you mean Haitian?');
    expect(screen.queryByText(/^Add/)).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith(['Haitian']);
  });

  test('nothing close offers Add with the canonical name', () => {
    const { onChange, input } = setup(['vegan']);
    fireEvent.change(input, { target: { value: 'soul food' } });
    fireEvent.click(screen.getByText('Add “Soul Food”'));
    expect(onChange).toHaveBeenCalledWith(['Vegan', 'Soul Food']);
  });

  test('selected spelling variants are shown once and removed together', () => {
    const { onChange } = setup(['vegan', 'Vegan ']);
    expect(screen.getAllByText('Vegan')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove Vegan' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe('DietTypeManager', () => {
  test('lists each diet once and reuses an existing type on create', async () => {
    mockCreateDietType.mockResolvedValue({ id: 'vegan', name: 'Vegan', existing: true });
    render(<DietTypeManager onClose={jest.fn()} />);
    expect(screen.getAllByRole('heading', { name: 'Vegan' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: /Create Custom Diet Type/ }));
    const nameInput = screen.getByPlaceholderText('e.g., Mediterranean');
    fireEvent.change(nameInput, { target: { value: 'VEGAN' } });
    expect(screen.getByRole('status')).toHaveTextContent('Already exists as Vegan.');
    fireEvent.change(nameInput, { target: { value: 'sugar free' } });
    expect(screen.getByRole('status')).toHaveTextContent('Will be saved as Sugar-Free.');
    fireEvent.change(nameInput, { target: { value: 'vegan' } });

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Create' })); });
    expect(mockCreateDietType).toHaveBeenCalledWith({ name: 'vegan', description: '' });
    expect(screen.getByRole('status')).toHaveTextContent('"Vegan" already exists');
  });

  test('counts recipes per type from the recipes passed in, any spelling', () => {
    const recipes = [
      { id: 'r1', dietType: 'vegan' },
      { id: 'r2', dietTypes: ['Vegan', 'Haitian'] },
      { id: 'r3', dietType: 'Haitian' },
      { id: 'r4', dietTypes: ['VEGAN', 'vegan'] }, // one recipe counts once
      { id: 'r5' },
    ];
    render(<DietTypeManager recipes={recipes} onClose={jest.fn()} />);
    const countFor = (name) => screen.getByRole('heading', { name }).closest('.diet-type-item')
      .querySelector('.recipe-count').textContent;
    expect(countFor('Vegan')).toBe('3 recipes');
    expect(countFor('Haitian')).toBe('2 recipes');
  });
});
