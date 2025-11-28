import React, { useState } from 'react';
import { uploadProgressPhoto } from '../../../services/healthJourneyService';
import styles from './PhotoUploadModal.module.css';

/**
 * PhotoUploadModal Component
 *
 * Modal for uploading progress photos
 */
const PhotoUploadModal = ({ isOpen, onClose, onSuccess, userId, currentWeight }) => {
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [formData, setFormData] = useState({
    type: 'front',
    weight: currentWeight || '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    visibility: 'private'
  });
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image must be smaller than 10MB');
        return;
      }

      setPhotoFile(file);
      setError(null);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!photoFile) {
      setError('Please select a photo to upload');
      return;
    }

    if (formData.weight && formData.weight <= 0) {
      setError('Weight must be a positive number');
      return;
    }

    try {
      setIsUploading(true);

      await uploadProgressPhoto(
        userId,
        photoFile,
        formData.type,
        formData.weight ? parseFloat(formData.weight) : null,
        formData.notes,
        formData.date,
        formData.visibility
      );

      // Reset form
      setPhotoFile(null);
      setPhotoPreview(null);
      setFormData({
        type: 'front',
        weight: currentWeight || '',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        visibility: 'private'
      });

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error uploading photo:', err);
      setError('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    if (!isUploading) {
      setError(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const photoTypes = [
    { value: 'front', label: 'Front View', emoji: '👤' },
    { value: 'side', label: 'Side View', emoji: '🧍' },
    { value: 'back', label: 'Back View', emoji: '🔙' }
  ];

  const privacyOptions = [
    { value: 'private', label: 'Private', description: 'Only you can see this photo', emoji: '🔒' },
    { value: 'coach', label: 'Coach Only', description: 'You and your coach can see this', emoji: '👤' },
    { value: 'public', label: 'Public', description: 'Anyone can see this photo', emoji: '🌐' }
  ];

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Upload Progress Photo</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isUploading}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.uploadSection}>
            {!photoPreview ? (
              <label className={styles.uploadArea}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  disabled={isUploading}
                />
                <div className={styles.uploadIcon}>📸</div>
                <div className={styles.uploadText}>
                  <strong>Click to upload</strong> or drag and drop
                </div>
                <div className={styles.uploadHint}>
                  PNG, JPG or JPEG (max. 10MB)
                </div>
              </label>
            ) : (
              <div className={styles.previewSection}>
                <img src={photoPreview} alt="Preview" className={styles.preview} />
                <button
                  type="button"
                  className={styles.changePhotoButton}
                  onClick={() => {
                    setPhotoFile(null);
                    setPhotoPreview(null);
                  }}
                  disabled={isUploading}
                >
                  Change Photo
                </button>
              </div>
            )}
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Photo Type <span className={styles.required}>*</span>
            </label>
            <div className={styles.typeButtons}>
              {photoTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  className={formData.type === type.value ? styles.typeButtonActive : styles.typeButton}
                  onClick={() => handleInputChange('type', type.value)}
                  disabled={isUploading}
                >
                  <span className={styles.typeEmoji}>{type.emoji}</span>
                  <span>{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label htmlFor="date" className={styles.label}>
                Date <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                id="date"
                value={formData.date}
                onChange={(e) => handleInputChange('date', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className={styles.input}
                required
                disabled={isUploading}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="weight" className={styles.label}>
                Weight (lbs)
              </label>
              <input
                type="number"
                id="weight"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                placeholder="e.g., 180"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isUploading}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>
              Privacy Setting <span className={styles.required}>*</span>
            </label>
            <div className={styles.privacyOptions}>
              {privacyOptions.map(option => (
                <label
                  key={option.value}
                  className={formData.visibility === option.value ? styles.privacyOptionActive : styles.privacyOption}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={option.value}
                    checked={formData.visibility === option.value}
                    onChange={(e) => handleInputChange('visibility', e.target.value)}
                    className={styles.radioInput}
                    disabled={isUploading}
                  />
                  <div className={styles.privacyContent}>
                    <div className={styles.privacyHeader}>
                      <span className={styles.privacyEmoji}>{option.emoji}</span>
                      <span className={styles.privacyLabel}>{option.label}</span>
                    </div>
                    <div className={styles.privacyDescription}>{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="How are you feeling? Any observations?"
              rows="3"
              className={styles.textarea}
              disabled={isUploading}
            />
          </div>

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isUploading || !photoFile}
            >
              {isUploading ? 'Uploading...' : 'Upload Photo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PhotoUploadModal;
