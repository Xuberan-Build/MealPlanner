// src/features/recipeBook/RecipeBook.js

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { getRecipes, updateRecipe, deleteRecipe } from '../../services/recipeService';
import RecipeForm from './recipeForm/RecipeForm';
import RecipeDetails from '../recipeBook/recipedetails/RecipeDetails';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import ConfirmDialog from './components/ConfirmDialog';
import AddToMealPlanModal from './components/AddToMealPlanModal';
import dietTypeService from '../../services/dietTypeService';
import { auth } from '../../firebase';
import './RecipeBook.css';

/**
 * Utility function to sanitize dietType strings for use in IDs and selectors.
 * Replaces spaces and special characters with hyphens.
 *
 * @param {string} dietType - The diet type string to sanitize.
 * @returns {string} - The sanitized string.
 */
const sanitizeDietType = (dietType) => {
  return dietType.replace(/[^a-zA-Z0-9]/g, '-'); // Replace non-alphanumeric characters with hyphens
};

const RecipeBook = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // State to hold recipes grouped by diet type
  const [recipesByDiet, setRecipesByDiet] = useState({});

  // State for all recipes (ungrouped) - useful for filtering
  const [allRecipes, setAllRecipes] = useState([]);

  // State to control the visibility of the RecipeForm modal
  const [isFormOpen, setIsFormOpen] = useState(false);

  // State to hold the currently selected recipe for detailed view
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // State to control the visibility of the RecipeDetails modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // State for search functionality
  const [searchTerm, setSearchTerm] = useState('');

  // State for filter functionality
  const [filters, setFilters] = useState({
    dietTypes: [],
    mealTypes: []
  });

  // State for available diet types and meal types
  const [availableDietTypes, setAvailableDietTypes] = useState([]);
  const [availableMealTypes, setAvailableMealTypes] = useState([]);

  // State for the delete confirmation dialog
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    recipeId: null,
    recipeName: ''
  });

  // State for controlling filter panel visibility
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // State for Add to Meal Plan modal
  const [isAddToMealPlanModalOpen, setIsAddToMealPlanModalOpen] = useState(false);
  const [recipeToAdd, setRecipeToAdd] = useState(null);

  // Check for URL parameter to open form automatically
  useEffect(() => {
    if (searchParams.get('openForm') === 'true') {
      setIsFormOpen(true);
      // Remove the parameter from URL after opening
      searchParams.delete('openForm');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  /**
   * Fetches recipes from Firestore and processes them.
   */
  const fetchRecipes = async () => {
    try {
      console.log("Fetching recipes from Firestore");
      const recipeList = await getRecipes(); // Fetch recipes using service function
      console.log("Recipes fetched:", recipeList);

      // Save all recipes for filtering
      setAllRecipes(recipeList);

      // Load diet types from dietTypeService (includes custom types)
      const currentUser = auth.currentUser;
      const dietTypes = await dietTypeService.getDietTypes(currentUser?.uid);

      // Extract unique meal types from recipes
      const mealTypes = [...new Set(recipeList.map(recipe => recipe.mealType || 'Other'))];

      setAvailableDietTypes(dietTypes);
      setAvailableMealTypes(mealTypes);
      
      // Group recipes by their dietType; default to 'Other' if not specified
      const grouped = recipeList.reduce((acc, recipe) => {
        const dietType = recipe.dietType || 'Other';
        if (!acc[dietType]) {
          acc[dietType] = [];
        }
        acc[dietType].push(recipe);
        return acc;
      }, {});
      
      console.log("Recipes grouped by diet type:", grouped);
      setRecipesByDiet(grouped); // Update state with grouped recipes
    } catch (error) {
      console.error('Failed to fetch recipes:', error);
      // Optionally, implement user-facing error notifications here
    }
  };
  
  useEffect(() => {
    console.log("Component mounted, fetching recipes");
    fetchRecipes(); // Initiate fetch on component mount
  }, []);

  /**
   * Filters recipes based on search term and selected filters.
   */
  useEffect(() => {
    if (allRecipes.length > 0) {
      // Filter recipes based on search term and selected filters
      const filteredRecipes = allRecipes.filter(recipe => {
        // Search term filter
        const matchesSearch = !searchTerm.trim() || 
          recipe.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          recipe.mealType?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          recipe.dietType?.toLowerCase().includes(searchTerm.toLowerCase());

        // Diet type filter
        const matchesDietType = filters.dietTypes.length === 0 || 
          filters.dietTypes.includes(recipe.dietType || 'Other');

        // Meal type filter
        const matchesMealType = filters.mealTypes.length === 0 || 
          filters.mealTypes.includes(recipe.mealType || 'Other');

        return matchesSearch && matchesDietType && matchesMealType;
      });

      // Group filtered recipes by diet type
      const grouped = filteredRecipes.reduce((acc, recipe) => {
        const dietType = recipe.dietType || 'Other';
        if (!acc[dietType]) {
          acc[dietType] = [];
        }
        acc[dietType].push(recipe);
        return acc;
      }, {});

      setRecipesByDiet(grouped);
    }
  }, [searchTerm, filters, allRecipes]);

  /**
   * Opens the RecipeForm modal to add a new recipe.
   */
  const handleAddNewRecipe = () => {
    setIsFormOpen(true);
  };

  /**
   * Handles the successful saving of a new recipe.
   * Closes the RecipeForm modal and refreshes the recipes list.
   */
  const handleSaveRecipe = () => {
    console.log("Recipe saved, refreshing recipe list");
    setIsFormOpen(false);
    fetchRecipes(); // Re-fetch recipes to include the newly added recipe
  };

  /**
   * Cancels the addition of a new recipe and closes the RecipeForm modal.
   */
  const handleCancelRecipeForm = () => {
    setIsFormOpen(false);
  };

  /**
   * Handles the click event on a recipe card.
   * Opens the RecipeDetails modal for the selected recipe.
   *
   * @param {Object} recipe - The recipe object that was clicked.
   */
  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  /**
   * Closes the RecipeDetails modal and clears the selected recipe.
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedRecipe(null);
  };

  /**
   * Updates a recipe both in Firestore and the local state.
   *
   * @param {Object} updatedRecipe - The updated recipe object.
   */
  const handleUpdateRecipe = async (updatedRecipe) => {
    try {
      // Update the recipe in Firestore using the service function
      await updateRecipe(updatedRecipe.id, {
        ...updatedRecipe,
        // Note: 'updatedAt' is handled within the service function
      });

      // Update the allRecipes array
      setAllRecipes(prev => prev.map(recipe => 
        recipe.id === updatedRecipe.id ? updatedRecipe : recipe
      ));

      // Update the local state to reflect changes
      setRecipesByDiet((prev) => {
        const newRecipesByDiet = { ...prev };

        // Remove the old recipe from its previous diet category
        Object.keys(newRecipesByDiet).forEach((diet) => {
          newRecipesByDiet[diet] = newRecipesByDiet[diet].filter(
            (r) => r.id !== updatedRecipe.id
          );
        });

        // Determine the new diet type (default to 'Other' if not specified)
        const dietType = updatedRecipe.dietType || 'Other';

        // Initialize the array for the new diet type if it doesn't exist
        if (!newRecipesByDiet[dietType]) {
          newRecipesByDiet[dietType] = [];
        }

        // Add the updated recipe to the appropriate diet category
        newRecipesByDiet[dietType].push(updatedRecipe);

        return newRecipesByDiet;
      });

      // If the updated recipe is currently selected, update it as well
      if (selectedRecipe && selectedRecipe.id === updatedRecipe.id) {
        setSelectedRecipe(updatedRecipe);
      }

      console.log('Recipe updated successfully:', updatedRecipe);
    } catch (error) {
      console.error('Failed to update recipe:', error);
      // Optionally, implement user-facing error notifications here
    }
  };

  /**
   * Opens the delete confirmation dialog for a recipe.
   * 
   * @param {Event} e - The event object.
   * @param {Object} recipe - The recipe to delete.
   */
  const handleDeleteClick = (e, recipe) => {
    e.stopPropagation(); // Prevent recipe card click
    setDeleteDialog({
      isOpen: true,
      recipeId: recipe.id,
      recipeName: recipe.title
    });
  };

  /**
   * Handles the delete confirmation.
   * Deletes the recipe from Firestore and updates the UI.
   */
  const handleDeleteConfirm = async () => {
    try {
      await deleteRecipe(deleteDialog.recipeId);
      
      // Update allRecipes state
      setAllRecipes(prev => prev.filter(recipe => recipe.id !== deleteDialog.recipeId));
      
      // Close the dialog
      setDeleteDialog({
        isOpen: false,
        recipeId: null,
        recipeName: ''
      });
      
      // Refresh recipes to update the UI
      fetchRecipes();
    } catch (error) {
      console.error('Failed to delete recipe:', error);
      // Optionally, implement user-facing error notifications here
    }
  };

  /**
   * Closes the delete confirmation dialog.
   */
  const handleDeleteCancel = () => {
    setDeleteDialog({
      isOpen: false,
      recipeId: null,
      recipeName: ''
    });
  };

  /**
   * Handles opening the Add to Meal Plan modal.
   *
   * @param {Event} e - The event object.
   * @param {Object} recipe - The recipe to add to meal plan.
   */
  const handleAddToMealPlanClick = (e, recipe) => {
    e.stopPropagation(); // Prevent recipe card click
    setRecipeToAdd(recipe);
    setIsAddToMealPlanModalOpen(true);
  };

  /**
   * Closes the Add to Meal Plan modal.
   */
  const handleCloseAddToMealPlan = () => {
    setIsAddToMealPlanModalOpen(false);
    setRecipeToAdd(null);
  };

  /**
   * Handles the scroll event for recipe rows.
   *
   * @param {string} dietType - The diet type of the recipe row.
   * @param {string} direction - The direction to scroll ('left' or 'right').
   */
  const handleScroll = (dietType, direction) => {
    const sanitizedDietType = sanitizeDietType(dietType); // Sanitize dietType for selector
    const container = document.querySelector(`#recipe-row-${sanitizedDietType}`);
    const scrollAmount = 300; // Adjust scroll amount as needed

    if (container) {
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    } else {
      console.error(`No container found with ID: recipe-row-${sanitizedDietType}`);
    }
  };

  return (
    <div className="recipe-book-container">
      {/* Header Component */}
      <Header />

      {/* Main Header Section */}
      <header className="recipe-header">
        <h1>Recipe Book</h1>
        <button className="add-recipe-button" onClick={handleAddNewRecipe}>
          Add New Recipe
        </button>
      </header>

      {/* Search and Filter Section */}
      <div className="search-filter-container">
        <SearchBar 
          searchTerm={searchTerm} 
          onSearchChange={setSearchTerm} 
        />
        
        <button 
          className="toggle-filter-button"
          onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
        >
          {isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
        </button>

        {isFilterPanelOpen && (
          <FilterPanel 
            filters={filters}
            onFilterChange={setFilters}
            dietTypes={availableDietTypes}
            mealTypes={availableMealTypes}
          />
        )}
      </div>

      {/* Recipe List Section */}
      {Object.keys(recipesByDiet).length > 0 ? (
        Object.entries(recipesByDiet)
          .sort(([a], [b]) => a.localeCompare(b)) // Sort diet types alphabetically
          .map(([dietType, dietRecipes]) => {
            const sanitizedDietType = sanitizeDietType(dietType); // Sanitize for ID

            return (
              <section key={dietType} className="diet-type-section">
                <h2 className="diet-type-header">{dietType}</h2>
                <div className="recipes-row-container">
                  {/* Scroll Left Button */}
                  <button
                    className="scroll-indicator left"
                    onClick={() => handleScroll(dietType, 'left')}
                    aria-label="Scroll left"
                  >
                    ←
                  </button>

                  {/* Recipes Row */}
                  <div id={`recipe-row-${sanitizedDietType}`} className="recipes-row">
                    {dietRecipes.map((recipe) => (
                      <div
                        key={recipe.id}
                        className="recipe-card"
                        onClick={() => handleRecipeClick(recipe)}
                      >
                        <div className="recipe-card-header">
                          <h3>{recipe.title}</h3>
                          <div className="recipe-card-actions">
                            <button
                              className="add-to-plan-button"
                              onClick={(e) => handleAddToMealPlanClick(e, recipe)}
                              aria-label={`Add ${recipe.title} to meal plan`}
                              title="Add to Meal Plan"
                            >
                              +
                            </button>
                            <button
                              className="delete-recipe-button"
                              onClick={(e) => handleDeleteClick(e, recipe)}
                              aria-label={`Delete ${recipe.title}`}
                              title="Delete Recipe"
                            >
                              −
                            </button>
                          </div>
                        </div>
                        <p>Meal Type: {recipe.mealType}</p>
                        <p>Preparation Time: {recipe.prepTime || 'Not Specified'}</p>
                      </div>
                    ))}
                  </div>

                  {/* Scroll Right Button */}
                  <button
                    className="scroll-indicator right"
                    onClick={() => handleScroll(dietType, 'right')}
                    aria-label="Scroll right"
                  >
                    →
                  </button>
                </div>
              </section>
            );
          })
      ) : (
        // Empty State
        <div className="empty-section">
          {searchTerm || filters.dietTypes.length > 0 || filters.mealTypes.length > 0 ? (
            <p>No recipes match your search or filters. Try adjusting your criteria.</p>
          ) : (
            <p>No recipes available. Add a new one!</p>
          )}
        </div>
      )}

      {/* RecipeForm Modal */}
      {isFormOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <RecipeForm onSave={handleSaveRecipe} onCancel={handleCancelRecipeForm} />
          </div>
        </div>
      )}

      {/* RecipeDetails Modal */}
      {selectedRecipe && (
        <RecipeDetails
          recipe={selectedRecipe}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onUpdateRecipe={handleUpdateRecipe}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        title="Delete Recipe"
        message={`Are you sure you want to delete "${deleteDialog.recipeName}"? This action cannot be undone.`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      {/* Add to Meal Plan Modal */}
      <AddToMealPlanModal
        isOpen={isAddToMealPlanModalOpen}
        onClose={handleCloseAddToMealPlan}
        recipe={recipeToAdd}
      />

      {/* Bottom Navigation Component */}
      <BottomNav />
    </div>
  );
};

export default RecipeBook;
