import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import AddToMealPlanModal from '../components/AddToMealPlanModal';
import { WORKING_PLAN_KEY } from '../../mealPlanner/mealPlanModel';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const chicken = { id: 'r1', title: 'Haitian Chicken', servings: '4 people' };
const soup = { id: 'r2', title: 'Soup', servings: '2' };

beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.clear();
});

test('defaults servings to the recipe yield, including after switching recipes', () => {
  const { rerender } = render(<AddToMealPlanModal isOpen={false} recipe={null} onClose={jest.fn()} />);
  rerender(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Servings:')).toHaveValue(4);

  rerender(<AddToMealPlanModal isOpen={false} recipe={chicken} onClose={jest.fn()} />);
  rerender(<AddToMealPlanModal isOpen recipe={soup} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Servings:')).toHaveValue(2);
});

test('the servings box can be cleared while typing a new number', () => {
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  const input = screen.getByLabelText('Servings:');
  fireEvent.change(input, { target: { value: '' } });
  expect(input).toHaveValue(null);
  fireEvent.change(input, { target: { value: '6' } });
  fireEvent.click(screen.getByText('Add to Meal Plan'));
  expect(mockNavigate).toHaveBeenCalledWith('/meal-planner', {
    state: { preSelectedRecipe: expect.objectContaining({ servings: 6, day: 'Monday', mealType: 'Dinner' }) },
  });
});

test('warns before replacing a different meal already in the slot', () => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify({ Monday: { Dinner: { recipe: soup, servings: 2 } } }));
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Monday (Dinner).');
  expect(screen.getByText('Replace & Add')).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Select Day:'), { target: { value: 'Tuesday' } });
  expect(screen.queryByRole('alert')).toBeNull();
});
