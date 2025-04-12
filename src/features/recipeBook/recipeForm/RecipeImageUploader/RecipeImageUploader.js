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

  return (
    <div className={styles.container}>
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
        <label htmlFor="recipe-images"
              className={styles.uploadButton}
              onClick={(e) => {
                e.stopPropagation();
              }}>
          {isProcessing ? 'Processing...' : 'Add Recipe Images'}
        </label>
      </div>

      {/* Error Message */}
      {error && (
        <div className={styles.error}>
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
            {isProcessing ? 'Processing...' : 'Extract Recipe'}
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