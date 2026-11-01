import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import RecipeSelectionModal from '../components/RecipeSelectionModal';

jest.mock('../../../firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../../../services/dietTypeService', () => ({
  __esModule: true,
  default: { getDietTypes: jest.fn().mockResolvedValue([]) },
}));

const tacos = { id: 'r1', title: 'Tacos', servings: '4', mealType: 'Dinner' };
const soup = { id: 'r2', title: 'Soup', servings: '-4', mealType: 'Dinner' };

// Renders and lets the async diet-type load settle, so no state update lands outside act().
const renderModal = async (props = {}) => {
  const handlers = {
    onClose: jest.fn(),
    onRecipeSelect: jest.fn(),
    onRemoveMeal: jest.fn(),
  };
  await act(async () => {
    render(
      <RecipeSelectionModal
        isOpen
        mealType="Dinner"
        availableRecipes={[tacos, soup]}
        mealPlan={{}}
        selectedMealSlot={{ day: 'Wednesday', meal: 'Dinner' }}
        {...handlers}
        {...props}
      />,
    );
  });
  return handlers;
};

describe('adding a recipe', () => {
  test('pre-selects the day whose slot was clicked', async () => {
    const { onRecipeSelect } = await renderModal();
    fireEvent.click(screen.getByText('Tacos'));
    fireEvent.click(screen.getByText('Continue to Days'));
    fireEvent.click(screen.getByText('Add to Meal Plan'));

    expect(onRecipeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', selectedServings: 4 }),
      ['Wednesday'],
      expect.any(Function),
    );
  });

  test('warns before replacing a different recipe on another selected day', async () => {
    await renderModal({ mealPlan: { Tuesday: { Dinner: { recipe: soup, servings: 2 } } } });
    fireEvent.click(screen.getByText('Tacos'));
    fireEvent.click(screen.getByText('Continue to Days'));

    // The occupied day shows what is there before anything is selected.
    expect(screen.getByRole('button', { name: /Tuesday/ })).toHaveTextContent('Soup');
    expect(screen.queryByRole('alert')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Tuesday/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Tuesday.');
    expect(screen.getByText('Replace & Add')).toBeInTheDocument();
  });

  test('shows a parsed yield instead of raw imported values', async () => {
    await renderModal();
    expect(screen.getByText('Tacos').closest('button')).toHaveTextContent('Recipe serves 4');
    // "-4" is a range whose lower bound was lost on import.
    expect(screen.getByText('Soup').closest('button')).toHaveTextContent('Recipe serves 4');
  });
});

describe('editing an existing meal', () => {
  const editSlot = {
    day: 'Monday',
    meal: 'Dinner',
    isEditing: true,
    existingMeal: { recipe: tacos, servings: 4 },
  };

  test('changing servings saves straight from the servings step', async () => {
    const { onRecipeSelect, onClose } = await renderModal({ selectedMealSlot: editSlot });
    expect(screen.queryByText('Continue to Days')).toBeNull();

    fireEvent.click(screen.getByText('+'));
    fireEvent.click(screen.getByText('Save Changes'));

    expect(onRecipeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', selectedServings: 5 }),
      ['Monday'],
      expect.any(Function),
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('swapping the recipe keeps it on the same day', async () => {
    const { onRecipeSelect } = await renderModal({ selectedMealSlot: editSlot });
    fireEvent.click(screen.getByText('← Back to recipes'));
    fireEvent.click(screen.getByText('Soup'));
    fireEvent.click(screen.getByText('Save Changes'));

    expect(onRecipeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r2' }),
      ['Monday'],
      expect.any(Function),
    );
  });

  test('a meal can be removed from its day', async () => {
    const { onRemoveMeal, onRecipeSelect, onClose } = await renderModal({ selectedMealSlot: editSlot });
    fireEvent.click(screen.getByText('Remove from Monday'));

    expect(onRemoveMeal).toHaveBeenCalledWith('Monday', 'Dinner');
    expect(onRecipeSelect).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

describe('building a plate', () => {
  const choosePlate = () => fireEvent.click(screen.getByRole('tab', { name: 'Build a plate' }));

  test('a plate goes through day selection like a recipe, for N people', async () => {
    const { onRecipeSelect } = await renderModal({
      mealPlan: { Tuesday: { Dinner: { recipe: soup, servings: 2 } } },
    });
    choosePlate();
    expect(screen.queryByText('Tacos')).toBeNull(); // recipe grid hidden on the plate tab
    fireEvent.click(screen.getByRole('button', { name: 'Salmon' }));
    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose days' }));

    expect(screen.getByText(/for 2 people per day/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Tuesday/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Tuesday.');
    fireEvent.click(screen.getByText('Replace & Add'));

    expect(onRecipeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'plate', title: 'Salmon', selectedServings: 2 }),
      ['Wednesday', 'Tuesday'],
      expect.any(Function)
    );
  });

  test('going back from days keeps the plate', async () => {
    await renderModal();
    choosePlate();
    fireEvent.click(screen.getByRole('button', { name: 'Rice' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose days' }));
    fireEvent.click(screen.getByText('← Back to plate'));
    expect(screen.getByRole('button', { name: 'Rice' })).toHaveAttribute('aria-pressed', 'true');
  });

  test('saving to "Your plates" calls the page; saved plates stay out of the recipe grid', async () => {
    const onSaveFavoritePlate = jest.fn();
    const savedPlate = { id: 'p9', kind: 'plate', title: 'Steak night', mealType: 'Dinner', servings: 1, ingredients: [] };
    await renderModal({ onSaveFavoritePlate, availableRecipes: [tacos, soup, savedPlate] });
    expect(screen.queryByText('Steak night')).toBeNull();
    choosePlate();
    expect(screen.getByRole('button', { name: 'Steak night' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eggs' }));
    fireEvent.click(screen.getByLabelText('Save to "Your plates"'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose days' }));
    expect(onSaveFavoritePlate).toHaveBeenCalledWith(expect.objectContaining({ kind: 'plate', title: 'Eggs' }));
  });

  test('editing a planned plate opens the builder and saves in place', async () => {
    const plate = {
      kind: 'plate',
      title: 'Chicken & Rice',
      mealType: 'Dinner',
      servings: 1,
      ingredients: [
        { ingredientId: 'Chicken breast', amount: '6', unit: 'oz', plateSection: 'protein' },
        { ingredientId: 'Rice', amount: '1/2', unit: 'cup', plateSection: 'carb' },
      ],
    };
    const { onRecipeSelect, onRemoveMeal } = await renderModal({
      selectedMealSlot: { day: 'Monday', meal: 'Dinner', isEditing: true, existingMeal: { recipe: plate, servings: 3 } },
    });
    expect(screen.getByRole('tab', { name: 'Build a plate' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Chicken breast' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Number of people')).toHaveTextContent('3');

    fireEvent.click(screen.getByRole('button', { name: 'Broccoli' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onRecipeSelect).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'plate', title: 'Chicken & Rice', selectedServings: 3 }),
      ['Monday'],
      expect.any(Function)
    );
    expect(onRemoveMeal).not.toHaveBeenCalled();
  });
});

