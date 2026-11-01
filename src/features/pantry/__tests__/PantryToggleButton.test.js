import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import PantryToggleButton from '../PantryToggleButton';

describe('PantryToggleButton', () => {
  const item = { id: 1, name: 'Salt' };

  test.each([
    ['need', 'Need', 'have'],
    ['partial', 'Have some', 'have'],
    ['have', 'Have it', 'need'],
    [undefined, 'Need', 'have'],
    ['bogus', 'Need', 'have'],
  ])('status %s shows %s and toggles to %s', (status, label, next) => {
    const onChange = jest.fn();
    render(<PantryToggleButton item={item} pantryStatus={status} onChange={onChange} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent(label);
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(next, item);
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
