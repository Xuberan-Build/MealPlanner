// src/features/recipeBook/components/AddToPlanForm.js
//
// Day / meal / servings for putting a recipe into the working meal plan. Warns before it
// would replace a different meal. Used by the card's "+" dialog and the recipe detail panel.

import React, { useEffect, useId, useMemo, useState } from 'react';
import { MEAL_TYPES, DAYS_OF_WEEK } from '../../../constants/mealPlanner';
import { parseServings } from '../../../utils/quantity';
import { getSlot, recipeIdentity } from '../../mealPlanner/mealPlanModel';
import './AddToPlanForm.css';

/** The recipe's own meal type when it is one of ours, else Dinner. */
const defaultMealFor = (recipe) =>
  MEAL_TYPES.find((m) => m.toLowerCase() === String(recipe?.mealType || '').toLowerCase()) || 'Dinner';

const defaultServingsFor = (recipe) => String(Math.round(parseServings(recipe?.servings) || 1));

const AddToPlanForm = ({ recipe, plan = {}, onAdd, submitLabel = 'Add to Meal Plan', initialDay = 'Monday' }) => {
  const uid = useId();
  const [day, setDay] = useState(initialDay);
  const [meal, setMeal] = useState(() => defaultMealFor(recipe));
  // Text so the box can be cleared while typing; parsed when adding.
  const [servingsText, setServingsText] = useState(() => defaultServingsFor(recipe));

  // A different recipe: start from its own defaults.
  useEffect(() => {
    setMeal(defaultMealFor(recipe));
    setServingsText(defaultServingsFor(recipe));
  }, [recipe]);

  const servings = Math.max(1, Math.round(parseServings(servingsText) || 1));

  const replacing = useMemo(() => {
    const slot = getSlot(plan, day, meal);
    return slot && recipeIdentity(slot.recipe) !== recipeIdentity(recipe) ? slot.recipe : null;
  }, [plan, day, meal, recipe]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (typeof onAdd === 'function') onAdd({ day, meal, servings });
  };

  return (
    <form className="add-to-plan-form" onSubmit={handleSubmit}>
      <div className="add-to-plan-fields">
        <label htmlFor={`${uid}-day`}>Day</label>
        <select id={`${uid}-day`} value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS_OF_WEEK.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

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

      {replacing && (
        <p className="replace-warning" role="alert">
          This will replace {replacing.title || 'the meal'} on {day} ({meal}).
        </p>
      )}

      <button type="submit" className="add-to-plan-submit">
        {replacing ? 'Replace & Add' : submitLabel}
      </button>
    </form>
  );
};

export default AddToPlanForm;
