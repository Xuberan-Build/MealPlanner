// src/features/recipeBook/components/AddToMealPlanModal.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MEAL_TYPES, DAYS_OF_WEEK_SUNDAY_FIRST } from '../../../constants/mealPlanner';
import './AddToMealPlanModal.css';

const DAYS = DAYS_OF_WEEK_SUNDAY_FIRST;
const MEAL_TYPE_OPTIONS = MEAL_TYPES;

const AddToMealPlanModal = ({ isOpen, onClose, recipe }) => {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState('Monday');
  const [selectedMealType, setSelectedMealType] = useState('Dinner');
  const [servings, setServings] = useState(recipe?.servings || 1);

  const handleAddToMealPlan = () => {
    // Navigate to meal planner with the recipe, day, and meal type pre-selected
    navigate('/meal-planner', {
      state: {
        preSelectedRecipe: {
          recipe,
          day: selectedDay,
          mealType: selectedMealType,
          servings
        }
      }
    });
  };

  if (!isOpen || !recipe) return null;

  return (
    <div className="add-to-meal-plan-modal-overlay" onClick={onClose}>
      <div className="add-to-meal-plan-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add "{recipe.title}" to Meal Plan</h2>

        <div className="modal-section">
          <label htmlFor="day-select">Select Day:</label>
          <select
            id="day-select"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="modal-select"
          >
            {DAYS.map(day => (
              <option key={day} value={day}>{day}</option>
            ))}
          </select>
        </div>

        <div className="modal-section">
          <label htmlFor="meal-type-select">Meal Type:</label>
          <select
            id="meal-type-select"
            value={selectedMealType}
            onChange={(e) => setSelectedMealType(e.target.value)}
            className="modal-select"
          >
            {MEAL_TYPE_OPTIONS.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="modal-section">
          <label htmlFor="servings-input">Servings:</label>
          <input
            id="servings-input"
            type="number"
            min="1"
            max="20"
            value={servings}
            onChange={(e) => setServings(parseInt(e.target.value) || 1)}
            className="modal-input"
          />
        </div>

        <div className="modal-actions">
          <button className="modal-button cancel-button" onClick={onClose}>
            Cancel
          </button>
          <button className="modal-button add-button" onClick={handleAddToMealPlan}>
            Add to Meal Plan
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToMealPlanModal;
