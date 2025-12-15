// src/features/recipeBook/recipeForm/RecipeForm.js
import React, { useState } from 'react';
import { useRecipeForm } from './hooks/useRecipeForm';
import { normalizeRecipe } from './utils/recipeNormalizer';
import { processRecipeImages } from '../../../services/ocrService';
import RecipeUrlImporter from './components/ImportSection/RecipeUrlImporter';
import RecipeTextPaster from './components/ImportSection/RecipeTextPaster';

// Component imports
import BasicInfoFields from './components/FormFields/BasicInfoFields';
import InstructionsField from './components/FormFields/InstructionsField';
import PhotoUploadField from './components/FormFields/PhotoUploadField';
import ImportPrompt from './components/ImportSection/ImportPrompt';
import ImportFeedback from './components/ImportSection/ImportFeedback';
import FormButtons from './components/FormButtons';
import SimpleIngredientSelector from './IngredientSelector/SimpleIngredientSelector';
import RecipeImageUploader from './RecipeImageUploader/RecipeImageUploader';

// New Diet Type Components
import { DietTypeSelector, DietTypeRecommendations } from '../../../components/dietTypes';
import { useDietTypeRecommendations } from '../../../hooks/useDietTypes';

// Styles
import styles from './styles/RecipeForm.module.css';

const RecipeForm = ({ recipe, onSave, onCancel }) => {
  // State for import tab selection: 'image', 'url', or 'text'
  const [importTab, setImportTab] = useState('image');

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
  } = useRecipeForm({ onSave, initialRecipe: recipe });

  // Get AI-based diet type recommendations
  const {
    recommendations,
    clearRecommendations
  } = useDietTypeRecommendations(
    formData.ingredients || [],
    formData.dietTypes || []
  );

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
    const requiredFields = ['title', 'ingredients'];
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
            <div className={styles.importTabs}>
              <button
                className={`${styles.importTab} ${importTab === 'image' ? styles.active : ''}`}
                onClick={() => setImportTab('image')}
                disabled={processing}
              >
                Scan Image
              </button>
              <button
                className={`${styles.importTab} ${importTab === 'url' ? styles.active : ''}`}
                onClick={() => setImportTab('url')}
                disabled={processing}
              >
                Import URL
              </button>
              <button
                className={`${styles.importTab} ${importTab === 'text' ? styles.active : ''}`}
                onClick={() => setImportTab('text')}
                disabled={processing}
              >
                Paste Recipe
              </button>
            </div>

            {importTab === 'url' ? (
              <RecipeUrlImporter
                onRecipeExtracted={handleRecipeExtracted}
                onCancel={() => setImportMode(false)}
                disabled={processing}
              />
            ) : importTab === 'text' ? (
              <RecipeTextPaster
                onRecipeExtracted={handleRecipeExtracted}
                onCancel={() => setImportMode(false)}
                disabled={processing}
              />
            ) : (
              <RecipeImageUploader
                onRecipeExtracted={handleRecipeExtracted}
                onCancel={() => setImportMode(false)}
                disabled={processing}
              />
            )}

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
            Diet Types
            <span className={styles.optional}> (optional)</span>
          </label>
          <DietTypeSelector
            selectedDietTypes={formData.dietTypes || []}
            onChange={(dietTypes) => handleFieldChange('dietTypes', dietTypes)}
            placeholder="Select diet types for this recipe..."
            showFavorites={true}
            disabled={processing}
          />
        </div>

        {/* AI-Based Diet Type Recommendations */}
        {recommendations && recommendations.length > 0 && (
          <DietTypeRecommendations
            recommendations={recommendations}
            onApply={(dietType) => {
              const currentDietTypes = formData.dietTypes || [];
              if (!currentDietTypes.includes(dietType)) {
                handleFieldChange('dietTypes', [...currentDietTypes, dietType]);
              }
            }}
            onDismiss={(index) => {
              // Remove specific recommendation
              const newRecs = recommendations.filter((_, i) => i !== index);
              clearRecommendations();
            }}
            onDismissAll={clearRecommendations}
          />
        )}

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