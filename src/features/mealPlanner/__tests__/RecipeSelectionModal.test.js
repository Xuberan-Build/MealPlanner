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
