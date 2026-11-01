import React from 'react';
import { render, screen, act } from '@testing-library/react';
import {
  getWorkingSession,
  setWorkingSession,
  updateWorkingPlan,
  useWorkingPlan,
  resetWorkingPlanStoreForTests,
} from '../workingPlanStore';
import { setSlot, removeSlot, WORKING_PLAN_KEY, WORKING_SESSION_KEY } from '../mealPlanModel';

const tacos = { id: 'r1', title: 'Tacos', servings: '4' };

beforeEach(() => {
  localStorage.clear();
  resetWorkingPlanStoreForTests();
});

test('reads the saved session and keeps edit context when the plan changes', () => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify({}));
  localStorage.setItem(
    WORKING_SESSION_KEY,
    JSON.stringify({ workingId: 'w1', editingPlan: { id: 'p1', name: 'Week 1' }, originalPlan: {} }),
  );
  const next = updateWorkingPlan((plan) => setSlot(plan, 'Monday', 'Dinner', { recipe: tacos, servings: 2 }));

  expect(next.editingPlan).toEqual({ id: 'p1', name: 'Week 1' });
  expect(next.workingId).toBe('w1');
  expect(JSON.parse(localStorage.getItem(WORKING_PLAN_KEY)).Monday.Dinner.servings).toBe(2);
});

test('an update that changes nothing does not write or notify', () => {
  const before = getWorkingSession();
  expect(updateWorkingPlan((plan) => removeSlot(plan, 'Monday', 'Dinner'))).toBe(before);
});

test('components re-render when the plan changes, from anywhere', () => {
  function Count() {
    const { plan } = useWorkingPlan();
    return <span>{Object.keys(plan).length} days</span>;
  }
  render(<Count />);
  expect(screen.getByText('0 days')).toBeInTheDocument();

  act(() => {
    updateWorkingPlan((plan) => setSlot(plan, 'Friday', 'Dinner', { recipe: tacos, servings: 1 }));
  });
  expect(screen.getByText('1 days')).toBeInTheDocument();

  act(() => {
    setWorkingSession({ plan: {} });
  });
  expect(screen.getByText('0 days')).toBeInTheDocument();
});

test('changes made in another tab are picked up', () => {
  function Count() {
    const { plan } = useWorkingPlan();
    return <span>{Object.keys(plan).join(',') || 'empty'}</span>;
  }
  render(<Count />);
  act(() => {
    localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify({ Sunday: { Dinner: { recipe: tacos, servings: 1 } } }));
    window.dispatchEvent(new StorageEvent('storage', { key: WORKING_PLAN_KEY }));
  });
  expect(screen.getByText('Sunday')).toBeInTheDocument();
});
