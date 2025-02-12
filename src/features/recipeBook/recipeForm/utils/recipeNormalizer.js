/**
 * Normalizes ingredient data to match the expected format
 * @param {Array|Object} ingredient - Raw ingredient data
 * @returns {Object} Normalized ingredient object
 */
const normalizeIngredient = (ingredient) => {
    if (typeof ingredient === 'string') {
      return {
        ingredientId: ingredient,
        amount: '',
        unit: ''
      };
    }
    return {
      ingredientId: ingredient.ingredientId || ingredient.name || '',
      amount: ingredient.amount || '',
      unit: ingredient.unit || ''
    };
  };

  /**
   * Normalizes recipe data from OCR or other sources
   * @param {Object} recipe - Raw recipe data
   * @returns {Object} Normalized recipe object
   */
  export const normalizeRecipe = (recipe) => {
    if (!recipe || typeof recipe !== 'object') {
      throw new Error('Invalid recipe data received');
    }

    return {
      title: recipe.title || '',
      mealType: recipe.mealType || '',
      dietType: recipe.dietType || '',
      prepTime: recipe.prepTime || '',
      servings: recipe.servings?.toString() || '',
      ingredients: Array.isArray(recipe.ingredients)
        ? recipe.ingredients.map(normalizeIngredient)
        : [],
      instructions: recipe.instructions || '',
      imageUrl: recipe.imageUrl || '',
      imagePath: recipe.imagePath || ''
    };
  };
