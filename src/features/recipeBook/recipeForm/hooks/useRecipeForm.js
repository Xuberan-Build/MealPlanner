import { useState } from 'react';
import { addRecipe } from '../../../../services/recipeService';

const initialFormState = {
  title: '',
  mealType: '',
  dietType: '',
  prepTime: '',
  servings: '',
  ingredients: [],
  instructions: '',
  imageUrl: '',
  imagePath: ''
};

export const useRecipeForm = ({ onSave }) => {
  const [formData, setFormData] = useState(initialFormState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [importMode, setImportMode] = useState(false);
  const [processing, setProcessing] = useState(false); // For OCR/LLM processing
  const [error, setError] = useState(null); // For errors during processing or submit

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
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
    setIsSubmitting(true);

    setError(null); // Clear previous errors on new submission
    try {
      await addRecipe(formData);
      onSave();
    } catch (error) {
      console.error('Error adding recipe:', error);
      setError(`Failed to save recipe: ${error.message}`);
      // Optional: re-throw if the component needs to react further
      // throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setImportMode(false);
    setError(null); // Clear errors on reset
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
    error, // Expose error state
    setError // Expose setError for component use during import
  };
};
