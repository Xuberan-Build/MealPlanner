import React, { useState } from 'react';
import './RecipeDetails.css';

const RecipeDetails = ({ recipe, isOpen, onClose, onUpdateRecipe }) => {
    const [mealType, setMealType] = useState(recipe?.mealType || "Not Specified");
    const [dietType, setDietType] = useState(recipe?.dietType || "Not Specified");
    const [isEditingMeal, setIsEditingMeal] = useState(false);
    const [isEditingDiet, setIsEditingDiet] = useState(false);
    const [error, setError] = useState(null);

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
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>

                {error ? (
                    <div className="error">
                        <p>{error}</p>
                    </div>
                ) : (
                    <div className="modal-inner-content">
                        <div className="recipe-header">
                            <h1>{recipe.title}</h1>
                        </div>

                        <div className="recipe-meta">
                            {isEditingMeal ? (
                                <input
                                    className="editable-input"
                                    value={mealType}
                                    onChange={(e) => setMealType(e.target.value)}
                                    onBlur={async () => {
                                        setIsEditingMeal(false);
                                        await saveChanges();
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span className="recipe-tag" onClick={() => setIsEditingMeal(true)}>
                                    {mealType}
                                </span>
                            )}

                            {isEditingDiet ? (
                                <input
                                    className="editable-input"
                                    value={dietType}
                                    onChange={(e) => setDietType(e.target.value)}
                                    onBlur={async () => {
                                        setIsEditingDiet(false);
                                        await saveChanges();
                                    }}
                                    autoFocus
                                />
                            ) : (
                                <span className="recipe-tag" onClick={() => setIsEditingDiet(true)}>
                                    {dietType}
                                </span>
                            )}

                            {recipe.prepTime && (
                                <span className="recipe-tag">{recipe.prepTime}</span>
                            )}
                        </div>

                        <div className="recipe-section">
                            <h2 className="recipe-section-title">Ingredients</h2>
                            <ul className="recipe-ingredients">
                                {renderIngredients(recipe.ingredients)}
                            </ul>
                        </div>

                        {recipe.instructions && (
                            <div className="recipe-section">
                                <h2 className="recipe-section-title">Instructions</h2>
                                <div className="recipe-instructions">
                                    {recipe.instructions}
                                </div>
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
