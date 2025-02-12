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

    try {
      await addRecipe(formData);
      onSave();
    } catch (error) {
      console.error('Error adding recipe:', error);
      throw error; // Let the component handle the error
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData(initialFormState);
    setImportMode(false);
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
    setFormData
  };
};
