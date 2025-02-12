// src/features/recipeBook/RecipeBook.js

import React, { useEffect, useState } from 'react';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { getRecipes, updateRecipe } from '../../services/recipeService'; // Importing service functions
import RecipeForm from './recipeForm/RecipeForm';
import RecipeDetails from '../recipeBook/recipedetails/RecipeDetails';
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
  // State to hold recipes grouped by diet type
  const [recipesByDiet, setRecipesByDiet] = useState({});

  // State to control the visibility of the RecipeForm modal
  const [isFormOpen, setIsFormOpen] = useState(false);

  // State to hold the currently selected recipe for detailed view
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // State to control the visibility of the RecipeDetails modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  /**
   * Fetches recipes from Firestore and groups them by diet type.
   */
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const recipeList = await getRecipes(); // Fetch recipes using service function

        // Group recipes by their dietType; default to 'Other' if not specified
        const grouped = recipeList.reduce((acc, recipe) => {
          const dietType = recipe.dietType || 'Other';
          if (!acc[dietType]) {
            acc[dietType] = [];
          }
          acc[dietType].push(recipe);
          return acc;
        }, {});

        setRecipesByDiet(grouped); // Update state with grouped recipes
      } catch (error) {
        console.error('Failed to fetch recipes:', error);
        // Optionally, implement user-facing error notifications here
      }
    };

    fetchRecipes(); // Initiate fetch on component mount
  }, []);

  /**
   * Opens the RecipeForm modal to add a new recipe.
   */
  const handleAddNewRecipe = () => {
    setIsFormOpen(true);
  };

  /**
   * Handles the successful saving of a new recipe.
   * Closes the RecipeForm modal and optionally refreshes the recipes list.
   */
  const handleSaveRecipe = () => {
    setIsFormOpen(false);
    // Optionally, re-fetch recipes to include the newly added recipe
    // fetchRecipes();
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
                        <h3>{recipe.title}</h3>
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
          <p>No recipes available. Add a new one!</p>
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
          onUpdateRecipe={handleUpdateRecipe} // Passing the update handler
        />
      )}

      {/* Bottom Navigation Component */}
      <BottomNav />
    </div>
  );
};

export default RecipeBook;
