//recipeForm/RecipeForm.js
import React from 'react';
import { useRecipeForm } from './hooks/useRecipeForm';
import { normalizeRecipe } from './utils/recipeNormalizer';
import { processRecipeImages } from '../../../services/ocrService'; // Correct relative path

// Component imports
import BasicInfoFields from './components/FormFields/BasicInfoFields';
import InstructionsField from './components/FormFields/InstructionsField';
import PhotoUploadField from './components/FormFields/PhotoUploadField';
import ImportPrompt from './components/ImportSection/ImportPrompt';
import ImportFeedback from './components/ImportSection/ImportFeedback';
import FormButtons from './components/FormButtons';
import DietTypeDropdown from './DietTypeDropdown/DietTypeDropdown';
import SimpleIngredientSelector from './IngredientSelector/SimpleIngredientSelector';
import RecipeImageUploader from './RecipeImageUploader/RecipeImageUploader';

// Styles
import styles from './styles/RecipeForm.module.css';

const RecipeForm = ({ onSave, onCancel }) => {
  const {
    formData,
    isSubmitting,
    importMode,
    setImportMode,
    handleChange,
    handleImageUploadSuccess,
    handleSubmit,
    setFormData,
    processing,
    setProcessing,
    error, // Get error state from hook
    setError, // Get setError from hook
    handleRecipeImport // Add this to destructuring
  } = useRecipeForm({ onSave });

  // Handle OCR-extracted recipe data
  const handleRecipeExtracted = async (extractedRecipe) => {
    setError(null); // Clear previous errors
    setProcessing(true); // Ensure processing state is set
    try {
      console.log('Received extracted recipe:', extractedRecipe);
      
      // Populate form with processed data
      handleRecipeImport(extractedRecipe); // Use the result from the service
    } catch (err) {
      console.error('Error processing extracted recipe:', err);
      setError(`Failed to process recipe: ${err.message}. Please try again or enter manually.`);
    } finally {
      setProcessing(false);
    }
  };

  // Handle form field changes
  const handleFieldChange = (field, value, metadata) => {
    handleChange(field, value, metadata);
    
    // Clear error when user starts editing
    if (error) {
      setError(null);
    }
  };

  // Handle image upload success
  const handlePhotoUploadSuccess = ({ url, path }) => {
    handleImageUploadSuccess({ url, path });
  };

  // Handle form submission
  const handleFormSubmit = async (e) => { 
    console.log("Form submit triggered with data:", formData); 
    setError(null);
    
    // Validate required fields
    const requiredFields = ['title', 'ingredients', 'instructions'];
    const missingFields = requiredFields.filter(field => !formData[field]);
    
    if (missingFields.length > 0) {
      setError(`Please fill in all required fields: ${missingFields.join(", ")}`);
      return;
    }

    try {
      await handleSubmit(e); // handleSubmit now sets error internally on failure
      // Success is handled by the onSave callback navigating away
    } catch (err) {
      // This catch might be redundant if handleSubmit sets the error, but keep for safety
      console.error("Error during submission:", err);
      setError(`Failed to save recipe: ${err.message || "Please try again."}`);
    }
  };

  return (
    <div className={styles.container}>
      {/* Display error from useRecipeForm hook */}
      <ImportFeedback feedback={error ? { status: 'error', message: error } : {}} />

      {importMode ? (
        <div className={styles.importSection}>
          <button
            type="button"
            onClick={() => setImportMode(false)}
            className={styles.backButton}
            disabled={processing}
          >
            Back to Manual Entry
          </button>
          
          <div className={styles.importOptions}>
            <RecipeImageUploader
              onRecipeExtracted={handleRecipeExtracted}
              onCancel={() => setImportMode(false)}
              disabled={processing} // Disable uploader while processing
            />
            {processing && <p className={styles.processingText}>Processing recipe with AI...</p>}
          </div>
        </div>
      ) : (
        <ImportPrompt 
          onImportClick={() => setImportMode(true)}
          disabled={processing || isSubmitting}
        />
      )}

      <form onSubmit={handleFormSubmit} className={styles.recipeForm}>
        <h2 className={styles.formTitle}>
          {formData.id ? 'Edit Recipe' : 'Add New Recipe'}
        </h2>

        <BasicInfoFields
          formData={formData}
          handleChange={handleFieldChange}
          disabled={processing}
        />

        <div className={styles.formField}>
          <label className={styles.label}>
            Diet Type
            <span className={styles.optional}> (optional)</span>
          </label>
          <DietTypeDropdown
            dietType={formData.dietType}
            setDietType={(value) => handleFieldChange('dietType', value)}
            disabled={processing}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>
            Ingredients
            <span className={styles.required}>*</span>
          </label>
          <SimpleIngredientSelector
            selectedIngredients={formData.ingredients}
            setSelectedIngredients={(value) => handleFieldChange('ingredients', value)}
            disabled={processing}
          />
        </div>

        <InstructionsField
          value={formData} // Pass the entire formData object to access both instructions and instructionsRichText
          onChange={handleFieldChange}
          disabled={processing}
        />

        <PhotoUploadField
          recipeTitle={formData.title}
          imageUrl={formData.imageUrl}
          onUploadSuccess={handlePhotoUploadSuccess}
          onUploadError={(err) => setError(`Photo upload failed: ${err}`)}
          disabled={processing}
        />

        <FormButtons
          onCancel={onCancel}
          isSubmitting={isSubmitting}
          disabled={processing}
        />
      </form>
    </div>
  );
};

export default RecipeForm;
