import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecipeDetails, { formatIngredientLine } from '../recipedetails/RecipeDetails';
import { resetWorkingPlanStoreForTests } from '../../mealPlanner/workingPlanStore';

jest.mock('../../../firebase', () => ({ db: {}, auth: { currentUser: null } }));
jest.mock('../../../services/recipeService', () => ({
  getVariationsByRecipe: jest.fn(() => Promise.resolve([])),
  addVariation: jest.fn(),
  updateRecipe: jest.fn(),
}));
jest.mock('../../../services/dietTypeService', () => ({
  __esModule: true,
  default: { getDietTypes: jest.fn(() => Promise.resolve([])) },
}));
jest.mock('../context/RecipeContext', () => ({
  useRecipes: () => ({ availableDietTypes: [], availableMealTypes: ['Dinner'] }),
}));
jest.mock('../recipedetails/recipeversioning/rec-versioning', () => () => null);

const recipeService = require('../../../services/recipeService');
const dietTypeService = require('../../../services/dietTypeService').default;

// CRA resets mock implementations before every test.
beforeEach(() => {
  recipeService.getVariationsByRecipe.mockResolvedValue([]);
  dietTypeService.getDietTypes.mockResolvedValue([]);
});

const recipe = {
  id: 'r1',
  title: 'Haitian Chicken',
  servings: '4 people',
  mealType: 'Dinner',
  ingredients: [
    { amount: '2', unit: '', ingredientId: 'large sweet onions' },
    { amount: '1', unit: 'tablespoon', ingredientId: 'garlic-powder' },
    { amount: '', unit: '', ingredientId: 'salt' },
  ],
};

const renderDetails = async (props = {}) => {
  resetWorkingPlanStoreForTests();
  await act(async () => {
    render(
      <MemoryRouter>
        <RecipeDetails recipe={recipe} isOpen onClose={jest.fn()} onUpdateRecipe={jest.fn()} onEditRecipe={jest.fn()} {...props} />
      </MemoryRouter>
    );
  });
};

describe('formatIngredientLine', () => {
  test('reads like a recipe line, without "of"', () => {
    expect(formatIngredientLine({ amount: '1', unit: 'cup', ingredientId: 'flour' })).toBe('1 cup flour');
    expect(formatIngredientLine({ amount: '2', unit: '', ingredientId: 'large onions' })).toBe('2 large onions');
    expect(formatIngredientLine({ amount: '', unit: '', ingredientId: 'salt' })).toBe('salt');
    expect(formatIngredientLine({ amount: 1, unit: 'tsp', ingredientId: 'baking-soda' })).toBe('1 tsp baking soda');
    expect(formatIngredientLine({})).toBe('Unnamed ingredient');
  });
});

describe('RecipeDetails', () => {
  test('shows ingredients, the meal-plan panel, and previous/next with position', async () => {
    const onPrevious = jest.fn();
    const onNext = jest.fn();
    await renderDetails({ onPrevious, onNext, positionLabel: '3 of 11' });

    expect(screen.getByText('2 large sweet onions')).toBeInTheDocument();
    expect(screen.getByText('1 tablespoon garlic powder')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'In your meal plan' })).toBeInTheDocument();
    expect(screen.getByText('3 of 11')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next recipe' }));
    expect(onNext).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  test('arrow keys are ignored while typing; Escape closes', async () => {
    const onNext = jest.fn();
    const onClose = jest.fn();
    await renderDetails({ onNext, onClose });
    fireEvent.keyDown(screen.getByLabelText('Servings'), { key: 'ArrowRight' });
    expect(onNext).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('at the ends of the list the missing direction is disabled', async () => {
    await renderDetails({ onNext: jest.fn(), onPrevious: null });
    expect(screen.getByRole('button', { name: 'Previous recipe' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next recipe' })).toBeEnabled();
  });
});
