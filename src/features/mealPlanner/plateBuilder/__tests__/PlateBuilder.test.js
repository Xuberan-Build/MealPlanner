import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import PlateBuilder from '../PlateBuilder';
import { plateToRecipe, togglePick, emptyPlate } from '../plateModel';

const pick = (name) => fireEvent.click(screen.getByRole('button', { name }));

describe('PlateBuilder', () => {
  test('continue stays disabled until something is picked', () => {
    const onContinue = jest.fn();
    render(<PlateBuilder mealType="Dinner" onContinue={onContinue} />);
    const continueButton = screen.getByRole('button', { name: 'Choose days' });
    expect(continueButton).toBeDisabled();
    expect(screen.getByText('Pick at least one thing above.')).toBeInTheDocument();

    pick('Salmon');
    expect(screen.getByRole('button', { name: 'Salmon' })).toHaveAttribute('aria-pressed', 'true');
    expect(continueButton).toBeEnabled();
  });

  test('builds a per-person plate recipe for the chosen number of people', () => {
    const onContinue = jest.fn();
    render(<PlateBuilder mealType="Dinner" onContinue={onContinue} />);
    pick('Chicken thighs');
    pick('Broccoli');
    pick('Rice');
    fireEvent.change(screen.getByLabelText('Chicken thighs amount per person'), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'More people' }));
    fireEvent.click(screen.getByRole('button', { name: 'Choose days' }));

    const { recipe, people, saveAsFavorite } = onContinue.mock.calls[0][0];
    expect(people).toBe(2);
    expect(saveAsFavorite).toBe(false);
    expect(recipe).toMatchObject({ kind: 'plate', title: 'Chicken thighs, Broccoli & Rice', mealType: 'Dinner', servings: 1 });
    expect(recipe.ingredients.map((i) => [i.ingredientId, i.amount, i.unit])).toEqual([
      ['Chicken thighs', '8', 'oz'],
      ['Broccoli', '1 1/2', 'cup'],
      ['Rice', '1/2', 'cup'],
    ]);
  });

  test('bad amounts block continuing with a clear message', () => {
    render(<PlateBuilder onContinue={jest.fn()} />);
    pick('Tofu');
    fireEvent.change(screen.getByLabelText('Tofu amount per person'), { target: { value: 'loads' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Tofu: enter an amount like 6, 1/2 or 1 1/2');
    expect(screen.getByRole('button', { name: 'Choose days' })).toBeDisabled();
  });

  test('custom components, removing picks, naming and saving as a favourite', () => {
    const onContinue = jest.fn();
    render(<PlateBuilder onContinue={onContinue} />);
    const veg = screen.getByRole('heading', { name: 'Veg' }).closest('section');
    fireEvent.change(within(veg).getByLabelText('Add another veg'), { target: { value: 'Bok choy' } });
    fireEvent.click(within(veg).getByRole('button', { name: 'Add' }));
    expect(within(veg).getByRole('button', { name: 'Bok choy' })).toHaveAttribute('aria-pressed', 'true');

    pick('Eggs');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Eggs' }));
    expect(screen.getByRole('button', { name: 'Eggs' })).toHaveAttribute('aria-pressed', 'false');

    fireEvent.change(screen.getByPlaceholderText('Bok choy'), { target: { value: 'Green bowl' } });
    fireEvent.click(screen.getByLabelText('Save to "Your plates"'));
    fireEvent.click(screen.getByRole('button', { name: 'Choose days' }));
    expect(onContinue.mock.calls[0][0]).toMatchObject({ saveAsFavorite: true, recipe: { title: 'Green bowl' } });
  });

  test('favourites load into the builder; an existing plate opens pre-filled', () => {
    const favorite = { id: 'f1', ...plateToRecipe(togglePick(emptyPlate(), 'protein', 'Steak'), { title: 'Steak night' }) };
    const onContinue = jest.fn();
    const { unmount } = render(<PlateBuilder favorites={[favorite]} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole('button', { name: 'Steak night' }));
    expect(screen.getByRole('button', { name: 'Steak' })).toHaveAttribute('aria-pressed', 'true');
    unmount();

    render(<PlateBuilder initialRecipe={favorite} initialPeople={3} submitLabel="Save Changes" onContinue={onContinue} />);
    expect(screen.getByLabelText('Number of people')).toHaveTextContent('3');
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(onContinue).toHaveBeenLastCalledWith(expect.objectContaining({ people: 3, recipe: expect.objectContaining({ title: 'Steak night' }) }));
  });
});
