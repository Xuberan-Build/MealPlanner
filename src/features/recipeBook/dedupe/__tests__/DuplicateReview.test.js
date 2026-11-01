import React, { useState } from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import DuplicateReview, { repointPlan } from '../DuplicateReview';
import { useDuplicateGroups, DISMISSED_DUPLICATES_KEY } from '../useDuplicateGroups';
import { WORKING_PLAN_KEY, getSlot } from '../../../mealPlanner/mealPlanModel';
import { getWorkingSession, resetWorkingPlanStoreForTests } from '../../../mealPlanner/workingPlanStore';

const ORZO = ['chicken-breast', 'orzo', 'lemon', 'garlic', 'spinach'].map((ingredientId) => ({ ingredientId }));
const SOFRITO = ['green-pepper', 'onion', 'garlic', 'cilantro'].map((ingredientId) => ({ ingredientId }));

const orzoFull = {
  id: 'o-full', title: 'Lemon Chicken Orzo', servings: '4', instructions: 'Cook.', imageUrl: 'a.jpg',
  ingredients: ORZO, updatedAt: { seconds: 1700000000 },
};
const orzoBare = { id: 'o-bare', title: 'Lemon Chicken Orzo', ingredients: ORZO };
const sofrito1 = { id: 's1', title: 'Sofrito', ingredients: SOFRITO, instructions: 'Blend' };
const sofrito2 = { id: 's2', title: 'Sofrito Recipe', ingredients: SOFRITO };
const tacos = { id: 't', title: 'Tacos', ingredients: [{ ingredientId: 'tortilla' }] };

// Harness wired like RecipeBook: recipes in state, deleteRecipe removes from state.
function Harness({ initial, deleteRecipe }) {
  const [recipes, setRecipes] = useState(initial);
  const { groups, dismiss } = useDuplicateGroups(recipes);
  const [open, setOpen] = useState(true);
  const remove = async (id) => {
    await deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  };
  return (
    <>
      <p data-testid="count">{groups.length}</p>
      <button type="button" onClick={() => setOpen(true)}>open review</button>
      <DuplicateReview isOpen={open} groups={groups} onClose={() => setOpen(false)} onDismiss={dismiss} deleteRecipe={remove} />
    </>
  );
}

const setup = ({ recipes = [orzoBare, orzoFull, tacos], plan = {}, deleteRecipe = jest.fn().mockResolvedValue() } = {}) => {
  localStorage.setItem(WORKING_PLAN_KEY, JSON.stringify(plan));
  resetWorkingPlanStoreForTests();
  const utils = render(<Harness initial={recipes} deleteRecipe={deleteRecipe} />);
  return { ...utils, deleteRecipe };
};

const groupSection = (title) => screen.getByRole('region', { name: title });

beforeEach(() => localStorage.clear());

test('is an accessible, labelled dialog and lists copies side by side with their details', () => {
  setup({ plan: { Tuesday: { Dinner: { recipe: orzoBare, servings: 2 } } } });
  const dialog = screen.getByRole('dialog', { name: 'Possible duplicates' });
  expect(dialog).toHaveAttribute('aria-modal', 'true');
  expect(screen.getByRole('heading', { name: 'Possible duplicates' })).toHaveFocus();

  const copies = within(groupSection('Lemon Chicken Orzo')).getAllByRole('listitem');
  expect(copies).toHaveLength(2);
  // Suggested (most complete) copy first and pre-selected.
  expect(within(copies[0]).getByRole('radio')).toBeChecked();
  expect(within(copies[0]).getByText('Copy 1 · suggested')).toBeInTheDocument();
  expect(within(copies[0]).getAllByText('Yes')).toHaveLength(2); // instructions + photo
  expect(within(copies[1]).getByText('Tue Dinner')).toBeInTheDocument();
  expect(within(copies[0]).getByText('Not planned')).toBeInTheDocument();
  expect(screen.getByText('Exact match')).toBeInTheDocument();
});

