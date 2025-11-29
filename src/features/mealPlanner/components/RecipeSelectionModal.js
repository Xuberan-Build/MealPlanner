import React, { useState, useEffect } from 'react';
import dietTypeService from '../../../services/dietTypeService';
import { auth } from '../../../firebase';
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
  const [currentStep, setCurrentStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDietFilter, setSelectedDietFilter] = useState('all');
  const [selectedPrepTimeFilter, setSelectedPrepTimeFilter] = useState('all');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [availableDietTypes, setAvailableDietTypes] = useState([]);
  
  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const isEditMode = selectedMealSlot?.isEditing || false;
    const editingDay = selectedMealSlot?.day;

  // Load diet types when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadDietTypes = async () => {
        try {
          const currentUser = auth.currentUser;
          const dietTypes = await dietTypeService.getDietTypes(currentUser?.uid);
          setAvailableDietTypes(dietTypes);
        } catch (error) {
          console.error('Error loading diet types:', error);
        }
      };
      loadDietTypes();
    }
  }, [isOpen]);

    useEffect(() => {
  if (availableRecipes && mealType) {
    let filtered = availableRecipes.filter(recipe =>
      recipe.mealType?.toLowerCase() === mealType?.toLowerCase()
    );

    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(recipe => {
        const titleMatch = recipe.title?.toLowerCase().includes(searchLower);
        const ingredientMatch = recipe.ingredients?.some(ingredient => {
          if (typeof ingredient === 'string') {
            return ingredient.toLowerCase().includes(searchLower);
          }
          return ingredient.ingredientId?.toLowerCase().includes(searchLower);
        });
        return titleMatch || ingredientMatch;
      });
    }

    // Apply diet type filter
    if (selectedDietFilter !== 'all') {
      filtered = filtered.filter(recipe =>
        recipe.dietType?.toLowerCase() === selectedDietFilter.toLowerCase()
      );
    }

    // Apply prep time filter
    if (selectedPrepTimeFilter !== 'all') {
      filtered = filtered.filter(recipe => {
        const prepTime = recipe.prepTime || '';
        switch (selectedPrepTimeFilter) {
          case 'quick': // Under 30 minutes
            return prepTime.includes('15') || prepTime.includes('20') || prepTime.includes('25');
          case 'medium': // 30-60 minutes
            return prepTime.includes('30') || prepTime.includes('45') || prepTime.includes('60');
          case 'long': // Over 60 minutes
            return prepTime.includes('90') || prepTime.includes('120') || prepTime.includes('2 hour');
          default:
            return true;
        }
      });
    }

    // Sort by relevance: exact title matches first, then alphabetical
    filtered.sort((a, b) => {
      if (searchTerm.trim()) {
        const aExactMatch = a.title?.toLowerCase().startsWith(searchTerm.toLowerCase());
        const bExactMatch = b.title?.toLowerCase().startsWith(searchTerm.toLowerCase());
        if (aExactMatch && !bExactMatch) return -1;
        if (!aExactMatch && bExactMatch) return 1;
      }
      return a.title?.localeCompare(b.title) || 0;
    });

    setFilteredRecipes(filtered);
  }
}, [mealType, availableRecipes, searchTerm, selectedDietFilter, selectedPrepTimeFilter]);

  useEffect(() => {
  if (isOpen && isEditMode && selectedMealSlot?.existingMeal) {
    const existingMeal = selectedMealSlot.existingMeal;

    let recipe, servings;
    if (existingMeal.recipe && typeof existingMeal.servings !== 'undefined') {
      recipe = existingMeal.recipe;
      // Parse to number to prevent string concatenation bug
      servings = parseInt(existingMeal.servings) || 1;
    } else if (existingMeal.title) {
      recipe = existingMeal;
      // Parse to number to prevent string concatenation bug
      servings = parseInt(existingMeal.selectedServings || existingMeal.servings) || 1;
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
    // Parse to number to prevent string concatenation bug
    setSelectedServings(parseInt(recipe.servings) || 1);
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
    setSelectedServings(prev => {
      // Ensure prev is a number to prevent string concatenation
      const current = typeof prev === 'number' ? prev : parseInt(prev) || 1;
      return current + 1;
    });
  };

  const decrementServings = () => {
    setSelectedServings(prev => {
      // Ensure prev is a number
      const current = typeof prev === 'number' ? prev : parseInt(prev) || 1;
      return Math.max(1, current - 1);
    });
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
            {/* Search and Filter Interface */}
            <div className="search-filter-container">
              {/* Search Bar */}
              <div className="search-bar">
                <input
                  type="text"
                  placeholder="Search recipes or ingredients..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className="filter-toggle-btn"
                >
                  {showAdvancedFilters ? 'Hide Filters' : 'Show Filters'}
                </button>
              </div>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="advanced-filters">
                  <div className="filter-row">
                    <div className="filter-group">
                      <label htmlFor="diet-filter">Diet Type:</label>
                      <select
                        id="diet-filter"
                        value={selectedDietFilter}
                        onChange={(e) => setSelectedDietFilter(e.target.value)}
                        className="filter-select"
                      >
                        <option value="all">All Diets</option>
                        {availableDietTypes.map((dietType) => (
                          <option key={dietType} value={dietType.toLowerCase()}>
                            {dietType}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="filter-group">
                      <label htmlFor="prep-time-filter">Prep Time:</label>
                      <select
                        id="prep-time-filter"
                        value={selectedPrepTimeFilter}
                        onChange={(e) => setSelectedPrepTimeFilter(e.target.value)}
                        className="filter-select"
                      >
                        <option value="all">Any Time</option>
                        <option value="quick">Quick (Under 30 min)</option>
                        <option value="medium">Medium (30-60 min)</option>
                        <option value="long">Long (60+ min)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Results Count */}
              <div className="results-info">
                {searchTerm && (
                  <span className="search-results">
                    Found {filteredRecipes.length} recipe{filteredRecipes.length !== 1 ? 's' : ''} 
                    {searchTerm && ` for "${searchTerm}"`}
                  </span>
                )}
                {(selectedDietFilter !== 'all' || selectedPrepTimeFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSelectedDietFilter('all');
                      setSelectedPrepTimeFilter('all');
                      setSearchTerm('');
                    }}
                    className="clear-filters-btn"
                  >
                    Clear All Filters
                  </button>
                )}
              </div>
            </div>
            
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
