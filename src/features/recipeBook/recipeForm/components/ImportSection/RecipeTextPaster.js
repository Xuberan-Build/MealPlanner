// src/features/recipeBook/recipeForm/components/ImportSection/RecipeTextPaster.js
import React, { useState } from 'react';
import { processRecipeText } from '../../../../../services/textImportService';
import styles from './RecipeTextPaster.module.css';

const RecipeTextPaster = ({ onRecipeExtracted, onCancel, disabled }) => {
  const [recipeText, setRecipeText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!recipeText || !recipeText.trim()) {
      setError('Please paste some recipe text');
      return;
    }

    // Check if text is too short
    if (recipeText.trim().length < 50) {
      setError('Please paste more text. Recipe should include ingredients and instructions.');
      return;
    }

    try {
      setIsProcessing(true);
      setError('');

      // Process the pasted text using AI
      const extractedRecipe = await processRecipeText(recipeText);

      // Pass the extracted recipe back to the parent component
      if (onRecipeExtracted) {
        onRecipeExtracted(extractedRecipe);
      }

      // Clear the text input
      setRecipeText('');
    } catch (err) {
      console.error('Text import error:', err);
      setError(err.message || 'Failed to process recipe text. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePaste = (e) => {
    // Auto-detect paste and show helpful message
    const pastedText = e.clipboardData.getData('text');
    if (pastedText) {
      setError(''); // Clear any errors when pasting
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Paste Recipe Text</h3>
      <p className={styles.subtitle}>
        Copy and paste the recipe from any website, including ingredients and instructions
      </p>

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.textareaGroup}>
          <textarea
            value={recipeText}
            onChange={(e) => setRecipeText(e.target.value)}
            onPaste={handlePaste}
            placeholder="Paste your recipe here...&#10;&#10;Example:&#10;Chocolate Chip Cookies&#10;&#10;Ingredients:&#10;- 2 cups flour&#10;- 1 cup butter&#10;- 1 cup sugar&#10;&#10;Instructions:&#10;1. Mix ingredients...&#10;2. Bake at 350°F..."
            className={styles.textarea}
            disabled={isProcessing || disabled}
            rows={15}
          />

          <div className={styles.charCount}>
            {recipeText.length} characters
          </div>
        </div>

        {error && (
          <div className={styles.error}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            {error}
          </div>
        )}

        <div className={styles.actionButtons}>
          <button
            type="button"
            onClick={onCancel}
            className={styles.cancelButton}
            disabled={isProcessing || disabled}
          >
            Cancel
          </button>

          <button
            type="submit"
            className={styles.submitButton}
            disabled={isProcessing || disabled || !recipeText.trim()}
          >
            {isProcessing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : "Extract Recipe"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecipeTextPaster;
