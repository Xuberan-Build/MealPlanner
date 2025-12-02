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
      
      // Prepare data for submission - strip HTML if using plain text in backend
      const submissionData = {
        ...formData,
        // We keep the plain text version for the API
        // The rich text version is kept in the form state for editing
      };
      
      console.log("📌 Validation passed, calling addRecipe service");
      const recipeId = await addRecipe(submissionData);
      console.log("📌 SUCCESS: Recipe saved with ID:", recipeId);

      if (onSave) {
        console.log("📌 Calling onSave callback");
        // Pass the full recipe object with the ID, not just the ID
        const savedRecipe = { ...submissionData, id: recipeId };
        onSave(savedRecipe);
      } else {
        console.warn("📌 WARNING: No onSave callback provided");
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

  // Handle incoming OCR data - ensure compatibility with rich text
  const handleRecipeImport = (extractedRecipe) => {
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
