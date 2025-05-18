// src/features/recipeBook/recipeForm/components/FormButtons.js
import React from 'react';
import styles from './FormButtons.module.css';

const FormButtons = ({ onCancel, isSubmitting, disabled = false }) => {
  return (
    <div className={styles.buttonContainer}>
      {/* Cancel button */}
      <button
        type="button"
        onClick={onCancel}
        className={styles.cancelButton}
        disabled={isSubmitting || disabled}
      >
        Cancel
      </button>

      {/* Submit button */}
      <button
        type="submit"
        className={styles.submitButton}
        disabled={isSubmitting || disabled}
      >
        {isSubmitting ? (
          <>
            <span>Saving Recipe</span>
            {/* Loading indicator is handled via CSS */}
          </>
        ) : (
          <>
            <span>Save Recipe</span>
          </>
        )}
      </button>
    </div>
  );
};

export default FormButtons;
