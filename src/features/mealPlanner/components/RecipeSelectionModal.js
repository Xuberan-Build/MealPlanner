import React, { useState, useEffect } from 'react';
import { DAYS_OF_WEEK } from '../../../constants/mealPlanner';
import dietTypeService from '../../../services/dietTypeService';
import { auth } from '../../../firebase';
import { searchRecipes } from '../../../utils/search';
import { parseServings } from '../../../utils/quantity';
import { findConflicts, getSlot } from '../mealPlanModel';
import { dietTypeNames } from '../../../utils/dietTypeNames';
import PlateBuilder from '../plateBuilder/PlateBuilder';
import { isPlateRecipe } from '../plateBuilder/plateModel';
import './RecipeSelectionModal.css';

/** "Recipe serves 4", or a clear note when the recipe has no usable yield. */
const describeRecipeYield = (recipe) => {
  const servings = parseServings(recipe?.servings);
  return servings === null ? 'Recipe servings not set' : `Recipe serves ${servings}`;
};

const RecipeSelectionModal = ({
  isOpen,
  onClose,
  onRecipeSelect,
  onRemoveMeal,
  onSaveFavoritePlate,
  mealPlan = {},
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
  // 'recipe' = pick a saved recipe; 'plate' = build one from components.
  const [mode, setMode] = useState('recipe');
  // What the plate builder starts from (a planned plate being edited, or the plate the
  // user just built when they come back from choosing days).
  const [plateSeed, setPlateSeed] = useState(null);

  const daysOfWeek = DAYS_OF_WEEK;
  const isEditMode = selectedMealSlot?.isEditing || false;
  const slotDay = selectedMealSlot?.day;
  const editingDay = slotDay;

  // Load diet types when modal opens
  useEffect(() => {
    if (isOpen) {
      const loadDietTypes = async () => {
        try {
          const currentUser = auth.currentUser;
          const dietTypes = await dietTypeService.getDietTypes(currentUser?.uid);
          setAvailableDietTypes(dietTypeNames(dietTypes));
        } catch (error) {
          console.error('Error loading diet types:', error);
        }
      };
      loadDietTypes();
    }
  }, [isOpen]);

    useEffect(() => {
  if (availableRecipes && mealType) {
    // First filter by meal type
    // Saved plates live in the "Build a plate" tab, not in the recipe grid.
    let filtered = availableRecipes.filter(recipe =>
      !isPlateRecipe(recipe) && recipe.mealType?.toLowerCase() === mealType?.toLowerCase()
    );

    // Apply search with relevance ranking using new search utilities
    if (searchTerm.trim()) {
      filtered = searchRecipes(filtered, searchTerm, {
        context: 'MEAL_PLANNER'  // Uses ingredient-focused search
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

    // Results are already sorted by relevance from searchRecipes()
    // If no search term, sort alphabetically
    if (!searchTerm.trim()) {
      filtered.sort((a, b) => a.title?.localeCompare(b.title) || 0);
    }

    setFilteredRecipes(filtered);
  }
}, [mealType, availableRecipes, searchTerm, selectedDietFilter, selectedPrepTimeFilter]);

  useEffect(() => {
  if (isOpen && isEditMode && selectedMealSlot?.existingMeal) {
    const existingMeal = selectedMealSlot.existingMeal;

    let recipe, servings;
    if (existingMeal.recipe && typeof existingMeal.servings !== 'undefined') {
      recipe = existingMeal.recipe;
      // Same parsing as the shopping-list builder ("4-6" -> 4, "4 servings" -> 4)
      servings = parseServings(existingMeal.servings) || parseServings(existingMeal.recipe.servings) || 1;
    } else if (existingMeal.title) {
      recipe = existingMeal;
      // Same parsing as the shopping-list builder
      servings = parseServings(existingMeal.selectedServings) || parseServings(existingMeal.servings) || 1;
    }

    if (recipe && isPlateRecipe(recipe)) {
      resetModalState();
      setMode('plate');
      setPlateSeed({ recipe, people: servings });
    } else if (recipe) {
      setSelectedRecipe(recipe);
      setSelectedServings(servings);
      setSelectedDays([editingDay]);
      setCurrentStep(2);
    }
  } else if (isOpen) {
    resetModalState();
  }
}, [isOpen, isEditMode, selectedMealSlot, editingDay]);

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    // Same parsing as the shopping-list builder ("4-6" -> 4, "4 servings" -> 4)
    setSelectedServings(parseServings(recipe.servings) || 1);
    setCurrentStep(2); // Move to servings selection
  };

  // The slot the user clicked is the obvious default; they can add more days.
  const handleServingsConfirm = () => {
    setSelectedDays(slotDay ? [slotDay] : []);
    setCurrentStep(3);
  };

  const handleDaySelection = (day) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const handleBack = () => {
    if (currentStep === 3 && isPlateRecipe(selectedRecipe)) {
      // Back to the builder with the plate as it was.
      setPlateSeed({ recipe: selectedRecipe, people: selectedServings });
      setSelectedRecipe(null);
      setSelectedDays([]);
      setCurrentStep(1);
    } else if (currentStep === 3) {
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
    setMode('recipe');
    setPlateSeed(null);
  };

  const plateFavorites = (availableRecipes || []).filter(isPlateRecipe);

  // A finished plate: people = servings (its portions are per person).
  const handlePlateContinue = ({ recipe, people, saveAsFavorite }) => {
    if (saveAsFavorite && typeof onSaveFavoritePlate === 'function') onSaveFavoritePlate(recipe);
    if (isEditMode) {
      onRecipeSelect({ ...recipe, selectedServings: people }, [editingDay], resetModalState);
      onClose();
      return;
    }
    setSelectedRecipe(recipe);
    setSelectedServings(people);
    setSelectedDays(slotDay ? [slotDay] : []);
    setCurrentStep(3);
  };

  const submitForDays = (days) => {
    if (!selectedRecipe || days.length === 0 || selectedServings <= 0) return;
    onRecipeSelect({ ...selectedRecipe, selectedServings }, days, resetModalState);
    onClose();
  };

  const handleSubmit = () => submitForDays(selectedDays);

  // Editing one slot: save straight from the servings step - no day re-selection.
  const handleSaveEdit = () => submitForDays([editingDay]);

  const handleRemove = () => {
    if (typeof onRemoveMeal === 'function') onRemoveMeal(editingDay, mealType);
    resetModalState();
    onClose();
  };

  const conflicts = selectedRecipe
    ? findConflicts(mealPlan, selectedDays, mealType, selectedRecipe)
    : [];

  const incrementServings = () => {
    setSelectedServings(prev => {
      // Ensure prev is a number to prevent string concatenation
      const current = parseServings(prev) || 1;
      return current + 1;
    });
  };

  const decrementServings = () => {
    setSelectedServings(prev => {
      // Ensure prev is a number
      const current = parseServings(prev) || 1;
      return Math.max(1, current - 1);
    });
  };

  const handleServingsInputChange = (e) => {
    const value = parseServings(e.target.value) || 1;
    setSelectedServings(Math.max(1, value));
  };

  // Fixed calculation function
  const getServingMultiplier = () => {
    const recipeServings = parseServings(selectedRecipe?.servings) || 1;
    return selectedServings / recipeServings;
  };

  const getServingNote = () => {
    const baseServings = parseServings(selectedRecipe?.servings);
    if (baseServings === null) {
      // Matches buildShoppingList: unknown recipe yield => one full batch per day, flagged.
      return "This recipe's servings aren't set, so the shopping list will use the full recipe amounts per day";
    }
    const recipeServings = baseServings;
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
          {isEditMode ? `Edit ${mealType} for ${editingDay}` : `Add ${mealType}`}
        </h2>

        {currentStep === 1 && (
          <div className="mode-tabs" role="tablist" aria-label="How do you want to add this meal?">
            {[['recipe', 'Recipe'], ['plate', 'Build a plate']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                className={`mode-tab ${mode === value ? 'active' : ''}`}
                onClick={() => setMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {currentStep === 1 && mode === 'plate' && (
          <div className="step-container" role="tabpanel">
            <PlateBuilder
              key={plateSeed?.recipe?.title || 'new-plate'}
              mealType={mealType}
              initialRecipe={plateSeed?.recipe || null}
              initialPeople={plateSeed?.people || 1}
              favorites={plateFavorites}
              submitLabel={isEditMode ? 'Save Changes' : 'Choose days'}
              onContinue={handlePlateContinue}
            />
            {isEditMode && (
              <button className="remove-meal-button plate-remove" onClick={handleRemove}>
                Remove from {editingDay}
              </button>
            )}
          </div>
        )}

        {currentStep === 1 && mode === 'recipe' && (
          // Step 1: Recipe Selection
          <div className="step-container" role="tabpanel">
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
                      {describeRecipeYield(recipe)}
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
                <p className="recipe-default-servings">{describeRecipeYield(selectedRecipe)}</p>
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
              {!isEditMode && (
                <p className="servings-explanation">
                  You'll choose which days next. This serving amount will apply to each day you select.
                </p>
              )}
            </div>

            {isEditMode ? (
              <div className="edit-actions">
                <button className="submit-button" onClick={handleSaveEdit}>
                  Save Changes
                </button>
                <button className="remove-meal-button" onClick={handleRemove}>
                  Remove from {editingDay}
                </button>
              </div>
            ) : (
              <button className="submit-button" onClick={handleServingsConfirm}>
                Continue to Days
              </button>
            )}
          </div>
        )}

        {currentStep === 3 && selectedRecipe && (
          // Step 3: Day Selection
          <div className="step-container">
            <div className="selected-recipe-header">
              <button className="back-button" onClick={handleBack}>
                {isPlateRecipe(selectedRecipe) ? '← Back to plate' : '← Back to servings'}
              </button>
              <div className="selected-recipe-info">
                <h3 className="step-title">Step 3: Select Days</h3>
                <p className="selected-recipe">
                  Adding: <strong>{selectedRecipe.title}</strong>{' '}
                  {isPlateRecipe(selectedRecipe)
                    ? `(for ${selectedServings} ${selectedServings === 1 ? 'person' : 'people'} per day)`
                    : `(${selectedServings} servings per day)`}
                </p>
              </div>
            </div>
            
            <div className="days-grid">
              {daysOfWeek.map((day) => {
                const existing = getSlot(mealPlan, day, mealType);
                const isSelected = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    className={`day-button ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleDaySelection(day)}
                    aria-pressed={isSelected}
                  >
                    {day}
                    {existing && (
                      <span className="day-existing-meal">{existing.recipe.title}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {conflicts.length > 0 && (
              <p className="replace-warning" role="alert">
                This will replace{' '}
                {conflicts.map(({ day, title }) => `${title} on ${day}`).join(', ')}.
              </p>
            )}

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
              {conflicts.length > 0 ? 'Replace & Add' : 'Add to Meal Plan'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeSelectionModal;
