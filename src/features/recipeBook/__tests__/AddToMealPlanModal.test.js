import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Thursday' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add to Meal Plan' }));

  expect(getSlot(getWorkingSession().plan, 'Thursday', 'Dinner')).toEqual({ recipe: chicken, servings: 6 });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(screen.getByRole('status')).toHaveTextContent('Added to Thursday dinner for 6 servings.');

  fireEvent.click(screen.getByRole('button', { name: 'Open planner' }));
  expect(mockNavigate).toHaveBeenCalledWith('/meal-planner');
  fireEvent.click(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalled();
});

test('warns before replacing a different meal already in the slot', () => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify({ Monday: { Dinner: { recipe: soup, servings: 2 } } }));
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Monday (Dinner).');
  expect(screen.getByRole('button', { name: 'Replace & Add' })).toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Tuesday' } });
  expect(screen.queryByRole('alert')).toBeNull();
});

test('days are listed Monday first, like the planner', () => {
  render(<AddToMealPlanModal isOpen recipe={chicken} onClose={jest.fn()} />);
  const days = Array.from(screen.getByLabelText('Day').options).map((o) => o.value);
  expect(days[0]).toBe('Monday');
  expect(days[6]).toBe('Sunday');
});
