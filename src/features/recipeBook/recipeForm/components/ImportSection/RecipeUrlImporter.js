// src/features/recipeBook/recipeForm/components/ImportSection/RecipeUrlImporter.js
import React, { useState } from 'react';
import { extractRecipeFromUrl } from '../../../../../services/urlImportService';
import styles from './RecipeUrlImporter.module.css';

const RecipeUrlImporter = ({ onRecipeExtracted, onCancel, disabled }) => {
  const [url, setUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic URL validation
    if (!url || !url.trim()) {
      setError('Please enter a valid URL');
      return;
    }

    try {
      // Simple URL format validation
      const urlPattern = /^(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/\S*)?$/;
      if (!urlPattern.test(url)) {
        setError('Please enter a valid URL (e.g., https://example.com/recipe)');
        return;
      }

      setIsProcessing(true);
      setError('');

      // Ensure URL has protocol
      const processUrl = url.startsWith('http') ? url : `https://${url}`;
      
      // Extract recipe from URL
      const extractedRecipe = await extractRecipeFromUrl(processUrl);
      
      // Pass the extracted recipe back to the parent component
      if (onRecipeExtracted) {
        onRecipeExtracted(extractedRecipe);
      } else {
        console.warn('onRecipeExtracted prop is not provided');
      }

      // Clear the URL input
      setUrl('');
    } catch (err) {
      console.error('URL import error:', err);

      // Provide user-friendly error messages
      let errorMessage = '';

      if (err.message?.includes('500')) {
        // Site is blocking the request
        errorMessage = "This website is blocking automated imports. This isn't a bug - many recipe sites protect their content. Try copying the recipe text and using 'Paste Recipe' or 'Scan Image' instead.";
      } else if (err.message?.includes('403') || err.message?.includes('401')) {
        errorMessage = "This website requires authentication or is blocking our request. Try copying the recipe text and using 'Paste Recipe' instead.";
      } else if (err.message?.includes('404')) {
        errorMessage = "Recipe not found at this URL. Please check the URL and try again.";
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage = "Network error. Please check your internet connection and try again.";
      } else {
        errorMessage = err.message || "Couldn't import this recipe. Try copying the text and using 'Paste Recipe' or 'Scan Image' instead.";
      }

      setError(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Import Recipe from URL</h3>
      
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.inputGroup}>
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste recipe URL here..."
            className={styles.urlInput}
            disabled={isProcessing || disabled}
          />
          
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isProcessing || disabled || !url.trim()}
          >
            {isProcessing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : "Import Recipe"}
          </button>
        </div>
        
        {error && (
          <div className={styles.error}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
              <path d="M12 8V12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="currentColor" />
            </svg>
            {error}
          </div>
        )}
      </form>
      
      <div className={styles.actionButtons}>
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={isProcessing || disabled}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RecipeUrlImporter;