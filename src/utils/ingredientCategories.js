// Comprehensive ingredient categorization system for shopping list organization

export const INGREDIENT_CATEGORIES = {
    PRODUCE: {
      name: 'Produce',
      subcategories: {
        FRUITS: 'Fruits',
        VEGETABLES: 'Vegetables',
        HERBS: 'Fresh Herbs',
        SALAD: 'Salad & Leafy Greens'
      }
    },
    MEAT_SEAFOOD: {
      name: 'Meat & Seafood',
      subcategories: {
        POULTRY: 'Poultry',
        BEEF: 'Beef',
        PORK: 'Pork',
        SEAFOOD: 'Fish & Seafood',
        OTHER_MEAT: 'Other Meats'
      }
    },
    DAIRY_EGGS: {
      name: 'Dairy & Eggs',
      subcategories: {
        MILK: 'Milk & Cream',
        CHEESE: 'Cheese',
        YOGURT: 'Yogurt & Cultured Dairy',
        EGGS: 'Eggs',
        OTHER_DAIRY: 'Other Dairy Products'
      }
    },
    PANTRY: {
      name: 'Pantry',
      subcategories: {
        GRAINS: 'Grains & Pasta',
        CANNED: 'Canned Goods',
        BAKING: 'Baking Supplies',
        CONDIMENTS: 'Condiments & Sauces',
        SPICES: 'Spices & Seasonings',
        OILS: 'Oils & Vinegars'
      }
    },
    FROZEN: {
      name: 'Frozen Foods',
      subcategories: {
        FROZEN_VEG: 'Frozen Vegetables',
        FROZEN_FRUITS: 'Frozen Fruits',
        FROZEN_MEALS: 'Frozen Meals',
        OTHER_FROZEN: 'Other Frozen Items'
      }
    },
    OTHER: {
      name: 'Other Items',
      subcategories: {
        BEVERAGES: 'Beverages',
        SNACKS: 'Snacks',
        MISC: 'Miscellaneous'
      }
    }
  };

  // Ingredient category mapping based on common keywords
  const categoryMappings = {
    // Produce - Fruits
    'apple': { category: 'PRODUCE', subcategory: 'FRUITS' },
    'banana': { category: 'PRODUCE', subcategory: 'FRUITS' },
    'berry': { category: 'PRODUCE', subcategory: 'FRUITS' },
    'citrus': { category: 'PRODUCE', subcategory: 'FRUITS' },

    // Produce - Vegetables
    'carrot': { category: 'PRODUCE', subcategory: 'VEGETABLES' },
    'potato': { category: 'PRODUCE', subcategory: 'VEGETABLES' },
    'onion': { category: 'PRODUCE', subcategory: 'VEGETABLES' },
    'garlic': { category: 'PRODUCE', subcategory: 'VEGETABLES' },
    'pepper': { category: 'PRODUCE', subcategory: 'VEGETABLES' },
    'tomato': { category: 'PRODUCE', subcategory: 'VEGETABLES' },

    // Produce - Herbs
    'basil': { category: 'PRODUCE', subcategory: 'HERBS' },
    'cilantro': { category: 'PRODUCE', subcategory: 'HERBS' },
    'parsley': { category: 'PRODUCE', subcategory: 'HERBS' },
    'mint': { category: 'PRODUCE', subcategory: 'HERBS' },

    // Produce - Salad
    'lettuce': { category: 'PRODUCE', subcategory: 'SALAD' },
    'spinach': { category: 'PRODUCE', subcategory: 'SALAD' },
    'arugula': { category: 'PRODUCE', subcategory: 'SALAD' },

    // Meat & Seafood
    'chicken': { category: 'MEAT_SEAFOOD', subcategory: 'POULTRY' },
    'turkey': { category: 'MEAT_SEAFOOD', subcategory: 'POULTRY' },
    'beef': { category: 'MEAT_SEAFOOD', subcategory: 'BEEF' },
    'steak': { category: 'MEAT_SEAFOOD', subcategory: 'BEEF' },
    'pork': { category: 'MEAT_SEAFOOD', subcategory: 'PORK' },
    'fish': { category: 'MEAT_SEAFOOD', subcategory: 'SEAFOOD' },
    'salmon': { category: 'MEAT_SEAFOOD', subcategory: 'SEAFOOD' },
    'shrimp': { category: 'MEAT_SEAFOOD', subcategory: 'SEAFOOD' },

    // Dairy & Eggs
    'milk': { category: 'DAIRY_EGGS', subcategory: 'MILK' },
    'cream': { category: 'DAIRY_EGGS', subcategory: 'MILK' },
    'cheese': { category: 'DAIRY_EGGS', subcategory: 'CHEESE' },
    'yogurt': { category: 'DAIRY_EGGS', subcategory: 'YOGURT' },
    'egg': { category: 'DAIRY_EGGS', subcategory: 'EGGS' },

    // Pantry Items
    'pasta': { category: 'PANTRY', subcategory: 'GRAINS' },
    'rice': { category: 'PANTRY', subcategory: 'GRAINS' },
    'flour': { category: 'PANTRY', subcategory: 'BAKING' },
    'sugar': { category: 'PANTRY', subcategory: 'BAKING' },
    'oil': { category: 'PANTRY', subcategory: 'OILS' },
    'vinegar': { category: 'PANTRY', subcategory: 'OILS' },
    'sauce': { category: 'PANTRY', subcategory: 'CONDIMENTS' },
    'spice': { category: 'PANTRY', subcategory: 'SPICES' },
    'seasoning': { category: 'PANTRY', subcategory: 'SPICES' },
    'can': { category: 'PANTRY', subcategory: 'CANNED' },

    // Frozen Items
    'frozen': { category: 'FROZEN', subcategory: 'OTHER_FROZEN' },
    'ice': { category: 'FROZEN', subcategory: 'OTHER_FROZEN' }
  };

  /**
   * Determines the category and subcategory for an ingredient
   * @param {string} ingredientName - Name of the ingredient to categorize
   * @returns {Object} Category and subcategory information
   */
  export function categorizeIngredient(ingredientName) {
    if (!ingredientName) {
      return {
        category: INGREDIENT_CATEGORIES.OTHER,
        subcategory: INGREDIENT_CATEGORIES.OTHER.subcategories.MISC
      };
    }

    const normalizedName = ingredientName.toLowerCase().trim();

    // Check for direct matches first
    for (const [keyword, categoryInfo] of Object.entries(categoryMappings)) {
      if (normalizedName.includes(keyword)) {
        return {
          category: INGREDIENT_CATEGORIES[categoryInfo.category],
          subcategory: INGREDIENT_CATEGORIES[categoryInfo.category].subcategories[categoryInfo.subcategory]
        };
      }
    }

    // Default categorization if no matches found
    return {
      category: INGREDIENT_CATEGORIES.OTHER,
      subcategory: INGREDIENT_CATEGORIES.OTHER.subcategories.MISC
    };
  }

  /**
   * Gets all available categories and their subcategories
   * @returns {Object} Complete category hierarchy
   */
  export function getAllCategories() {
    return INGREDIENT_CATEGORIES;
  }

  /**
   * Validates if a category/subcategory combination exists
   * @param {string} category - Main category key
   * @param {string} subcategory - Subcategory key
   * @returns {boolean} Whether the combination is valid
   */
  export function isValidCategory(category, subcategory) {
    return (
      INGREDIENT_CATEGORIES[category] &&
      INGREDIENT_CATEGORIES[category].subcategories[subcategory]
    );
  }
