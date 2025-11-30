import React, { useState, useEffect } from 'react';
import { Edit2, Share2 } from 'lucide-react';
import TypeSelector from '../components/TypeSelector';
import RecipeVersioning from './recipeversioning/rec-versioning';
import {
  getVariationsByRecipe,
  addVariation,
  updateRecipe
} from '../../../services/recipeService';
import { useRecipes } from '../context/RecipeContext';
import './RecipeDetails.css';

const RecipeDetails = ({ recipe, isOpen, onClose, onUpdateRecipe, onEditRecipe, onShare }) => {
  const { availableDietTypes, availableMealTypes } = useRecipes();
  const [mealType, setMealType] = useState(recipe?.mealType || "Not Specified");
  const [dietType, setDietType] = useState(recipe?.dietType || "Not Specified");
  const [error, setError] = useState(null);

  // Versioning state
  const [versions, setVersions] = useState([]);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [isVersioningOpen, setIsVersioningOpen] = useState(false);
  const [displayedRecipe, setDisplayedRecipe] = useState(recipe);

  useEffect(() => {
    setMealType(recipe?.mealType || "Not Specified");
    setDietType(recipe?.dietType || "Not Specified");
    setDisplayedRecipe(recipe);
    if (recipe?.id) {
      fetchVersions();
    }
  }, [recipe]);

  const fetchVersions = async () => {
    try {
      const variationsList = await getVariationsByRecipe(recipe.id);
      setVersions(variationsList);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  };

  const saveChanges = async () => {
    try {
      const updatedRecipe = {
        ...recipe,
        mealType,
        dietType
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
    setDietType(value);
  };

  const handleMealTypeBlur = async () => {
    if (mealType !== recipe.mealType) {
      await saveChanges();
    }
  };

  const handleDietTypeBlur = async () => {
    if (dietType !== recipe.dietType) {
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
        const { amount, unit, ingredientId } = ingredient;
        const formattedIngredientName = ingredientId ? ingredientId.replace(/-/g, ' ') : "Unnamed Ingredient";
        return (
          <li key={index}>
            {amount} {unit} of {formattedIngredientName}
          </li>
        );
      }
      return <li key={index}>{ingredient}</li>;
    });
  };

  if (!isOpen || !recipe) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content recipe-details-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>×</button>

        {error ? (
          <div className="error">
            <p>{error}</p>
          </div>
        ) : (
          <div className="modal-inner-content">
            <div className="recipe-header">
              <h1>{recipe.title}</h1>
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
                  options={availableDietTypes}
                  placeholder="Select diet type..."
                  label="Diet Type"
                />
              </div>

              {recipe.prepTime && (
                <div className="recipe-meta-item">
                  <span className="meta-label">Prep Time:</span>
                  <span className="meta-value">{recipe.prepTime}</span>
                </div>
              )}

              {recipe.servings && (
                <div className="recipe-meta-item">
                  <span className="meta-label">Servings:</span>
                  <span className="meta-value">{recipe.servings}</span>
                </div>
              )}
            </div>

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
                    __html: displayedRecipe.instructionsRichText || displayedRecipe.instructions
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
