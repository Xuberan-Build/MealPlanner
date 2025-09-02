// src/features/shoppingList/components/RecipeSelectionModal.js – FULL CODE (final complete version)

import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db, auth } from '../../../firebase';
import styles from './RecipeSelectionModal.module.css';

const normalize = (str = '') => str.toLowerCase().replace(/[^a-z0-9]/g, '');

const RecipeSelectionModal = ({ isOpen, onClose, onRecipeAdd }) => {
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [servings, setServings] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showServingAdjustment, setShowServingAdjustment] = useState(false);

  useEffect(() => {
    const fetchRecipes = async () => {
      if (!isOpen) return;
      try {
        setIsLoading(true);
        const user = auth.currentUser;
        if (!user) return;

        const recipesRef = collection(db, 'recipes');
        const q = query(recipesRef, where('userId', '==', user.uid), orderBy('name', 'asc'));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setRecipes(data);
        setFilteredRecipes(data);
      } catch (err) {
        console.error('Error fetching recipes:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecipes();
  }, [isOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredRecipes(recipes);
      return;
    }
    const term = normalize(searchTerm);
    const filtered = recipes.filter(
      (r) => normalize(r.name ?? '').includes(term) || normalize(r.description ?? '').includes(term)
    );
    setFilteredRecipes(filtered);
  }, [searchTerm, recipes]);

  const handleRecipeSelect = (recipe) => {
    setSelectedRecipe(recipe);
    setServings(recipe.servings || 1);
    setShowServingAdjustment(true);
  };

  const handleAddRecipe = () => {
    if (!selectedRecipe) return;
    onRecipeAdd({ recipe: selectedRecipe, servings });
    handleClose();
  };

  const handleClose = () => {
    setSelectedRecipe(null);
    setServings(1);
    setShowServingAdjustment(false);
    setSearchTerm('');
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) handleClose();
  };

  if (!isOpen) return null;

  if (showServingAdjustment && selectedRecipe) {
    return (
      <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
        <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
          <div className={styles['modal-header']}>
            <button className={styles['modal-back']} onClick={() => setShowServingAdjustment(false)}>← Back</button>
            <h3>Add Recipe</h3>
            <button className={styles['modal-close']} onClick={handleClose}>✕</button>
          </div>
          <div className={styles['recipe-details']}>
            <div className={styles['recipe-info']}>
              <h4>{selectedRecipe.name}</h4>
              {selectedRecipe.description && <p className={styles['recipe-description']}>{selectedRecipe.description}</p>}
              <div className={styles['recipe-meta']}>
                <span className={styles['original-servings']}>
                  Original: {selectedRecipe.servings || 1} servings
                </span>
                {selectedRecipe.ingredients && (
                  <span className={styles['ingredient-count']}>
                    {selectedRecipe.ingredients.length} ingredients
                  </span>
                )}
              </div>
            </div>
            <div className={styles['serving-adjustment']}>
              <label className={styles['serving-label']}>How many servings do you want?</label>
              <div className={styles['serving-controls']}>
                <button className={styles['serving-button']} onClick={() => setServings(Math.max(1, servings - 1))} disabled={servings <= 1}>−</button>
                <input
                  type="number"
                  className={styles['serving-input']}
                  value={servings}
                  min="1"
                  max="20"
                  onChange={(e) => setServings(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button className={styles['serving-button']} onClick={() => setServings(servings + 1)}>+</button>
              </div>
            </div>
            {selectedRecipe.ingredients && (
              <div className={styles['ingredients-preview']}>
                <h5>Ingredients that will be added:</h5>
                <div className={styles['ingredient-list']}>
                  {selectedRecipe.ingredients.slice(0, 5).map((ing, idx) => {
                    const baseAmt = ing.amount || 0;
                    const recipeServings = selectedRecipe.servings || 1;
                    const adjAmt = ((baseAmt * servings) / recipeServings).toFixed(1);
                    return (
                      <div key={idx} className={styles['ingredient-item']}>
                        <span className={styles['ingredient-amount']}>
                          {adjAmt} {ing.unit}
                        </span>
                        <span className={styles['ingredient-name']}>{ing.ingredientId}</span>
                      </div>
                    );
                  })}
                  {selectedRecipe.ingredients.length > 5 && (
                    <div className={styles['more-ingredients']}>
                      +{selectedRecipe.ingredients.length - 5} more ingredients
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className={styles['modal-actions']}>
            <button className={styles['cancel-button']} onClick={() => setShowServingAdjustment(false)}>Cancel</button>
            <button className={styles['add-recipe-button']} onClick={handleAddRecipe}>Add to Shopping List</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
      <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h3>Add Recipe</h3>
          <button className={styles['modal-close']} onClick={handleClose}>✕</button>
        </div>
        <div className={styles['search-container']}>
          <input
            type="text"
            className={styles['search-input']}
            placeholder="Search your recipes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles['recipes-container']}>
          {isLoading ? (
            <div className={styles['loading-state']}>
              <p>Loading your recipes...</p>
            </div>
          ) : filteredRecipes.length === 0 ? (
            <div className={styles['empty-state']}>
              {searchTerm ? (
                <p>No recipes found matching "{searchTerm}"</p>
              ) : (
                <p>No recipes found. Create some recipes in your recipe book first!</p>
              )}
            </div>
          ) : (
            <div className={styles['recipes-grid']}>
              {filteredRecipes.map((recipe) => (
                <div
                  key={recipe.id}
                  className={styles['recipe-card']}
                  onClick={() => handleRecipeSelect(recipe)}
                >
                  <div className={styles['recipe-card-content']}>
                    <h4 className={styles['recipe-name']}>{recipe.name}</h4>
                    {recipe.description && (
                      <p className={styles['recipe-description']}>
                        {recipe.description.length > 80
                          ? `${recipe.description.substring(0, 80)}...`
                          : recipe.description}
                      </p>
                    )}
                    <div className={styles['recipe-meta']}>
                      <span className={styles['servings']}>
                        {recipe.servings || 1} servings
                      </span>
                      {recipe.ingredients && (
                        <span className={styles['ingredient-count']}>
                          {recipe.ingredients.length} ingredients
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={styles['add-icon']}>+</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RecipeSelectionModal;
