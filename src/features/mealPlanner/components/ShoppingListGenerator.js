import React, { useState, useEffect } from 'react';
import { categorizeIngredient } from '../../../utils/ingredientCategories';
import { combineQuantities, formatQuantity } from '../../../utils/quantityNormalizer';

const ShoppingListGenerator = ({ mealPlan, onListGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (mealPlan) {
      generateList();
    }
  }, [mealPlan]);

  // Helper function to combine duplicate ingredients
  const combineIngredients = (ingredients) => {
    const combined = {};

    ingredients.forEach(ingredient => {
      const key = ingredient.ingredientId;
      if (!key) return;

      if (combined[key]) {
        combined[key].quantities.push({
          amount: ingredient.amount,
          unit: ingredient.unit
        });
      } else {
        // Get category info for organization (we'll use this later for sorting)
        const categoryInfo = categorizeIngredient(ingredient.ingredientId);

        combined[key] = {
          id: ingredient.ingredientId,
          name: ingredient.ingredientId, // You might want to map this to a display name
          quantities: [{
            amount: ingredient.amount,
            unit: ingredient.unit
          }],
          category: categoryInfo.category.name,
          subcategory: categoryInfo.subcategory,
          notes: '',
          alreadyHave: false,
          estimatedCost: 0 // You might want to fetch this from a price database
        };
      }
    });

    return combined;
  };

  const generateList = async () => {
    setIsGenerating(true);
    try {
      // Extract all ingredients from the meal plan
      const allIngredients = [];

      Object.values(mealPlan).forEach(dayMeals => {
        if (!dayMeals) return;

        Object.values(dayMeals).forEach(meal => {
          if (!meal?.ingredients) return;

          meal.ingredients.forEach(ingredient => {
            if (ingredient.ingredientId) {
              allIngredients.push(ingredient);
            }
          });
        });
      });

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
