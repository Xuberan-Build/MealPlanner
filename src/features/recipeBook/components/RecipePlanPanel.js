// src/features/recipeBook/components/RecipePlanPanel.js
//
// "In your meal plan" on a recipe: where it is planned (change servings, remove), add it to
// another day, and jump to the planner. Reads and writes the shared working plan, so the
// Meal Planner sees every change.

import React from 'react';
import { Link } from 'react-router-dom';
import { useWorkingPlan } from '../../mealPlanner/workingPlanStore';
import { setSlot, removeSlot, assignRecipe, slotsForRecipe, getSlot } from '../../mealPlanner/mealPlanModel';
import AddToPlanForm from './AddToPlanForm';
import './RecipePlanPanel.css';

const MAX_SERVINGS = 99;

const RecipePlanPanel = ({ recipe }) => {
  const { plan, editingPlan, update } = useWorkingPlan();
  const slots = slotsForRecipe(plan, recipe);

  const changeServings = (day, meal, delta) =>
    update((current) => {
      const slot = getSlot(current, day, meal);
      if (!slot) return current;
      const servings = Math.min(MAX_SERVINGS, Math.max(1, slot.servings + delta));
      return servings === slot.servings ? current : setSlot(current, day, meal, { recipe: slot.recipe, servings });
    });

  const remove = (day, meal) => update((current) => removeSlot(current, day, meal));

  const add = ({ days, meal, servings }) =>
    update((current) => assignRecipe(current, { recipe, servings, days, meal }));

  return (
    <section className="recipe-plan-panel" aria-labelledby="recipe-plan-title">
      <div className="recipe-plan-header">
        <h2 id="recipe-plan-title" className="recipe-section-title">In your meal plan</h2>
        <Link to="/meal-planner" className="recipe-plan-open">Open planner →</Link>
      </div>
      <p className="recipe-plan-context">
        {editingPlan
          ? `Changes go to "${editingPlan.name}". Save them from the planner.`
          : 'Changes go to your current plan.'}
      </p>

      {slots.length === 0 ? (
        <p className="recipe-plan-empty">Not planned yet.</p>
      ) : (
        <ul className="recipe-plan-slots">
          {slots.map(({ day, meal, servings }) => (
            <li key={`${day}-${meal}`} className="recipe-plan-slot">
              <span className="recipe-plan-when">{day} · {meal}</span>
              <span className="recipe-plan-stepper">
                <button
                  type="button"
                  onClick={() => changeServings(day, meal, -1)}
                  disabled={servings <= 1}
                  aria-label={`Fewer servings on ${day} ${meal}`}
                >
                  −
                </button>
                <span aria-live="polite">{servings} {servings === 1 ? 'serving' : 'servings'}</span>
                <button
                  type="button"
                  onClick={() => changeServings(day, meal, 1)}
                  disabled={servings >= MAX_SERVINGS}
                  aria-label={`More servings on ${day} ${meal}`}
                >
                  +
                </button>
              </span>
              <button
                type="button"
                className="recipe-plan-remove"
                onClick={() => remove(day, meal)}
                aria-label={`Remove from ${day} ${meal}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <details className="recipe-plan-add" open={slots.length === 0}>
        <summary>{slots.length === 0 ? 'Add to days' : 'Add to more days'}</summary>
        <AddToPlanForm recipe={recipe} plan={plan} onAdd={add} submitLabel="Add" />
      </details>
    </section>
  );
};

export default RecipePlanPanel;