test('choosing a different copy to keep, then confirming, deletes only the others and repoints plan slots', async () => {
  const { deleteRecipe } = setup({
    plan: {
      Monday: { Dinner: { recipe: orzoFull, servings: 3 } },
      Thursday: { Lunch: { recipe: tacos, servings: 2 } },
    },
  });

  // Keep the bare copy instead of the suggestion.
  fireEvent.click(screen.getByRole('radio', { name: 'Keep copy 2: Lemon Chicken Orzo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));

  // Confirmation lists exactly what happens; nothing deleted yet.
  expect(screen.getByRole('heading', { name: 'Confirm merge' })).toHaveFocus();
  expect(within(screen.getByRole('list', { name: 'Recipe to keep' })).getByRole('listitem')).toHaveTextContent('Lemon Chicken Orzo (copy 2)');
  const toDelete = within(screen.getByRole('list', { name: 'Recipes to delete' })).getAllByRole('listitem');
  expect(toDelete.map((li) => li.textContent)).toEqual(['Lemon Chicken Orzo (copy 1)']);
  const moves = within(screen.getByRole('list', { name: 'Planned meals to move' })).getAllByRole('listitem');
  expect(moves.map((li) => li.textContent)).toEqual(['Monday · Dinner — 3 servings, was copy 1']);
  expect(deleteRecipe).not.toHaveBeenCalled();
  expect(getSlot(getWorkingSession().plan, 'Monday', 'Dinner').recipe.id).toBe('o-full');

  fireEvent.click(screen.getByRole('button', { name: 'Delete 1 recipe' }));
  await screen.findByRole('heading', { name: 'Merge complete' });

  expect(deleteRecipe).toHaveBeenCalledTimes(1);
  expect(deleteRecipe).toHaveBeenCalledWith('o-full');
  const plan = getWorkingSession().plan;
  expect(getSlot(plan, 'Monday', 'Dinner')).toEqual({ recipe: orzoBare, servings: 3 });
  expect(getSlot(plan, 'Thursday', 'Lunch').recipe.id).toBe('t'); // untouched
  expect(screen.getByRole('status')).toHaveTextContent('1 planned meal now use it.');
  expect(screen.getByTestId('count')).toHaveTextContent('0');
});

test('nothing is deleted or repointed without confirming (Back, Escape, close)', () => {
  const { deleteRecipe } = setup({ plan: { Monday: { Dinner: { recipe: orzoBare, servings: 1 } } } });
  fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByRole('heading', { name: 'Possible duplicates' })).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).toBeNull();

  fireEvent.click(screen.getByRole('button', { name: 'open review' }));
  fireEvent.click(screen.getByRole('button', { name: 'Close duplicate review' }));
  expect(screen.queryByRole('dialog')).toBeNull();

  expect(deleteRecipe).not.toHaveBeenCalled();
  expect(getSlot(getWorkingSession().plan, 'Monday', 'Dinner').recipe.id).toBe('o-bare');
});

test('"Not duplicates" hides the group and is remembered across visits', () => {
  const { unmount, deleteRecipe } = setup({ recipes: [orzoBare, orzoFull, sofrito1, sofrito2] });
  expect(screen.getByTestId('count')).toHaveTextContent('2');
  fireEvent.click(within(groupSection('Sofrito')).getByRole('button', { name: 'Not duplicates' }));
  expect(screen.queryByRole('region', { name: 'Sofrito' })).toBeNull();
  expect(screen.getByTestId('count')).toHaveTextContent('1');
  expect(JSON.parse(localStorage.getItem(DISMISSED_DUPLICATES_KEY))).toEqual(['s1|s2']);
  unmount();

  render(<Harness initial={[orzoBare, orzoFull, sofrito1, sofrito2]} deleteRecipe={deleteRecipe} />);
  expect(screen.getByTestId('count')).toHaveTextContent('1');
  expect(screen.queryByRole('region', { name: 'Sofrito' })).toBeNull();
  expect(deleteRecipe).not.toHaveBeenCalled();
});

test('broken localStorage does not break dismissing', () => {
  setup({ recipes: [sofrito1, sofrito2] });
  const spy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  fireEvent.click(screen.getByRole('button', { name: 'Not duplicates' }));
  expect(screen.getByTestId('count')).toHaveTextContent('0');
  spy.mockRestore();
});

test('a copy can be left out of the deletion', async () => {
  const third = { id: 's3', title: 'Sofrito', ingredients: SOFRITO };
  const { deleteRecipe } = setup({ recipes: [sofrito1, sofrito2, third] });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Delete copy 3: Sofrito Recipe' }));
  fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));
  expect(within(screen.getByRole('list', { name: 'Recipes to delete' })).getAllByRole('listitem').map((li) => li.textContent))
    .toEqual(['Sofrito (copy 2)']);
  expect(within(screen.getByRole('list', { name: 'Recipes left untouched' })).getByRole('listitem'))
    .toHaveTextContent('Sofrito Recipe (copy 3)');
  expect(screen.getByText('None of the copies being deleted are in your meal plan.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Delete 1 recipe' }));
  await screen.findByRole('heading', { name: 'Merge complete' });
  expect(deleteRecipe.mock.calls).toEqual([['s3']]);
});

