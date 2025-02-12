import { getRecipes } from './recipeService';
import Papa from 'papaparse';

/**
 * Export recipes to a CSV file
 */
export const exportRecipesToCSV = async () => {
  try {
    const recipes = await getRecipes(); // Fetch all recipes
    const csvData = Papa.unparse(recipes); // Convert JSON to CSV format

    // Create a downloadable CSV file
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'recipes.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    throw new Error('Failed to export recipes to CSV');
  }
};

/**
 * Import recipes from a CSV file
 * @param {File} file - The CSV file to be imported
 * @returns {Promise<Array>} - List of imported recipes
 */
export const importRecipesFromCSV = (file) => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (result) => {
        const recipes = result.data.map((recipe) => ({
          title: recipe.title,
          mealType: recipe.mealType,
          dietType: recipe.dietType, // Mapping the new dietType column
          ingredients: recipe.ingredients.split(','), // Convert ingredients string to array
          diets: recipe.diets ? recipe.diets.split(',') : [], // Handle potential missing diets
        }));
        resolve(recipes);
      },
      error: (error) => {
        console.error('Error importing CSV:', error);
        reject(error);
      },
    });
  });
};
