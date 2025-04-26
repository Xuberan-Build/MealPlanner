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
    console.log("📌 START: handleSubmit called with formData:", formData);
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
      
      console.log("📌 Validation passed, calling addRecipe service");
      const recipeId = await addRecipe(formData);
      console.log("📌 SUCCESS: Recipe saved with ID:", recipeId);
      
      if (onSave) {
        console.log("📌 Calling onSave callback");
        onSave(recipeId);
      } else {
        console.warn("📌 WARNING: No onSave callback provided");
      }
    } catch (error) {
      console.error('📌 ERROR in handleSubmit:', error);
      setError(`Failed to save recipe: ${error.message}`);
      // Optional: re-throw if the component needs to react further
      // throw error;
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
