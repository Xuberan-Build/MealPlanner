import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PantryToggleButton from '../PantryToggleButton';

describe('PantryToggleButton', () => {
  const item = { id: 1, name: 'Salt' };

  // The visible text says what tapping does; the accessible name also says where it goes.
  test.each([
    ['need', 'Have it', 'Salt: I have it, move to Already have', 'have'],
    ['partial', 'Have enough', 'Salt: I have enough, move to Already have', 'have'],
    ['have', 'Need it', 'Salt: I need it, move back to the list', 'need'],
    [undefined, 'Have it', 'Salt: I have it, move to Already have', 'have'],
    ['bogus', 'Have it', 'Salt: I have it, move to Already have', 'have'],
  ])('status %s shows "%s" and toggles', (status, label, name, next) => {
    const onChange = jest.fn();
    render(<PantryToggleButton item={item} pantryStatus={status} onChange={onChange} />);
    const btn = screen.getByRole('button', { name });
    expect(btn).toHaveTextContent(label);
    expect(btn).toBeVisible();
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(next, item);
  });

  test('compact keeps a meaningful accessible name without visible text', () => {
    render(<PantryToggleButton item={item} pantryStatus="need" onChange={() => {}} compact />);
    const btn = screen.getByRole('button', { name: 'Salt: I have it, move to Already have' });
    expect(btn).not.toHaveTextContent('Have it');
  });

  test('disabled does not call onChange', () => {
    const onChange = jest.fn();
    render(<PantryToggleButton item={item} pantryStatus="need" onChange={onChange} disabled />);
    fireEvent.click(screen.getByRole('button'));
    expect(onChange).not.toHaveBeenCalled();
  });

  test('click does not bubble to the row', () => {
    const rowClick = jest.fn();
    render(
      <div onClick={rowClick}>
        <PantryToggleButton item={item} pantryStatus="have" onChange={() => {}} compact />
      </div>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(rowClick).not.toHaveBeenCalled();
  });
});
