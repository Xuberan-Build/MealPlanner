import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import TripSettings from '../TripSettings';
import { normalizeTripSettings } from '../tripSettingsStore';

const Harness = ({ onChange }) => {
  const [settings, setSettings] = useState(normalizeTripSettings(null));
  return (
    <TripSettings
      settings={settings}
      onChange={(next) => { setSettings(next); onChange(next); }}
    />
  );
};

test('choosing 1, 2 or 3 trips shows editable days for each trip', () => {
  const onChange = jest.fn();
  render(<Harness onChange={onChange} />);

  const group = screen.getByRole('group', { name: 'Shopping trips' });
  expect(group).toBeInTheDocument();
  expect(screen.getByRole('radio', { name: '1 trip a week' })).toBeChecked();
  expect(screen.queryByLabelText('Trip 1')).toBeNull(); // one trip: nothing to pick

  fireEvent.click(screen.getByRole('radio', { name: '2 trips a week' }));
  expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ count: 2 }));
  expect(screen.getByLabelText('Trip 1')).toHaveValue('Sunday');
  expect(screen.getByLabelText('Trip 2')).toHaveValue('Wednesday');

  fireEvent.change(screen.getByLabelText('Trip 2'), { target: { value: 'Thursday' } });
  expect(screen.getByLabelText('Trip 2')).toHaveValue('Thursday');

  fireEvent.click(screen.getByRole('radio', { name: '3 trips a week' }));
  expect(screen.getByLabelText('Trip 3')).toHaveValue('Thursday');
  expect(screen.getByLabelText('Trip 2')).toHaveValue('Tuesday');
});
