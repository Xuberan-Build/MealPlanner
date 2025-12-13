import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { useRecipes } from './context/RecipeContext';
import { useDebounce } from '../../hooks/useDebounce';
import RecipeCard from './components/RecipeCard';
import RecipeForm from './recipeForm/RecipeForm';
import RecipeDetails from './recipedetails/RecipeDetails';
import SearchBar from './components/SearchBar';
import FilterPanel from './components/FilterPanel';
import ConfirmDialog from './components/ConfirmDialog';
import AddToMealPlanModal from './components/AddToMealPlanModal';
import ShareRecipeModal from './components/ShareRecipeModal';
import './RecipeBook.css';

const sanitizeDietType = (dietType) => {
  return dietType.replace(/[^a-zA-Z0-9]/g, '-');
};

const RecipeBook = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    filteredRecipes,    // Flat array for search results
    recipesByDiet,      // Grouped by diet type for browsing
    loading,
    error,
    searchTerm,
    filters,
    availableDietTypes,
    availableMealTypes,
    saveRecipe,
    updateRecipe,
    deleteRecipe,
    updateSearchTerm,
    updateFilters
  } = useRecipes();

  // Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isAddToMealPlanModalOpen, setIsAddToMealPlanModalOpen] = useState(false);
  const [recipeToAdd, setRecipeToAdd] = useState(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [recipeToShare, setRecipeToShare] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    recipeId: null,
    recipeName: ''
  });

  // Local search term for immediate UI feedback (debounced to context)
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(localSearchTerm, 300);

  // Update context when debounced value changes
  useEffect(() => {
    updateSearchTerm(debouncedSearchTerm);
  }, [debouncedSearchTerm, updateSearchTerm]);

  // Check for URL parameter to open form automatically
  useEffect(() => {
    if (searchParams.get('openForm') === 'true') {
      setIsFormOpen(true);
      searchParams.delete('openForm');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  // Scroll handling
  const handleScroll = useCallback((dietType, direction) => {
    const sanitizedDietType = sanitizeDietType(dietType);
    const container = document.querySelector(`#recipe-row-${sanitizedDietType}`);
    if (container) {
      const scrollAmount = 320;
      container.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  }, []);

  // Recipe handlers (memoized)
  const handleAddRecipe = useCallback(() => {
    setEditingRecipe(null);
    setIsFormOpen(true);
  }, []);

  const handleEditRecipe = useCallback((recipe) => {
    setEditingRecipe(recipe);
    setIsFormOpen(true);
  }, []);

  const handleSaveRecipe = useCallback(async (recipeData) => {
    try {
      if (editingRecipe) {
        await updateRecipe({ ...recipeData, id: editingRecipe.id });
      } else {
        await saveRecipe(recipeData);
      }
      setIsFormOpen(false);
      setEditingRecipe(null);
    } catch (err) {
      console.error('Failed to save recipe:', err);
      alert('Failed to save recipe. Please try again.');
    }
  }, [editingRecipe, saveRecipe, updateRecipe]);

  const handleCancelRecipeForm = useCallback(() => {
    setIsFormOpen(false);
    setEditingRecipe(null);
  }, []);

  const handleRecipeClick = useCallback((recipe) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedRecipe(null);
  }, []);

  const handleUpdateRecipe = useCallback(async (recipeData) => {
    const { id, ...updateData } = recipeData;
    await updateRecipe(id, updateData);
    setSelectedRecipe(recipeData);
  }, [updateRecipe]);

  const handleDeleteClick = useCallback((recipe) => {
    setDeleteDialog({
      isOpen: true,
      recipeId: recipe.id,
      recipeName: recipe.title
    });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    try {
      await deleteRecipe(deleteDialog.recipeId);
      setDeleteDialog({ isOpen: false, recipeId: null, recipeName: '' });
      if (selectedRecipe?.id === deleteDialog.recipeId) {
        handleCloseModal();
      }
    } catch (err) {
      console.error('Failed to delete recipe:', err);
      alert('Failed to delete recipe. Please try again.');
    }
  }, [deleteDialog, deleteRecipe, selectedRecipe, handleCloseModal]);

  const handleCancelDelete = useCallback(() => {
    setDeleteDialog({ isOpen: false, recipeId: null, recipeName: '' });
  }, []);

  const handleAddToMealPlanClick = useCallback((recipe) => {
    setRecipeToAdd(recipe);
    setIsAddToMealPlanModalOpen(true);
  }, []);

  const handleCloseAddToMealPlan = useCallback(() => {
    setIsAddToMealPlanModalOpen(false);
    setRecipeToAdd(null);
  }, []);

  const handleShareRecipe = useCallback((recipe) => {
    setRecipeToShare(recipe);
    setIsShareModalOpen(true);
  }, []);

  const handleCloseShareModal = useCallback(() => {
    setIsShareModalOpen(false);
    setRecipeToShare(null);
  }, []);

  // Filter handlers (memoized)
  const handleSearchChange = useCallback((term) => {
    setLocalSearchTerm(term);
  }, []);

  const handleFilterChange = useCallback((newFilters) => {
    updateFilters(newFilters);
  }, [updateFilters]);

  const toggleFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(prev => !prev);
  }, []);

  // Sorted diet type entries (memoized)
  const sortedDietEntries = useMemo(() => {
    return Object.entries(recipesByDiet).sort(([a], [b]) => a.localeCompare(b));
  }, [recipesByDiet]);

  if (loading) {
    return (
      <div className="recipe-book-container">
        <Header />
        <main className="recipe-book-content">
          <div className="loading-section">
            <p>Loading recipes...</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="recipe-book-container">
        <Header />
        <main className="recipe-book-content">
          <div className="error-section">
            <p>{error}</p>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="recipe-book-container">
      <Header />

      <main className="recipe-book-content">
        <div className="recipe-book-header">
          <h1>Recipe Book</h1>
          <button className="add-recipe-button" onClick={handleAddRecipe}>
            + Add Recipe
          </button>
        </div>

        <div className="controls-section">
          <SearchBar
            searchTerm={localSearchTerm}
            onSearchChange={handleSearchChange}
          />
          <button className="filter-toggle-button" onClick={toggleFilterPanel}>
            {isFilterPanelOpen ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {isFilterPanelOpen && (
          <FilterPanel
            filters={filters}
            dietTypes={availableDietTypes}
            mealTypes={availableMealTypes}
            onFilterChange={handleFilterChange}
          />
        )}

        {/* Show flat list when searching, grouped list when browsing */}
        {searchTerm.trim() ? (
          // SEARCH MODE: Flat list sorted by relevance
          filteredRecipes.length > 0 ? (
            <section className="diet-type-section">
              <h2 className="diet-type-header">Search Results ({filteredRecipes.length})</h2>
              <div className="recipes-grid">
                {filteredRecipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onView={handleRecipeClick}
                    onEdit={handleEditRecipe}
                    onDelete={handleDeleteClick}
                    onAddToMealPlan={handleAddToMealPlanClick}
                  />
                ))}
              </div>
            </section>
          ) : (
            <div className="empty-section">
              <p>No recipes match "{searchTerm}". Try a different search term.</p>
            </div>
          )
        ) : (
          // BROWSE MODE: Grouped by diet type
          Object.keys(recipesByDiet).length > 0 ? (
            sortedDietEntries.map(([dietType, dietRecipes]) => {
              const sanitizedDietType = sanitizeDietType(dietType);
              return (
                <section key={dietType} className="diet-type-section">
                  <h2 className="diet-type-header">{dietType}</h2>
                  <div className="recipes-row-container">
                    <button
                      className="scroll-indicator left"
                      onClick={() => handleScroll(dietType, 'left')}
                      aria-label="Scroll left"
                    >
                      ←
                    </button>

                    <div id={`recipe-row-${sanitizedDietType}`} className="recipes-row">
                      {dietRecipes.map((recipe) => (
                        <RecipeCard
                          key={recipe.id}
                          recipe={recipe}
                          onView={handleRecipeClick}
                          onEdit={handleEditRecipe}
                          onDelete={handleDeleteClick}
                          onAddToMealPlan={handleAddToMealPlanClick}
                        />
                      ))}
                    </div>

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
            <div className="empty-section">
              {filters.dietTypes.length > 0 || filters.mealTypes.length > 0 ? (
                <p>No recipes match your filters. Try adjusting your criteria.</p>
              ) : (
                <p>No recipes available. Add a new one!</p>
              )}
            </div>
          )
        )}

        {isFormOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <RecipeForm
                recipe={editingRecipe}
                onSave={handleSaveRecipe}
                onCancel={handleCancelRecipeForm}
              />
            </div>
          </div>
        )}

        {selectedRecipe && (
          <RecipeDetails
            recipe={selectedRecipe}
            isOpen={isModalOpen}
            onClose={handleCloseModal}
            onUpdateRecipe={handleUpdateRecipe}
            onEditRecipe={handleEditRecipe}
            onShare={handleShareRecipe}
          />
        )}

        <ConfirmDialog
          isOpen={deleteDialog.isOpen}
          title="Delete Recipe"
          message={`Are you sure you want to delete "${deleteDialog.recipeName}"? This action cannot be undone.`}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />

        <AddToMealPlanModal
          isOpen={isAddToMealPlanModalOpen}
          recipe={recipeToAdd}
          onClose={handleCloseAddToMealPlan}
        />

        <ShareRecipeModal
          isOpen={isShareModalOpen}
          recipe={recipeToShare}
          onClose={handleCloseShareModal}
        />
      </main>

      <BottomNav />
    </div>
  );
};

export default RecipeBook;
