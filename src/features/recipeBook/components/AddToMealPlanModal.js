// src/features/recipeBook/components/AddToMealPlanModal.js
//
// The recipe card's "+": add the recipe to the working meal plan without leaving the
// Recipe Book, then confirm where it went (keep browsing, or open the planner).

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkingPlan } from '../../mealPlanner/workingPlanStore';
import { assignRecipe } from '../../mealPlanner/mealPlanModel';
import AddToPlanForm from './AddToPlanForm';
import './AddToMealPlanModal.css';

const AddToMealPlanModal = ({ isOpen, onClose, recipe }) => {
  const navigate = useNavigate();
  const { plan, editingPlan, update } = useWorkingPlan();
  const [added, setAdded] = useState(null); // { day, meal, servings } once added

  // Each time the dialog opens it starts at the form again.
  useEffect(() => {
    if (isOpen) setAdded(null);
  }, [isOpen, recipe]);

  if (!isOpen || !recipe) return null;

  const handleAdd = ({ day, meal, servings }) => {
    update((current) => assignRecipe(current, { recipe, servings, days: [day], meal }));
    setAdded({ day, meal, servings });
  };

  return (
    <div className="add-to-meal-plan-modal-overlay" onClick={onClose}>
      <div
        className="add-to-meal-plan-modal-content"
        role="dialog"
        aria-modal="true"
        aria-label={`Add ${recipe.title} to your meal plan`}
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Add "{recipe.title}" to Meal Plan</h2>

        {added ? (
          <div className="added-confirmation" role="status">
            <p>
              Added to <strong>{added.day} {added.meal.toLowerCase()}</strong> for {added.servings}{' '}
              {added.servings === 1 ? 'serving' : 'servings'}.
            </p>
            {editingPlan && (
              <p className="added-note">This changes "{editingPlan.name}". Save it from the planner.</p>
            )}
            <div className="modal-actions">
              <button className="modal-button cancel-button" onClick={() => navigate('/meal-planner')}>
                Open planner
              </button>
              <button className="modal-button add-button" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <AddToPlanForm recipe={recipe} plan={plan} onAdd={handleAdd} />
            <button className="modal-button cancel-button modal-cancel" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default AddToMealPlanModal;
