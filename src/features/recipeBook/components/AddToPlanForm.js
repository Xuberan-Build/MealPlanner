// src/features/recipeBook/components/AddToPlanForm.js
//
// Days (several at once) / meal / servings for putting a recipe into the working meal plan.
// Any recipe can go in any meal: the meal starts at the recipe's own type but a lunch can
// be planned for dinner. Warns before replacing a different meal on any chosen day.
// Used by the card's "+" dialog and the recipe detail panel.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { MEAL_TYPES, DAYS_OF_WEEK, DAYS_OF_WEEK_ABBREVIATED } from '../../../constants/mealPlanner';
import { parseServings } from '../../../utils/quantity';
import { findConflicts, firstOpenDay } from '../../mealPlanner/mealPlanModel';
import './AddToPlanForm.css';

/** The recipe's own meal type when it is one of ours, else Dinner. */
const defaultMealFor = (recipe) =>
  MEAL_TYPES.find((m) => m.toLowerCase() === String(recipe?.mealType || '').toLowerCase()) || 'Dinner';

const defaultServingsFor = (recipe) => String(Math.round(parseServings(recipe?.servings) || 1));

const SHORT = Object.fromEntries(DAYS_OF_WEEK_ABBREVIATED.map(({ key, label }) => [key, label]));

/** "Monday", "Monday and Thursday", "Monday, Wednesday and Friday" */
export const joinDays = (days) =>
  days.length <= 1 ? days.join('') : `${days.slice(0, -1).join(', ')} and ${days[days.length - 1]}`;

const AddToPlanForm = ({ recipe, plan = {}, onAdd, submitLabel = 'Add to Meal Plan' }) => {
  const uid = useId();
  const [meal, setMeal] = useState(() => defaultMealFor(recipe));
  const [days, setDays] = useState(() => [firstOpenDay(plan, defaultMealFor(recipe))]);
  // Text so the box can be cleared while typing; parsed when adding.
  const [servingsText, setServingsText] = useState(() => defaultServingsFor(recipe));

  // A different recipe: start from its own defaults.
  useEffect(() => {
    const nextMeal = defaultMealFor(recipe);
    setMeal(nextMeal);
    setServingsText(defaultServingsFor(recipe));
    setDays([firstOpenDay(plan, nextMeal)]);
    // Only when the recipe changes; re-seeding on every plan change would undo the user's picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe]);

  const servings = Math.max(1, Math.round(parseServings(servingsText) || 1));
  const orderedDays = useMemo(() => DAYS_OF_WEEK.filter((d) => days.includes(d)), [days]);
  const conflicts = useMemo(() => findConflicts(plan, orderedDays, meal, recipe), [plan, orderedDays, meal, recipe]);

  const toggleDay = (day) =>
    setDays((current) => (current.includes(day) ? current.filter((d) => d !== day) : [...current, day]));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (orderedDays.length === 0 || typeof onAdd !== 'function') return;
    onAdd({ days: orderedDays, meal, servings });
  };

  const mealMismatch = recipe?.mealType && meal.toLowerCase() !== String(recipe.mealType).toLowerCase();

  return (
    <form className="add-to-plan-form" onSubmit={handleSubmit}>
      <fieldset className="add-to-plan-days">
        <legend>Days</legend>
        <div className="add-to-plan-day-chips">
          {DAYS_OF_WEEK.map((day) => {
            const selected = days.includes(day);
            return (
              <button
                key={day}
                type="button"
                className={`add-to-plan-day ${selected ? 'selected' : ''}`}
                aria-pressed={selected}
                aria-label={day}
                onClick={() => toggleDay(day)}
              >
                {SHORT[day]}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="add-to-plan-fields">
        <label htmlFor={`${uid}-meal`}>Meal</label>
        <select id={`${uid}-meal`} value={meal} onChange={(e) => setMeal(e.target.value)}>
          {MEAL_TYPES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>

        <label htmlFor={`${uid}-servings`}>Servings</label>
        <input
          id={`${uid}-servings`}
          type="number"
          min="1"
          max="99"
          value={servingsText}
          onChange={(e) => setServingsText(e.target.value)}
          onBlur={() => setServingsText(String(servings))}
        />
      </div>

      {mealMismatch && (
        <p className="add-to-plan-hint">
          Saved as a {String(recipe.mealType).toLowerCase()} recipe; it will be planned for {meal.toLowerCase()}.
        </p>
      )}

      {conflicts.length > 0 && (
        <p className="replace-warning" role="alert">
          This will replace {conflicts.map(({ day, title }) => `${title} on ${day}`).join(', ')} ({meal}).
        </p>
      )}

      <button type="submit" className="add-to-plan-submit" disabled={orderedDays.length === 0}>
        {conflicts.length > 0 ? 'Replace & Add' : submitLabel}
      </button>
    </form>
  );
};

export default AddToPlanForm;
