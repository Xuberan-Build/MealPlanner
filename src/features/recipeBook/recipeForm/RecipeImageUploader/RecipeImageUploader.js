import React, { useState } from 'react';
import { processRecipeImages } from '../../../../services/ocrService';
import styles from './RecipeImageUploader.module.css';

const RecipeImageUploader = ({ onRecipeExtracted, onCancel }) => {
  const [images, setImages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  // Handle file selection
  const handleImageUpload = (event) => {
    const files = Array.from(event.target.files);
    
    // Validate file types
    const validFiles = files.filter(file => file.type.startsWith('image/'));
    if (validFiles.length !== files.length) {
      setError('Please upload only image files');
      return;
    }

    setImages(prevImages => [...prevImages, ...validFiles]);
    setError('');
  };

  // Remove a single image
  const removeImage = (index) => {
    setImages(prevImages => prevImages.filter((_, i) => i !== index));
  };

  // Clear all images
  const clearImages = () => {
    setImages([]);
    setError('');
  };

  // Process the images when submit button is clicked
  const handleSubmit = async () => {
    if (images.length === 0) {
      setError('Please add at least one image');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      // Process images using the OCR service
      console.log('Processing images:', images.length);
      const extractedRecipe = await processRecipeImages(images);
      console.log('Recipe extracted successfully:', extractedRecipe);
      
      // Pass the extracted recipe back to the parent component
      if (onRecipeExtracted) {
        onRecipeExtracted(extractedRecipe);
      } else {
        console.warn('onRecipeExtracted prop is not provided');
      }
      
      // Clear the images after successful processing
      clearImages();
    } catch (err) {
      setError('Failed to process images: ' + (err.message || 'Unknown error'));
      console.error('Image processing error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Back button handler
  const handleBack = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className={styles.container}>
      <button
        type="button"
        onClick={handleBack}
        className={styles.cancelButton}
        disabled={isProcessing}
        style={{ alignSelf: 'flex-start', marginBottom: '16px' }}
      >
        Back to Manual Entry
      </button>
      
      <h3 className={styles.title}>Upload Recipe Photos</h3>
      
      {/* File Input */}
      <div className={styles.uploadSection}>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleImageUpload}
          className={styles.fileInput}
          id="recipe-images"
          disabled={isProcessing}
          onClick={(e) => {
            e.stopPropagation();
          }}
        />
        <label 
          htmlFor="recipe-images"
          className={styles.uploadButton}
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          {isProcessing ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }}>
                <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
              </svg>
              Processing...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                <path d="M21 15V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Add Recipe Images
            </>
          )}
        </label>
      </div>

      {/* Error Message */}
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

      {/* Image Previews */}
      {images.length > 0 && (
        <div className={styles.previewSection}>
          <div className={styles.previewHeader}>
            <h4>Uploaded Images ({images.length})</h4>
            <button
              type="button"
              onClick={clearImages}
              className={styles.clearButton}
              disabled={isProcessing}
            >
              Clear All
            </button>
          </div>
          <div className={styles.imageGrid}>
            {images.map((image, index) => (
              <div key={index} className={styles.imageContainer}>
                <img
                  src={URL.createObjectURL(image)}
                  alt={`Recipe page ${index + 1}`}
                  className={styles.previewImage}
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className={styles.removeButton}
                  disabled={isProcessing}
                  aria-label="Remove image"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className={styles.actionButtons}>
        {images.length > 0 && (
          <button
            type="button"
            onClick={handleSubmit}
            className={styles.extractButton}
            disabled={isProcessing || images.length === 0}
          >
            {isProcessing ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px', animation: 'spin 1s linear infinite' }}>
                  <path d="M12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" strokeLinecap="round" />
                </svg>
                Processing...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: '8px' }}>
                  <path d="M9 3H5C3.89543 3 3 3.89543 3 5V9M9 3H15M9 3V9M15 3H19C20.1046 3 21 3.89543 21 5V9M15 3V9M15 9H9M21 9V15M21 9H15M3 9V15M3 9H9M3 15V19C3 20.1046 3.89543 21 5 21H9M3 15H9M9 15V21M9 15H15M9 21H15M9 21V15M15 21H19C20.1046 21 21 20.1046 21 19V15M15 21V15M21 15H15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Extract Recipe
              </>
            )}
          </button>
        )}
        
        <button
          type="button"
          onClick={onCancel}
          className={styles.cancelButton}
          disabled={isProcessing}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default RecipeImageUploader;
