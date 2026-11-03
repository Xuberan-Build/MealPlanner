import React, { useState } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import TypeSelector from '../TypeSelector';

const getInput = () => screen.getByRole('combobox');
const optionTexts = () => screen.queryAllByRole('option').map((o) => o.textContent);

const type = (text) => {
  const input = getInput();
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: text } });
};

// Parent like RecipeDetails: keeps the value in state and reads it in onBlur.
function DietHarness({ initial = 'Not Specified', options = [], onSaved }) {
  const [diet, setDiet] = useState(initial);
  return (
    <TypeSelector
      value={diet}
      onChange={setDiet}
      onBlur={() => onSaved(diet)}
      options={options}
      placeholder="Select or type diet type..."
      label="Diet Type"
    />
  );
}

describe('TypeSelector (diet mode)', () => {
  test('ARIA combobox wiring', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={['Italian']} label="Diet Type" />);
    const input = getInput();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(screen.getByLabelText('Diet Type')).toBe(input);

    type('ital');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    const [first] = screen.getAllByRole('option');
    expect(first).toHaveTextContent('Italian');
    // Strong (prefix) match is auto-highlighted.
    expect(input).toHaveAttribute('aria-activedescendant', first.id);
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  test('shows "Not Specified" as empty and lists user + curated types on focus', () => {
    render(<TypeSelector value="Not Specified" onChange={jest.fn()} options={['Haitian', 'vegan ']} label="Diet Type" />);
    expect(getInput()).toHaveValue('');
    fireEvent.focus(getInput());
    const texts = optionTexts();
    expect(texts).toEqual(expect.arrayContaining(['Haitian', 'Vegan', 'Gluten-Free', 'FMD']));
    expect(texts.filter((t) => t === 'Vegan')).toHaveLength(1);
  });

  test('displays the canonical form of a messy stored value', () => {
    render(<TypeSelector value="gluten free " onChange={jest.fn()} label="Diet Type" />);
    expect(getInput()).toHaveValue('Gluten-Free');
  });

  test('highlights the matched part', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={[]} label="Diet Type" />);
    type('free');
    const marks = screen.getByRole('listbox').querySelectorAll('mark');
    expect([...marks].map((m) => m.textContent)).toEqual(expect.arrayContaining(['Free']));
  });

  test('keyboard: ArrowDown/ArrowUp move, Enter commits canonical, Escape closes', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(<TypeSelector value="" onChange={onChange} onCommit={onCommit} options={[]} label="Diet Type" />);
    type('low');
    const input = getInput();
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent).slice(0, 2)).toEqual(['Low-Fat', 'Low-Carb']);
    expect(input).toHaveAttribute('aria-activedescendant', options[0].id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id);
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' }); // wraps to the last option
    const all = screen.getAllByRole('option');
    expect(input).toHaveAttribute('aria-activedescendant', all[all.length - 1].id);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');

    fireEvent.keyDown(input, { key: 'ArrowDown' }); // reopens at the first option
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[0].id);
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('Low-Carb');
    expect(onCommit).toHaveBeenLastCalledWith('Low-Carb', { isNew: true });
    expect(input).toHaveValue('Low-Carb');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('Escape on an open list does not bubble to the surrounding modal', () => {
    const onModalKey = jest.fn();
    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div onKeyDown={onModalKey}>
        <TypeSelector value="" onChange={jest.fn()} label="Diet Type" />
      </div>
    );
    type('veg');
    fireEvent.keyDown(getInput(), { key: 'Escape' });
    expect(onModalKey).not.toHaveBeenCalled();
  });

  test('alias: typing GF + Enter commits Gluten-Free', () => {
    const onChange = jest.fn();
    render(<TypeSelector value="" onChange={onChange} label="Diet Type" />);
    type('gf');
    expect(optionTexts()[0]).toBe('Gluten-Free');
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('Gluten-Free');
  });

  test('near miss shows "Did you mean …?" and no Create', () => {
    const onChange = jest.fn();
    render(<TypeSelector value="" onChange={onChange} options={[]} label="Diet Type" />);
    type('vegetaryan');
    const texts = optionTexts();
    expect(texts[0]).toBe('Did you mean Vegetarian?');
    expect(texts.some((t) => t.startsWith('Create'))).toBe(false);
    // Not auto-highlighted: a typo is not silently corrected.
    expect(getInput()).not.toHaveAttribute('aria-activedescendant');
    fireEvent.click(screen.getByRole('option', { name: 'Did you mean Vegetarian?' }));
    expect(onChange).toHaveBeenLastCalledWith('Vegetarian');
  });

  test('typo with a user type: "Italain" -> Did you mean Italian?', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={['Italian']} label="Diet Type" />);
    type('Italain');
    expect(optionTexts()[0]).toBe('Did you mean Italian?');
  });

  test('nothing close offers Create with the canonical name', () => {
    const onChange = jest.fn();
    const onCommit = jest.fn();
    render(<TypeSelector value="" onChange={onChange} onCommit={onCommit} options={['Italian']} label="Diet Type" />);
    type('soul  food');
    expect(optionTexts()).toEqual(['Create “Soul Food”']);
    expect(screen.queryByText(/Did you mean/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: /Create/ }));
    expect(onChange).toHaveBeenLastCalledWith('Soul Food');
    expect(onCommit).toHaveBeenLastCalledWith('Soul Food', { isNew: true });
  });

  test('a prefix match is close enough: no Create', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={['Italian']} label="Diet Type" />);
    type('Ital');
    expect(optionTexts()).toEqual(['Italian']);
  });

  test('blur commits the canonical typed value, then onBlur sees it in parent state', async () => {
    const onSaved = jest.fn();
    render(<DietHarness onSaved={onSaved} />);
    type('  vegan ');
    await act(async () => { fireEvent.blur(getInput()); });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved).toHaveBeenCalledWith('Vegan');
    expect(getInput()).toHaveValue('Vegan');
  });

  test('blur keeps an unknown custom value (never lost) and a typo the user chose to keep', async () => {
    const onSaved = jest.fn();
    render(<DietHarness onSaved={onSaved} />);
    type('vegetaryan');
    await act(async () => { fireEvent.blur(getInput()); });
    expect(onSaved).toHaveBeenLastCalledWith('Vegetaryan');
  });

  test('choosing an option notifies onBlur once, with the new value', async () => {
    const onSaved = jest.fn();
    render(<DietHarness onSaved={onSaved} options={['Haitian']} />);
    type('hait');
    await act(async () => { fireEvent.click(screen.getByRole('option', { name: 'Haitian' })); });
    expect(onSaved).toHaveBeenCalledWith('Haitian');
    await act(async () => { fireEvent.blur(getInput()); });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  test('clearing the field commits emptyValue', async () => {
    const onChange = jest.fn();
    render(<TypeSelector value="Keto" onChange={onChange} label="Diet Type" emptyValue="Not Specified" />);
    type('');
    await act(async () => { fireEvent.blur(getInput()); });
    expect(onChange).toHaveBeenLastCalledWith('Not Specified');
  });

  test('focus + blur without typing does not change the value', async () => {
    const onChange = jest.fn();
    const onBlur = jest.fn();
    render(<TypeSelector value="vegan " onChange={onChange} onBlur={onBlur} label="Diet Type" />);
    fireEvent.focus(getInput());
    await act(async () => { fireEvent.blur(getInput()); });
    expect(onChange).not.toHaveBeenCalled();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('tolerates diet-type objects as options', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={[{ id: '1', name: 'Haitian' }, null, 3]} label="Diet Type" />);
    type('hai');
    expect(optionTexts()[0]).toBe('Haitian');
  });

  test('follows a new value from the parent when not editing', () => {
    const { rerender } = render(<TypeSelector value="Keto" onChange={jest.fn()} label="Diet Type" />);
    rerender(<TypeSelector value="paleo" onChange={jest.fn()} label="Diet Type" />);
    expect(getInput()).toHaveValue('Paleo');
  });
});

