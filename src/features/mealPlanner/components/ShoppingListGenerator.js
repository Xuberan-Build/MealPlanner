import React, { useState, useEffect } from 'react';
import { categorizeIngredient } from '../../../utils/ingredientCategories';
import { combineQuantities, formatQuantity, parseFraction } from '../../../utils/quantityNormalizer';

const ShoppingListGenerator = ({ mealPlan, onListGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (mealPlan) {
      generateList();
    }
  }, [mealPlan]);

  // Helper function to combine duplicate ingredients with proper serving calculations
  const combineIngredients = (ingredients) => {
    const combined = {};
    
    ingredients.forEach(ingredient => {
      const key = ingredient.ingredientId;
      if (!key) return;

      if (combined[key]) {
        combined[key].quantities.push({
          amount: ingredient.adjustedAmount, // Use adjusted amount based on servings
          unit: ingredient.unit
        });
      } else {
        // Get category info for organization
        const categoryInfo = categorizeIngredient(ingredient.ingredientId);
        combined[key] = {
          id: ingredient.ingredientId,
          name: ingredient.ingredientId,
          quantities: [{
            amount: ingredient.adjustedAmount, // Use adjusted amount
            unit: ingredient.unit
          }],
          category: categoryInfo.category.name,
          subcategory: categoryInfo.subcategory,
          notes: '',
          alreadyHave: false,
          estimatedCost: 0
        };
      }
    });

    return combined;
  };

  const generateList = async () => {
    setIsGenerating(true);
    
    try {
      // Extract all ingredients from the meal plan with serving adjustments
      const allIngredients = [];
      
      Object.values(mealPlan).forEach(dayMeals => {
        if (!dayMeals) return;
        
        Object.values(dayMeals).forEach(mealData => {
          // Handle both old and new data formats
          let recipe, servings;
          
          if (mealData?.recipe && typeof mealData?.servings !== 'undefined') {
            // New format: { recipe: {...}, servings: number }
            recipe = mealData.recipe;
            servings = mealData.servings;
          } else if (mealData?.title) {
            // Old format: direct recipe object
            recipe = mealData;
            servings = mealData.selectedServings || mealData.servings || 1;
          } else {
            return; // Skip invalid data
          }

          if (!recipe?.ingredients) return;

          // Calculate serving multiplier
          const recipeServings = recipe.servings || 1;
          const servingMultiplier = servings / recipeServings;

          console.log(`Processing recipe: ${recipe.title}`);
          console.log(`Recipe serves: ${recipeServings}, Want: ${servings}, Multiplier: ${servingMultiplier}`);

          recipe.ingredients.forEach(ingredient => {
            if (ingredient.ingredientId && ingredient.amount) {
              // Parse fractional amounts (e.g., "2 1/2", "1/2") to decimal numbers
              const parsedAmount = parseFraction(ingredient.amount);
              const adjustedAmount = parsedAmount * servingMultiplier;

              console.log(`  ${ingredient.ingredientId}: ${ingredient.amount} -> ${adjustedAmount} ${ingredient.unit}`);

              allIngredients.push({
                ...ingredient,
                adjustedAmount: adjustedAmount
              });
            }
          });
        });
      });

      console.log('Total ingredients processed:', allIngredients.length);

      // Combine duplicate ingredients
      const combinedIngredients = combineIngredients(allIngredients);

      // Convert to final format
      const shoppingList = Object.values(combinedIngredients).map(item => {
        // Combine quantities for the ingredient
        const combined = combineQuantities(item.quantities);
        
        return {
          id: item.id,
          name: item.name,
          quantity: combined.amount,
          unit: combined.unit,
          category: item.category,
          subcategory: item.subcategory,
          notes: item.notes,
          alreadyHave: item.alreadyHave,
          estimatedCost: item.estimatedCost
        };
      });

      // Sort by category and subcategory
      shoppingList.sort((a, b) => {
        if (a.category === b.category) {
          return a.subcategory.localeCompare(b.subcategory);
        }
        return a.category.localeCompare(b.category);
      });

      console.log('Final shopping list:', shoppingList);

      // Pass the generated list to the parent component
      if (onListGenerated) {
        onListGenerated(shoppingList);
      }

    } catch (error) {
      console.error('Error generating shopping list:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isGenerating) {
    return (
      <div className="text-center p-4">
        <p className="text-lg">Generating your shopping list...</p>
      </div>
    );
  }

  return null; // The parent component will render the list
};

export default ShoppingListGenerator;