test('per-recipe errors are shown without stopping the other deletions', async () => {
  const third = { id: 's3', title: 'Sofrito', ingredients: SOFRITO };
  const deleteRecipe = jest.fn((id) => (id === 's2' ? Promise.reject(new Error('Permission denied')) : Promise.resolve()));
  setup({ recipes: [sofrito1, sofrito2, third], deleteRecipe });
  fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));
  fireEvent.click(screen.getByRole('button', { name: 'Delete 2 recipes' }));
  await screen.findByRole('heading', { name: 'Merge finished with problems' });
  expect(deleteRecipe.mock.calls.map(([id]) => id).sort()).toEqual(['s2', 's3']);
  expect(within(screen.getByRole('list', { name: 'Recipes that could not be deleted' })).getByRole('listitem'))
    .toHaveTextContent('Could not delete Sofrito Recipe (copy 3): Permission denied');
  expect(within(screen.getByRole('list', { name: 'Deleted recipes' })).getByRole('listitem'))
    .toHaveTextContent('Deleted Sofrito (copy 2)');
  // The failed copy is still offered for review.
  fireEvent.click(screen.getByRole('button', { name: 'Back to duplicates' }));
  await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('1'));
});

test('repointPlan only moves slots holding the given ids and keeps servings', () => {
  const plan = {
    Monday: { Dinner: { recipe: orzoBare, servings: 5 } },
    Friday: { Dinner: { recipe: tacos, servings: 2 } },
  };
  const next = repointPlan(plan, ['o-bare'], orzoFull);
  expect(getSlot(next, 'Monday', 'Dinner')).toEqual({ recipe: orzoFull, servings: 5 });
  expect(next.Friday).toBe(plan.Friday);
  expect(repointPlan(plan, ['nope'], orzoFull)).toBe(plan);
});

describe('chained groups', () => {
  const curryA = { id: 'c1', title: 'Curry', instructions: 'Simmer', ingredients: ['chicken', 'coconut-milk', 'curry-paste', 'basil'].map((ingredientId) => ({ ingredientId })) };
  const curryB = { id: 'c2', title: 'Curry', ingredients: ['lamb', 'yogurt', 'garam-masala', 'basil'].map((ingredientId) => ({ ingredientId })) };
  const stub = { id: 'c3', title: 'Curry', ingredients: [] };
  const box = (n) => screen.getByRole('checkbox', { name: `Delete copy ${n}: Curry` });

  test('keeping a full recipe pre-selects only the stub; the different recipe is noted and left alone', async () => {
    const { deleteRecipe } = setup({ recipes: [curryA, curryB, stub] });
    expect(screen.getByRole('radio', { name: 'Keep copy 1: Curry' })).toBeChecked(); // c1, has instructions
    expect(box(2)).not.toBeChecked(); // c2: different ingredients
    expect(box(3)).toBeChecked(); // c3: empty stub
    expect(screen.getAllByText(/Different ingredients from the copy you’re keeping/)).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Merge…' }));
    expect(within(screen.getByRole('list', { name: 'Recipes to delete' })).getAllByRole('listitem').map((li) => li.textContent))
      .toEqual(['Curry (copy 3)']);
    fireEvent.click(screen.getByRole('button', { name: 'Delete 1 recipe' }));
    await screen.findByRole('heading', { name: 'Merge complete' });
    expect(deleteRecipe.mock.calls).toEqual([['c3']]);
  });

  test('switching Keep recomputes the defaults (and drops earlier manual toggles)', () => {
    setup({ recipes: [curryA, curryB, stub] });
    fireEvent.click(box(2)); // manual: select c2 while keeping c1
    expect(box(2)).toBeChecked();

    // Keep the stub: both full recipes are directly linked to it.
    fireEvent.click(screen.getByRole('radio', { name: 'Keep copy 3: Curry' }));
    expect(box(1)).toBeChecked();
    expect(box(2)).toBeChecked();
    expect(screen.queryByText(/Different ingredients/)).toBeNull();

    // Keep c2: c1 is not linked to it, the stub is.
    fireEvent.click(screen.getByRole('radio', { name: 'Keep copy 2: Curry' }));
    expect(box(1)).not.toBeChecked();
    expect(box(3)).toBeChecked();
  });

  test('Merge is disabled when nothing is selected to delete', () => {
    setup({ recipes: [curryA, curryB, stub] });
    fireEvent.click(box(3));
    expect(screen.getByRole('button', { name: 'Merge…' })).toBeDisabled();
  });
});

test('Tab and Shift+Tab stay inside the dialog', () => {
  setup();
  const dialog = screen.getByRole('dialog');
  const close = screen.getByRole('button', { name: 'Close duplicate review' });
  const merge = screen.getByRole('button', { name: 'Merge…' });

  // From the focused heading, Shift+Tab wraps to the last control.
  expect(screen.getByRole('heading', { name: 'Possible duplicates' })).toHaveFocus();
  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(merge).toHaveFocus();

  fireEvent.keyDown(document, { key: 'Tab' });
  expect(close).toHaveFocus();

  fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
  expect(merge).toHaveFocus();

  // Focus that escaped the dialog is pulled back in.
  screen.getByRole('button', { name: 'open review' }).focus();
  fireEvent.keyDown(document, { key: 'Tab' });
  expect(close).toHaveFocus();
  expect(dialog).toContainElement(document.activeElement);
});
