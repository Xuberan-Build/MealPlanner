import React, { useState, useEffect } from 'react';
import './RecipeSelectionModal.css';

const RecipeSelectionModal = ({
  isOpen,
  onClose,
  onRecipeSelect,
  mealType,
  availableRecipes,
  selectedMealSlot
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedServings, setSelectedServings] = useState(1);
  const [selectedDays, setSelectedDays] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [currentStep, setCurrentStep] = useState(1); // 1: Recipe, 2: Servings, 3: Days
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const isEditMode = selectedMealSlot?.isEditing || false;
    const editingDay = selectedMealSlot?.day;
  useEffect(() => {
    if (availableRecipes && mealType) {
      const filtered = availableRecipes.filter(recipe =>
        recipe.mealType?.toLowerCase() === mealType?.toLowerCase()
      );
      setFilteredRecipes(filtered);
    }
  }, [mealType, availableRecipes]);

  useEffect(() => {
  if (isOpen && isEditMode && selectedMealSlot?.existingMeal) {
    const existingMeal = selectedMealSlot.existingMeal;
    
    let recipe, servings;
    if (existingMeal.recipe && typeof existingMeal.servings !== 'undefined') {
      recipe = existingMeal.recipe;
      servings = existingMeal.servings;
    } else if (existingMeal.title) {
      recipe = existingMeal;
      servings = existingMeal.selectedServings || existingMeal.servings || 1;
    }
    
    if (recipe) {
      setSelectedRecipe(recipe);
      setSelectedServings(servings);
      setSelectedDays([editingDay]);
      setCurrentStep(2);
    }
  } else if (isOpen) {
    resetModalState();
  }
}, [isOpen, isEditMode, selectedMealSlot]);

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setSelectedServings(recipe.servings || 1); // Default to recipe's serving size
    setCurrentStep(2); // Move to servings selection
  };

  const handleServingsConfirm = () => {
    setSelectedDays([]);
    setCurrentStep(3); // Move to day selection
  };

  const handleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleBack = () => {
    if (currentStep === 3) {
      setCurrentStep(2); // Go back to servings
      setSelectedDays([]);
    } else if (currentStep === 2) {
      setCurrentStep(1); // Go back to recipe selection
      setSelectedRecipe(null);
      setSelectedServings(1);
    }
  };

  const resetModalState = () => {
    setSelectedRecipe(null);
    setSelectedServings(1);
    setSelectedDays([]);
    setCurrentStep(1);
  };

  const handleSubmit = () => {
    if (selectedRecipe && selectedDays.length > 0 && selectedServings > 0) {
      // Pass recipe with servings information
      const recipeWithServings = {
        ...selectedRecipe,
        selectedServings: selectedServings
      };
      onRecipeSelect(recipeWithServings, selectedDays, resetModalState);
      onClose();
    }
  };

  const incrementServings = () => {
    setSelectedServings(prev => prev + 1);
  };

  const decrementServings = () => {
    setSelectedServings(prev => Math.max(1, prev - 1));
  };

  const handleServingsInputChange = (e) => {
    const value = parseInt(e.target.value) || 1;
    setSelectedServings(Math.max(1, value));
  };

  // Fixed calculation function
  const getServingMultiplier = () => {
    const recipeServings = selectedRecipe?.servings || 1;
    return selectedServings / recipeServings;
  };

  const getServingNote = () => {
    const recipeServings = selectedRecipe?.servings || 1;
    const multiplier = getServingMultiplier();
    
    if (selectedServings === recipeServings) {
      return 'This will use the original recipe amounts per day';
    } else if (multiplier > 1) {
      return `This will multiply ingredients by ${multiplier.toFixed(2)}x per day`;
    } else {
      return `This will reduce ingredients to ${multiplier.toFixed(2)}x per day`;
    }
  };

  const getTotalServingsNote = () => {
    if (selectedDays.length === 0) return '';
    if (selectedDays.length === 1) return `Total: ${selectedServings} servings for 1 day`;
    return `Total: ${selectedServings * selectedDays.length} servings across ${selectedDays.length} days`;
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button-icon" onClick={onClose}>×</button>
        <h2 className="modal-title">
          {isEditMode ? `Edit ${mealType} for ${editingDay}` : `Select ${mealType} Recipe`}
        </h2>

        {currentStep === 1 && (
          // Step 1: Recipe Selection
          <div className="step-container">
            <h3 className="step-title">Step 1: Choose Recipe</h3>
            {filteredRecipes.length > 0 ? (
              <div className="recipes-grid">
                {filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    className="recipe-card"
                    onClick={() => handleRecipeClick(recipe)}
                  >
                    <span className="recipe-title">{recipe.title}</span>
                    {recipe.dietType && (
                      <span className="recipe-diet-type">{recipe.dietType}</span>
                    )}
                    <div className="recipe-servings-info">
                      Recipe serves {recipe.servings || 1}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-recipes">No {mealType} recipes available</p>
            )}
          </div>
        )}

        {currentStep === 2 && selectedRecipe && (
          // Step 2: Servings Selection
          <div className="step-container">
            <div className="selected-recipe-header">
              <button className="back-button" onClick={handleBack}>
                ← Back to recipes
              </button>
              <div className="selected-recipe-info">
                <h3 className="step-title">Step 2: Select Servings Per Day</h3>
                <p className="selected-recipe">Recipe: <strong>{selectedRecipe.title}</strong></p>
                <p className="recipe-default-servings">Default recipe serves: {selectedRecipe.servings || 1}</p>
              </div>
            </div>

            <div className="servings-selector">
              <label className="servings-label">How many servings per day?</label>
              <div className="servings-input-group">
                <button 
                  className="servings-button minus" 
                  onClick={decrementServings}
                  disabled={selectedServings <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  className="servings-input"
                  value={selectedServings}
                  onChange={handleServingsInputChange}
                  min="1"
                  max="20"
                />
                <button 
                  className="servings-button plus" 
                  onClick={incrementServings}
                >
                  +
                </button>
              </div>
              <p className="servings-note">
                {getServingNote()}
              </p>
              <p className="servings-explanation">
                You'll choose which days next. This serving amount will apply to each day you select.
              </p>
            </div>

            <button
              className="submit-button"
              onClick={handleServingsConfirm}
            >
              Continue to Days
            </button>
          </div>
        )}

        {currentStep === 3 && selectedRecipe && (
          // Step 3: Day Selection
          <div className="step-container">
            <div className="selected-recipe-header">
              <button className="back-button" onClick={handleBack}>
                ← Back to servings
              </button>
              <div className="selected-recipe-info">
                <h3 className="step-title">Step 3: Select Days</h3>
                <p className="selected-recipe">
                  Adding: <strong>{selectedRecipe.title}</strong> ({selectedServings} servings per day)
                </p>
              </div>
            </div>
            
            <div className="days-grid">
              {daysOfWeek.map((day) => {
                const isCurrentEditDay = isEditMode && day === editingDay;
                const isOtherDay = isEditMode && day !== editingDay;
                
                return (
                  <button
                    key={day}
                    className={`day-button ${selectedDays.includes(day) ? 'selected' : ''} ${isOtherDay ? 'disabled' : ''}`}
                    onClick={() => !isOtherDay && handleDaySelection(day)}
                    disabled={isOtherDay}
                  >
                    {day}
                    {isCurrentEditDay && <span className="edit-indicator"> (editing)</span>}
                  </button>
                );
              })}
            </div>

            {selectedDays.length > 0 && (
              <div className="total-servings-summary">
                <p className="total-note">{getTotalServingsNote()}</p>
              </div>
            )}
            
            <button
              className="submit-button"
              onClick={handleSubmit}
              disabled={selectedDays.length === 0}
            >
              Add to Meal Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeSelectionModal;
