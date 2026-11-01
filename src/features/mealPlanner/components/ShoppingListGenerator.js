import { useState, useEffect } from 'react';
import { buildShoppingList } from '../../../services/shoppingList/buildShoppingList';

/**
 * Builds the shopping list for a meal plan and hands it to the parent.
 * All math (servings, unit merging, rounding, aisle grouping) lives in buildShoppingList.
 *
 * Props:
 *   mealPlan        { [day]: { [meal]: slot } } (either slot format)
 *   onListGenerated (items) => void
 */
const ShoppingListGenerator = ({ mealPlan, onListGenerated }) => {
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (!mealPlan) return;
    setIsGenerating(true);
    try {
      const items = buildShoppingList(mealPlan);
      if (onListGenerated) onListGenerated(items);
    } catch (error) {
      console.error('Error generating shopping list:', error);
    } finally {
      setIsGenerating(false);
    }
    // onListGenerated is intentionally excluded: parents pass a new function each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealPlan]);

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
