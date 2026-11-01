import React, { useState, useEffect, useCallback } from 'react';
import { Edit2, Share2, ChevronLeft, ChevronRight } from 'lucide-react';
import TypeSelector from '../components/TypeSelector';
import RecipeVersioning from './recipeversioning/rec-versioning';
import {
  getVariationsByRecipe,
  addVariation,
  updateRecipe
} from '../../../services/recipeService';
import { useRecipes } from '../context/RecipeContext';
import { formatInstructions } from '../../../utils/instructionsFormatter';
import dietTypeService from '../../../services/dietTypeService';
import { auth } from '../../../firebase';
import { dietTypeNames } from '../../../utils/dietTypeNames';
import RecipePlanPanel from '../components/RecipePlanPanel';
import './RecipeDetails.css';

/** "1 cup flour", "2 large onions", "salt" — an ingredient line as people write it. */
export const formatIngredientLine = ({ amount, unit, ingredientId } = {}) => {
  const name = ingredientId ? String(ingredientId).replace(/-/g, ' ') : 'Unnamed ingredient';
  return [amount, unit, name].map((part) => (part === undefined || part === null ? '' : String(part).trim()))
    .filter(Boolean)
    .join(' ');
};

// Arrow keys browse recipes, except while typing in a field.
const isTypingTarget = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const RecipeDetails = ({
  recipe,
  isOpen,
  onClose,
  onUpdateRecipe,
  onEditRecipe,
  onShare,
  onPrevious = null,
  onNext = null,
  positionLabel = '',
}) => {
  const { availableDietTypes, availableMealTypes } = useRecipes();
  const [mealType, setMealType] = useState(recipe?.mealType || "Not Specified");
  // Handle both new dietTypes array and legacy dietType string
  const getInitialDietType = (recipe) => {
    if (recipe?.dietTypes && Array.isArray(recipe.dietTypes) && recipe.dietTypes.length > 0) {
      return recipe.dietTypes[0]; // Use first diet type from array
    }
    return recipe?.dietType || "Not Specified";
  };
  const [dietType, setDietType] = useState(getInitialDietType(recipe));
  const [userDietTypes, setUserDietTypes] = useState([]);
  const [error, setError] = useState(null);

  // Versioning state
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [isVersioningOpen, setIsVersioningOpen] = useState(false);
  const [displayedRecipe, setDisplayedRecipe] = useState(recipe);

  const recipeId = recipe?.id;

  const loadUserDietTypes = useCallback(async () => {
    try {
      const user = auth.currentUser;
      if (user) setUserDietTypes(dietTypeNames(await dietTypeService.getDietTypes(user.uid)));
    } catch (error) {
      console.error('Error loading diet types:', error);
    }
  }, []);

  const fetchVersions = useCallback(async () => {
    if (!recipeId) return;
    try {
      setVersions(await getVariationsByRecipe(recipeId));
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, [recipeId]);

  // Reset for each recipe. Browsing quickly (Previous / Next) must not let a slow response
  // for the previous recipe land on this one, so late results are ignored.
  useEffect(() => {
    let cancelled = false;
    setMealType(recipe?.mealType || "Not Specified");
    setDietType(getInitialDietType(recipe));
    setDisplayedRecipe(recipe);
    setVersions([]);

    if (recipe?.id) {
      getVariationsByRecipe(recipe.id)
        .then((list) => { if (!cancelled) setVersions(list); })
        .catch((err) => console.error('Failed to fetch versions:', err));
    }

    const user = auth.currentUser;
    if (user) {
      dietTypeService.getDietTypes(user.uid)
        .then((types) => { if (!cancelled) setUserDietTypes(dietTypeNames(types)); })
        .catch((err) => console.error('Error loading diet types:', err));
    }
    return () => { cancelled = true; };
  }, [recipe]);

  const saveChanges = async () => {
    try {
      const updatedRecipe = {
        ...recipe,
        mealType,
        dietType, // Keep legacy field for backwards compatibility
        // Also update dietTypes array if dietType is set
        dietTypes: dietType && dietType !== "Not Specified" ? [dietType] : []
      };
      await onUpdateRecipe(updatedRecipe);
    } catch (error) {
      console.error('Failed to update recipe:', error);
      setError('Failed to save changes.');
    }
  };

  const handleMealTypeChange = (value) => {
    setMealType(value);
  };

  const handleDietTypeChange = (value) => {
    // Just update state, don't save on every keystroke
    setDietType(value);
  };

  const handleMealTypeBlur = async () => {
    if (mealType !== recipe.mealType) {
      await saveChanges();
    }
  };

  const handleDietTypeBlur = async () => {
    // Save custom diet type and recipe when user commits the value
    if (dietType !== recipe.dietType) {
      const user = auth.currentUser;
      // Only save as custom diet type if it's not empty and not already in the list
      if (user && dietType && dietType !== "Not Specified" && !userDietTypes.includes(dietType) && !availableDietTypes.includes(dietType)) {
        await dietTypeService.addCustomDietType(user.uid, dietType);
        await loadUserDietTypes(); // Refresh the list
      }
      await saveChanges();
    }
  };

  const handleVersionSelect = (version) => {
    setCurrentVersion(version);
    setDisplayedRecipe({
      ...recipe,
      ingredients: version.ingredients,
      instructions: version.instructions
    });
  };

  const handleCreateVersion = async (variationData) => {
    try {
      await addVariation({
        ...variationData,
        recipeId: recipe.id
      });

      if (variationData.makeDefault) {
        await handleSetDefault({
          ...variationData,
          recipeId: recipe.id
        });
      }

      await fetchVersions();
    } catch (err) {
      console.error('Failed to create version:', err);
      throw err;
    }
  };

  const handleSetDefault = async (version) => {
    try {
      // Update the main recipe with the version's ingredients and instructions
      const updatedRecipe = {
        ...recipe,
        ingredients: version.ingredients,
        instructions: version.instructions
      };
      await updateRecipe(updatedRecipe);
      await onUpdateRecipe(updatedRecipe);
      setDisplayedRecipe(updatedRecipe);
      await fetchVersions();
    } catch (err) {
      console.error('Failed to set default version:', err);
      throw err;
    }
  };

  const handleEdit = () => {
    onEditRecipe(recipe);
    onClose();
  };

  const handleShareClick = () => {
    if (onShare) {
      onShare(recipe);
    }
  };

  const renderIngredients = (ingredients) => {
    if (!ingredients || !Array.isArray(ingredients)) {
      return <p className="error-message">No ingredients available.</p>;
    }

    return ingredients.map((ingredient, index) => {
      if (typeof ingredient === 'object' && ingredient !== null) {
        return <li key={index}>{formatIngredientLine(ingredient)}</li>;
      }
      return <li key={index}>{ingredient}</li>;
    });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKeyDown = (e) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === 'ArrowLeft' && onPrevious) onPrevious();
      else if (e.key === 'ArrowRight' && onNext) onNext();
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onPrevious, onNext, onClose]);

  if (!isOpen || !recipe) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content recipe-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close recipe">×</button>

        {(onPrevious || onNext) && (
          <nav className="recipe-nav" aria-label="Browse recipes">
            <button type="button" onClick={onPrevious || undefined} disabled={!onPrevious} aria-label="Previous recipe">
              <ChevronLeft size={18} aria-hidden="true" /> Previous
            </button>
            {positionLabel && <span className="recipe-nav-position">{positionLabel}</span>}
            <button type="button" onClick={onNext || undefined} disabled={!onNext} aria-label="Next recipe">
              Next <ChevronRight size={18} aria-hidden="true" />
            </button>
          </nav>
        )}

        {error ? (
          <div className="error">
            <p>{error}</p>
          </div>
        ) : (
          <div className="modal-inner-content">
            <div className="recipe-header">
              <div className="recipe-title-section">
                <h1>{recipe.title}</h1>
                {recipe.servings && (
                  <p className="recipe-servings">Servings: {recipe.servings}</p>
                )}
              </div>
              <div className="recipe-header-actions">
                <button
                  className="icon-button"
                  onClick={handleEdit}
                  title="Edit Recipe"
                >
                  <Edit2 size={20} />
                </button>
                {onShare && (
                  <button
                    className="icon-button"
                    onClick={handleShareClick}
                    title="Share Recipe"
                  >
                    <Share2 size={20} />
                  </button>
                )}
              </div>
            </div>

            {recipe.imageUrl && (
              <div className="recipe-image-container">
                <img src={recipe.imageUrl} alt={recipe.title} className="recipe-image" />
              </div>
            )}

            <div className="recipe-meta">
              <div className="recipe-meta-item">
                <TypeSelector
                  value={mealType}
                  onChange={handleMealTypeChange}
                  onBlur={handleMealTypeBlur}
                  options={availableMealTypes}
                  placeholder="Select meal type..."
                  label="Meal Type"
                />
              </div>

              <div className="recipe-meta-item">
                <TypeSelector
                  value={dietType}
                  onChange={handleDietTypeChange}
                  onBlur={handleDietTypeBlur}
                  options={userDietTypes.length > 0 ? userDietTypes : availableDietTypes}
                  placeholder="Select or type diet type..."
                  label="Diet Type"
                />
              </div>

              {recipe.prepTime && (
                <div className="recipe-meta-item">
                  <span className="meta-label">Prep Time:</span>
                  <span className="meta-value">{recipe.prepTime}</span>
                </div>
              )}
            </div>

            <RecipePlanPanel recipe={recipe} />

            <RecipeVersioning
              recipe={recipe}
              versions={versions}
              currentVersion={currentVersion}
              onVersionSelect={handleVersionSelect}
              onCreateVersion={handleCreateVersion}
              isOpen={isVersioningOpen}
              onOpenChange={setIsVersioningOpen}
              onSetDefault={handleSetDefault}
            />

            <div className="recipe-section">
              <h2 className="recipe-section-title">Ingredients</h2>
              <ul className="recipe-ingredients">
                {renderIngredients(displayedRecipe.ingredients)}
              </ul>
            </div>

            {displayedRecipe.instructions && (
              <div className="recipe-section">
                <h2 className="recipe-section-title">Instructions</h2>
                <div
                  className="recipe-instructions"
                  dangerouslySetInnerHTML={{
                    __html: displayedRecipe.instructionsRichText || formatInstructions(displayedRecipe.instructions)
                  }}
                />
              </div>
            )}

            {recipe.notes && (
              <div className="recipe-section">
                <h2 className="recipe-section-title">Notes</h2>
                <div className="recipe-notes">
                  {recipe.notes}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default RecipeDetails;