describe('TypeSelector (plain / meal type mode)', () => {
  const props = { options: ['Breakfast', 'Lunch', 'Dinner'], placeholder: 'Select meal type...', label: 'Meal Type' };

  test('substring list on focus, raw onChange per keystroke, no diet aliases', () => {
    const onChange = jest.fn();
    render(<TypeSelector value="Not Specified" onChange={onChange} {...props} />);
    expect(getInput()).toHaveValue('Not Specified');
    fireEvent.focus(getInput());
    expect(optionTexts()).toEqual(['Breakfast', 'Dinner', 'Lunch']);
    type('din');
    expect(onChange).toHaveBeenLastCalledWith('din');
    expect(optionTexts()).toEqual(['Dinner']);
    expect(optionTexts()).not.toContain('Vegan');
  });

  test('Enter picks the highlighted option', () => {
    const onChange = jest.fn();
    render(<TypeSelector value="" onChange={onChange} {...props} />);
    type('lun');
    fireEvent.keyDown(getInput(), { key: 'Enter' });
    expect(onChange).toHaveBeenLastCalledWith('Lunch');
  });

  test('unknown value offers Create and keeps the text as typed', () => {
    const onChange = jest.fn();
    render(<TypeSelector value="" onChange={onChange} {...props} />);
    type('snack');
    expect(optionTexts()).toEqual(['Create “snack”']);
    fireEvent.click(screen.getByRole('option', { name: 'Create "snack"' }));
    expect(onChange).toHaveBeenLastCalledWith('snack');
  });

  test('explicit mode overrides the label heuristic', () => {
    render(<TypeSelector value="" onChange={jest.fn()} options={['Lunch']} label="Diet Type" mode="plain" />);
    type('gf');
    expect(optionTexts()).toEqual(['Create “gf”']);
  });
});
