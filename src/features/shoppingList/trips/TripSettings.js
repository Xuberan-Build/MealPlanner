// src/features/shoppingList/trips/TripSettings.js
//
// "Shopping trips: 1 · 2 · 3" segmented control, plus the day of each trip when there is
// more than one. Presentational: the page owns the settings (see tripSettingsStore.js).

import React from 'react';
import { TRIP_COUNTS, TRIP_DAYS, activeTripDays, setTripCount, setTripDay, normalizeTripSettings } from './tripSettingsStore';
import styles from './TripSettings.module.css';

const TripSettings = ({ settings, onChange, idPrefix = 'trips' }) => {
  const current = normalizeTripSettings(settings);
  const days = activeTripDays(current);
  const hintId = `${idPrefix}-hint`;

  return (
    <section className={styles.panel} aria-label="Shopping trips">
      <fieldset className={styles.segmented} aria-describedby={current.count > 1 ? hintId : undefined}>
        <legend className={styles.legend}>Shopping trips</legend>
        <div className={styles.options}>
          {TRIP_COUNTS.map((n) => {
            const id = `${idPrefix}-count-${n}`;
            return (
              <React.Fragment key={n}>
                <input
                  id={id}
                  type="radio"
                  name={`${idPrefix}-count`}
                  className={styles.radio}
                  value={n}
                  checked={current.count === n}
                  onChange={() => onChange && onChange(setTripCount(current, n))}
                />
                <label htmlFor={id} className={styles.option}>
                  {n}
                  <span className={styles.srOnly}>{n === 1 ? ' trip a week' : ' trips a week'}</span>
                </label>
              </React.Fragment>
            );
          })}
        </div>
      </fieldset>

      {current.count > 1 && (
        <>
          <div className={styles.days}>
            {days.map((day, index) => {
              const id = `${idPrefix}-day-${index}`;
              return (
                <div key={day} className={styles.dayField}>
                  <label htmlFor={id} className={styles.dayLabel}>Trip {index + 1}</label>
                  <select
                    id={id}
                    className={styles.daySelect}
                    value={day}
                    onChange={(e) => onChange && onChange(setTripDay(current, index, e.target.value))}
                  >
                    {TRIP_DAYS.map((d) => (
                      <option key={d} value={d}>{d === 'Sunday' ? 'Sunday (before the week)' : d}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
          <p id={hintId} className={styles.hint}>
            Fresh food is bought on the trip closest to the day you cook it; things that keep
            are on the first trip.
          </p>
        </>
      )}
    </section>
  );
};

export default TripSettings;
