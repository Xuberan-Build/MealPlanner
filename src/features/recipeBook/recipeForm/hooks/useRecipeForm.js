import { useState } from 'react';

const initialFormState = {
  title: '',
  mealType: '',
  dietType: '',
  prepTime: '',
  servings: '',
  ingredients: [],
  instructions: '',
  instructionsRichText: '', // Add storage for rich text version
  imageUrl: '',
  imagePath: ''
};

export const useRecipeForm = ({ onSave, initialRecipe }) => {
  const [formData, setFormData] = useState(initialRecipe || initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [processing, setProcessing] = useState(false); // For OCR/LLM processing
  const [error, setError] = useState(null); // For errors during processing or submit

  const handleChange = (field, value, metadata = {}) => {
    // Log diet type changes for debugging
    if (field === 'dietType') {
      console.log("📌 DIET TYPE CHANGED:", value, "Type:", typeof value);
    }

    // Update form data with main value
    const updates = {
      [field]: value
    };

    // Handle special cases like rich text
    if (field === 'instructions' && metadata.richText) {
      updates.instructionsRichText = metadata.richText;
    }

    setFormData((prev) => ({
      ...prev,
      ...updates
    }));
  };

  const handleImageUploadSuccess = ({ url, path }) => {
    setFormData(prev => ({
      ...prev,
      imageUrl: url,
      imagePath: path
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log("📌 START: handleSubmit called with formData:", formData);
    console.log("📌 FORM DATA DIET TYPE:", formData.dietType, "| Title:", formData.title);
    setIsSubmitting(true);

    setError(null); // Clear previous errors on new submission
    try {
      // Basic validation
      if (!formData.title) {
        console.error("📌 ERROR: Missing required field 'title'");
        setError("Recipe title is required");
        setIsSubmitting(false);
        return;
      }

      // Prepare data for submission
      const submissionData = {
        ...formData,
      };

      console.log("📌 Validation passed, delegating to onSave callback");

      // Delegate saving to the parent component (RecipeBook -> RecipeContext)
      // This prevents duplicate saves
      if (onSave) {
        console.log("📌 Calling onSave callback with data");
        onSave(submissionData);
      } else {
        console.warn("📌 WARNING: No onSave callback provided");
        throw new Error("No onSave callback provided");
      }
    } catch (error) {
      console.error('📌 ERROR in handleSubmit:', error);
      setError(`Failed to save recipe: ${error.message}`);
    } finally {
      console.log("📌 END: handleSubmit completed, isSubmitting set to false");
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setImportMode(false);
    setError(null); // Clear errors on reset
  };

  // Parse ingredient string into structured object
  const parseIngredientString = (ingredientStr) => {
    if (typeof ingredientStr === 'object' && (ingredientStr.name || ingredientStr.ingredientId)) {
      // Already an object, ensure it has ingredientId
      return {
        amount: ingredientStr.amount || '',
        unit: ingredientStr.unit || '',
        ingredientId: ingredientStr.ingredientId || ingredientStr.name || ''
      };
    }

    // Try to parse "amount unit name" format
    // Examples: "2 cups flour", "1/2 teaspoon salt", "3 large eggs"
    const match = ingredientStr.match(/^([\d\s\/.-]+)?\s*([\w\s]+?)?\s+(.+)$/);

    if (match) {
      const [, amount, unit, name] = match;
      return {
        amount: amount?.trim() || '',
        unit: unit?.trim() || '',
        ingredientId: name?.trim() || ingredientStr
      };
    }

    // If no match, put everything in ingredientId field
    return {
      amount: '',
      unit: '',
      ingredientId: ingredientStr.trim()
    };
  };

  // Handle incoming OCR data - ensure compatibility with rich text
  const handleRecipeImport = (extractedRecipe) => {
    console.log("📌 IMPORTING RECIPE:", extractedRecipe);

    // If we receive instructions from OCR, we need to handle them as plain text
    // but also initialize a richText version
    const updatedRecipe = { ...extractedRecipe };

    if (updatedRecipe.instructions) {
      // Convert plain text to simple HTML for rich text editor
      // This creates paragraphs from newlines
      const richText = updatedRecipe.instructions
        .split(/\n\s*\n/)
        .map(paragraph => `<p>${paragraph.replace(/\n/g, '<br/>')}</p>`)
        .join('');

      updatedRecipe.instructionsRichText = richText;
    }

    // Parse ingredients from strings to objects if needed
    if (updatedRecipe.ingredients && Array.isArray(updatedRecipe.ingredients)) {
      updatedRecipe.ingredients = updatedRecipe.ingredients.map(ing =>
        typeof ing === 'string' ? parseIngredientString(ing) : ing
      );
      console.log("📌 PARSED INGREDIENTS:", updatedRecipe.ingredients);
    }

    // Don't overwrite dietType and mealType with empty values from imported recipes
    // Keep the current values if imported recipe doesn't have them
    if (!updatedRecipe.dietType || updatedRecipe.dietType === '') {
      delete updatedRecipe.dietType;
    }
    if (!updatedRecipe.mealType || updatedRecipe.mealType === '') {
      delete updatedRecipe.mealType;
    }

    console.log("📌 IMPORTING RECIPE - dietType:", updatedRecipe.dietType, "mealType:", updatedRecipe.mealType);

    setFormData(prev => ({
      ...prev,
      ...updatedRecipe
    }));
  };

  return {
    formData,
    isSubmitting,
    importMode,
    setImportMode,
    handleChange,
    handleImageUploadSuccess,
    handleSubmit,
    resetForm,
    setFormData,
    processing,
    setProcessing,
    error,
    setError,
    handleRecipeImport // Add this function to the returned object
  };
};
