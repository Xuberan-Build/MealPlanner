import React from 'react';
import { useRecipeForm } from './hooks/useRecipeForm';
import { useImportFeedback } from './hooks/useImportFeedback';
import { normalizeRecipe } from './utils/recipeNormalizer';
import BasicInfoFields from './components/FormFields/BasicInfoFields';
import InstructionsField from './components/FormFields/InstructionsField';
import PhotoUploadField from './components/FormFields/PhotoUploadField';
import ImportPrompt from './components/ImportSection/ImportPrompt';
import ImportFeedback from './components/ImportSection/ImportFeedback';
import FormButtons from './components/FormButtons';
import DietTypeDropdown from './DietTypeDropdown/DietTypeDropdown';
import IngredientSelector from './IngredientSelector/IngredientSelector';
import RecipeImport from '../../../components/RecipeImport';
import styles from './styles/RecipeForm.module.css';;

const RecipeForm = ({ onSave, onCancel }) => {
  const {
    formData,
    isSubmitting,
    importMode,
    setImportMode,
    handleChange,
    handleImageUploadSuccess,
    handleSubmit,
    setFormData
  } = useRecipeForm({ onSave });

  const { feedback, showFeedback } = useImportFeedback();

  const handleRecipeImport = (extractedRecipe) => {
    try {
      const normalizedRecipe = normalizeRecipe(extractedRecipe);
      setFormData(prev => ({
        ...prev,
        ...normalizedRecipe,
      }));
      showFeedback('success', 'Recipe imported successfully! Please review and adjust as needed.');
      setImportMode(false);
    } catch (error) {
      console.error('Error processing imported recipe:', error);
      showFeedback('error', 'Failed to process recipe. Please try again or enter manually.');
    }
  };

  return (
    <div className={styles.container}>
      <ImportFeedback feedback={feedback} />

      {!importMode ? (
        <ImportPrompt onImportClick={() => setImportMode(true)} />
      ) : (
        <div className={styles.importSection}>
          <button
            onClick={() => setImportMode(false)}
            className={styles.backButton}
          >
            Back to Manual Entry
          </button>
          <RecipeImport
            onRecipeExtracted={handleRecipeImport}
            onError={(error) => showFeedback('error', error)}
          />
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.recipeForm}>
        <h2 className={styles.formTitle}>Add New Recipe</h2>

        <BasicInfoFields
          formData={formData}
          handleChange={handleChange}
        />

        <div className={styles.formField}>
          <label className={styles.label}>Diet Type</label>
          <DietTypeDropdown
            dietType={formData.dietType}
            setDietType={(value) => handleChange('dietType', value)}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Ingredients</label>
          <IngredientSelector
            selectedIngredients={formData.ingredients}
            setSelectedIngredients={(value) => handleChange('ingredients', value)}
          />
        </div>

        <InstructionsField
          value={formData.instructions}
          onChange={handleChange}
        />

        <PhotoUploadField
          recipeTitle={formData.title}
          imageUrl={formData.imageUrl}
          onUploadSuccess={handleImageUploadSuccess}
          onUploadError={(error) => showFeedback('error', error)}
        />

        <FormButtons
          onCancel={onCancel}
          isSubmitting={isSubmitting}
        />
      </form>
    </div>
  );
};

export default RecipeForm;
