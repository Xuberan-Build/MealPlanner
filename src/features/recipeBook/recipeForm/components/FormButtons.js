// src/features/recipeBook/recipeForm/components/FormButtons.js
import React from 'react';
import styles from './FormButtons.module.css';

// FormButtons component receives:
// - onCancel: function to handle cancellation
// - isSubmitting: boolean to track form submission state
const FormButtons = ({ onCancel, isSubmitting }) => {
  return (
    <div className={styles.buttonContainer}>
      {/* Cancel button - stays enabled even during submission */}
      <button
        type="button" // type="button" prevents form submission
        onClick={onCancel}
        className={styles.cancelButton}
        disabled={isSubmitting} // Optional: disable during submission
      >
        Cancel
      </button>

      {/* Submit button - changes text and disables during submission */}
      <button
        type="submit" // type="submit" triggers form submission
        className={styles.submitButton}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Saving Recipe...' : 'Save Recipe'}
      </button>
    </div>
  );
};

// Make sure to use default export for consistency with your imports
export default FormButtons;