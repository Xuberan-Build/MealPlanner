//RecipeImport.js
import React, { useState, useRef } from 'react';
import styles from './RecipeImport.module.css';
import { processRecipeImage } from '../services/ocrService';
import ImageUploadButton from './ImageUploadButton';

const RecipeImport = ({ onRecipeExtracted, onPhotoUploaded, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };

  const handleFileProcess = async (file) => {
    setSelectedFile(file);
    
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.');
      onError?.('Please upload an image file.');
      return;
    }
  
    setIsProcessing(true);
    setError('');
  
    try {
      // Validate file size
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Image file is too large. Please use an image under 10MB.');
      }
  
      const recipe = await processRecipeImage(file);
      onRecipeExtracted?.(recipe);
    } catch (error) {
      console.error('OCR error:', error);
      setError(error.message || 'Failed to extract recipe. Please try again.');
      onError?.(error.message || 'Failed to extract recipe. Please try manual entry.');
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className={styles.container}>
      {/* Screenshot Upload Section */}
      <div
        className={`${styles.uploadBox} ${dragActive ? styles.dragActive : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className={styles.uploadContent}>
          <div className={styles.iconWrapper}>
            <svg className={styles.icon} stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M8 14v20c0 4.418 7.163 8 16 8s16-3.582 16-8V14M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m-32 0v-14" />
            </svg>
          </div>
          <h3 className={styles.title}>Import Recipe from Screenshot</h3>

          <div className={styles.uploadActions}>
            <button
              onClick={() => fileInputRef.current?.click()}
              className={styles.uploadButton}
              disabled={isProcessing}
            >
              {selectedFile ? selectedFile.name : 'Choose Screenshot'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className={styles.fileInput}
              accept="image/*"
              onChange={handleFileSelect}
            />
            <p className={styles.dragText}>
              or drag and drop a recipe screenshot
            </p>
          </div>

          <p className={styles.helperText}>
            Upload a screenshot to extract recipe details automatically
          </p>

          {error && (
            <p className={styles.error}>{error}</p>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className={styles.divider}>
        <span>or</span>
      </div>

      {/* Recipe Photo Upload Section */}
      <div className={styles.uploadBox}>
        <div className={styles.uploadContent}>
          <div className={styles.iconWrapper}>
            <svg className={styles.icon} stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12m32-12h-4m-4 0l-8-8m0 0l-8 8m8-8v20" />
            </svg>
          </div>
          <h3 className={styles.title}>Add Recipe Photo</h3>
          <div className={styles.uploadActions}>
            <ImageUploadButton
              className={styles.photoButton}
              onUploadSuccess={onPhotoUploaded}
              onUploadError={onError}
            />
            <p className={styles.helperText}>
              Add a photo of your finished dish
            </p>
          </div>
        </div>
      </div>

      {/* Processing Overlay */}
      {isProcessing && (
        <div className={styles.overlay}>
          <div className={styles.spinner} />
          <p className={styles.processingText}>Processing recipe...</p>
        </div>
      )}
    </div>
  );
};

export default RecipeImport;
