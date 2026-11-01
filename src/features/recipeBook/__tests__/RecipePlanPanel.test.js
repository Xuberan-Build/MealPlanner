import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RecipePlanPanel from '../components/RecipePlanPanel';
import { WORKING_PLAN_KEY, WORKING_SESSION_KEY, getSlot } from '../../mealPlanner/mealPlanModel';
import { getWorkingSession, resetWorkingPlanStoreForTests } from '../../mealPlanner/workingPlanStore';

const tacos = { id: 'r1', title: 'Tacos', servings: '4', mealType: 'Dinner' };
const soup = { id: 'r2', title: 'Soup', servings: '2', mealType: 'Dinner' };

const renderPanel = (plan = {}, session = null) => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify(plan));
  if (session) localStorage.setItem(WORKING_SESSION_KEY, JSON.stringify(session));
  resetWorkingPlanStoreForTests();
  return render(
    <MemoryRouter>
      <RecipePlanPanel recipe={tacos} />
    </MemoryRouter>
  );
};

beforeEach(() => localStorage.clear());

test('a recipe that is not planned offers to add it', () => {
  renderPanel();
  expect(screen.getByText('Not planned yet.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Day'), { target: { value: 'Wednesday' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(getSlot(getWorkingSession().plan, 'Wednesday', 'Dinner')).toEqual({ recipe: tacos, servings: 4 });
  expect(screen.getByText('Wednesday · Dinner')).toBeInTheDocument();
});

test('lists planned days; servings and remove change the working plan', () => {
  renderPanel({
    Thursday: { Dinner: { recipe: tacos, servings: 2 } },
    Monday: { Dinner: { recipe: tacos, servings: 1 } },
    Friday: { Dinner: { recipe: soup, servings: 2 } },
  });
  const rows = screen.getAllByRole('listitem');
  expect(rows.map((r) => within(r).getByText(/·/).textContent)).toEqual(['Monday · Dinner', 'Thursday · Dinner']);
  expect(screen.getByRole('button', { name: 'Fewer servings on Monday Dinner' })).toBeDisabled();

  fireEvent.click(screen.getByRole('button', { name: 'More servings on Monday Dinner' }));
  expect(getSlot(getWorkingSession().plan, 'Monday', 'Dinner').servings).toBe(2);

  fireEvent.click(screen.getByRole('button', { name: 'Remove from Thursday Dinner' }));
  expect(getSlot(getWorkingSession().plan, 'Thursday', 'Dinner')).toBeNull();
  expect(getSlot(getWorkingSession().plan, 'Friday', 'Dinner').recipe.title).toBe('Soup'); // untouched
  expect(screen.queryByText('Thursday · Dinner')).toBeNull();
});

test('says which saved plan the changes go to, and links to the planner', () => {
  renderPanel({}, { workingId: 'w1', editingPlan: { id: 'p1', name: 'Week 1' }, originalPlan: {} });
  expect(screen.getByText('Changes go to "Week 1". Save them from the planner.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open planner →' })).toHaveAttribute('href', '/meal-planner');
});

test('adding over a different meal warns first', () => {
  renderPanel({ Monday: { Dinner: { recipe: soup, servings: 2 } } });
  expect(screen.getByRole('alert')).toHaveTextContent('This will replace Soup on Monday (Dinner).');
});
