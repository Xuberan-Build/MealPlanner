import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import AddToMealPlanModal from '../components/AddToMealPlanModal';
import { WORKING_PLAN_KEY, getSlot } from '../../mealPlanner/mealPlanModel';
import { getWorkingSession, resetWorkingPlanStoreForTests } from '../../mealPlanner/workingPlanStore';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));

const chicken = { id: 'r1', title: 'Haitian Chicken', servings: '4 people', mealType: 'Dinner' };
const soup = { id: 'r2', title: 'Soup', servings: '2', mealType: 'Lunch' };

beforeEach(() => {
  mockNavigate.mockReset();
  localStorage.clear();
  resetWorkingPlanStoreForTests();
});

test('defaults to the recipe yield and meal type, including after switching recipes', () => {
  const { rerender } = render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Servings')).toHaveValue(4);
  expect(screen.getByLabelText('Meal')).toHaveValue('Dinner');

  rerender(<AddToMealPlanModal isOpen recipe={soup} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Servings')).toHaveValue(2);
  expect(screen.getByLabelText('Meal')).toHaveValue('Lunch');
});

test('adds in place, stays in the Recipe Book, and confirms where it went', () => {
  const onClose = jest.fn();
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={onClose} />);
  const servings = screen.getByLabelText('Servings');
  fireEvent.change(servings, { target: { value: '' } }); // can clear while typing
  fireEvent.change(servings, { target: { value: '6' } });
  // Several days at once: Monday is pre-selected (first open day); add Thursday.
  expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: 'Thursday' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add to Meal Plan' }));

  const { plan } = getWorkingSession();
  expect(getSlot(plan, 'Monday', 'Dinner')).toEqual({ recipe: chicken, servings: 6 });
  expect(getSlot(plan, 'Thursday', 'Dinner')).toEqual({ recipe: chicken, servings: 6 });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Added to Monday and Thursday dinner for 6 servings each.');

  fireEvent.click(screen.getByRole('button', { name: 'Open planner' }));
  expect(mockNavigate).toHaveBeenCalledWith('/meal-planner');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalled();
});

test('starts on the first open day and warns before replacing a different meal', () => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify({ Monday: { Dinner: { recipe: soup, servings: 2 } } }));
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Tuesday' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.queryByRole('alert')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'Monday' }));
  expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Monday (Dinner).');
  expect(screen.getByRole('button', { name: 'Replace & Add' })).toBeInTheDocument();
});

test('days run Monday to Sunday; with no day selected nothing can be added', () => {
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  const days = within(screen.getByRole('group', { name: 'Days' })).getAllByRole('button');
  expect(days.map((b) => b.getAttribute('aria-label'))).toEqual([
    'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
  ]);
  fireEvent.click(screen.getByRole('button', { name: 'Monday' })); // deselect the only day
  expect(screen.getByRole('button', { name: 'Add to Meal Plan' })).toBeDisabled();
});

test('a lunch recipe can be planned for dinner, with a note', () => {
  render(<AddToMealPlanModal isOpen recipe={soup} onClose={jest.fn()} />);
  expect(screen.getByLabelText('Meal')).toHaveValue('Lunch');
  fireEvent.change(screen.getByLabelText('Meal'), { target: { value: 'Dinner' } });
  expect(screen.getByText('Saved as a lunch recipe; it will be planned for dinner.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Add to Meal Plan' }));
  expect(getSlot(getWorkingSession().plan, 'Monday', 'Dinner').recipe.title).toBe('Soup');
});
