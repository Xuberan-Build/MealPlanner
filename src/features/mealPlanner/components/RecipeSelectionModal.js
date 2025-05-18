import React, { useState, useEffect } from 'react';
import './RecipeSelectionModal.css';

const RecipeSelectionModal = ({
  isOpen,
  onClose,
  onRecipeSelect,
  mealType,
  availableRecipes
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [selectedDays, setSelectedDays] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  useEffect(() => {
    if (availableRecipes && mealType) {
      const filtered = availableRecipes.filter(recipe =>
        recipe.mealType?.toLowerCase() === mealType?.toLowerCase()
      );
      setFilteredRecipes(filtered);
    }
  }, [mealType, availableRecipes]);

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setSelectedDays([]);
  };

  const handleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleBack = () => {
    setSelectedRecipe(null);
    setSelectedDays([]);
  };

  const resetModalState = () => {
  setSelectedRecipe(null);
  setSelectedDays([]);
  };

  const handleSubmit = () => {
    if (selectedRecipe && selectedDays.length > 0) {
      onRecipeSelect(selectedRecipe, selectedDays,resetModalState);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button className="close-button-icon" onClick={onClose}>×</button>
        <h2 className="modal-title">Select {mealType} Recipe</h2>

        {!selectedRecipe ? (
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
                  </button>
                ))}
              </div>
            ) : (
              <p className="no-recipes">No {mealType} recipes available</p>
            )}
          </div>
        ) : (
          // Step 2: Day Selection
          <div className="step-container">
            <div className="selected-recipe-header">
              <button className="back-button" onClick={handleBack}>
                ← Back to recipes
              </button>
              <div className="selected-recipe-info">
                <h3 className="step-title">Step 2: Select Days</h3>
                <p className="selected-recipe">Adding: <strong>{selectedRecipe.title}</strong></p>
              </div>
            </div>

            <div className="days-grid">
              {daysOfWeek.map((day) => (
                <button
                  key={day}
                  className={`day-button ${selectedDays.includes(day) ? 'selected' : ''}`}
                  onClick={() => handleDaySelection(day)}
                >
                  {day}
                </button>
              ))}
            </div>

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
