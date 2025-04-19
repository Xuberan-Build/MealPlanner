// In PhotoUploadField.js
import React from 'react';
import ImageUploadButton from '../../../../../components/ImageUploadButton';
import styles from './PhotoUploadField.module.css';

// Make sure it's a named function to help with debugging
function PhotoUploadField({ recipeTitle = '', imageUrl, onUploadSuccess, onUploadError }) {
  const safeRecipeId = recipeTitle ? recipeTitle.toLowerCase().replace(/\s+/g, '-') : 'temp-recipe';

  return (
    <div className={styles.formField}>
      <label className={styles.label}>Recipe Photo</label>
      <ImageUploadButton
        recipeId={safeRecipeId}
        onUploadSuccess={onUploadSuccess}
        onUploadError={onUploadError}
      />
      {imageUrl && (
        <div className={styles.imagePreview}>
          <img
            src={imageUrl}
            alt="Recipe preview"
            className={styles.previewImage}
          />
        </div>
      )}
    </div>
  );
}

// Make sure we're using a default export
export default PhotoUploadField;