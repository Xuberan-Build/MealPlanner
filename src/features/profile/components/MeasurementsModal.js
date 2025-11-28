import React, { useState } from 'react';
import { logMeasurements } from '../../../services/healthJourneyService';
import styles from './MeasurementsModal.module.css';

/**
 * MeasurementsModal Component
 *
 * Modal for logging body measurements
 */
const MeasurementsModal = ({ isOpen, onClose, onSuccess, userId }) => {
  const [measurements, setMeasurements] = useState({
    chest: '',
    waist: '',
    hips: '',
    leftArm: '',
    rightArm: '',
    leftThigh: '',
    rightThigh: '',
    neck: '',
    shoulders: '',
    calves: ''
  });
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const measurementFields = [
    { key: 'chest', label: 'Chest', placeholder: 'e.g., 38' },
    { key: 'waist', label: 'Waist', placeholder: 'e.g., 32' },
    { key: 'hips', label: 'Hips', placeholder: 'e.g., 40' },
    { key: 'leftArm', label: 'Left Arm', placeholder: 'e.g., 13' },
    { key: 'rightArm', label: 'Right Arm', placeholder: 'e.g., 13' },
    { key: 'leftThigh', label: 'Left Thigh', placeholder: 'e.g., 22' },
    { key: 'rightThigh', label: 'Right Thigh', placeholder: 'e.g., 22' },
    { key: 'neck', label: 'Neck', placeholder: 'e.g., 15' },
    { key: 'shoulders', label: 'Shoulders', placeholder: 'e.g., 45' },
    { key: 'calves', label: 'Calves', placeholder: 'e.g., 14' }
  ];

  const handleMeasurementChange = (key, value) => {
    setMeasurements(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Check if at least one measurement is provided
    const hasAnyMeasurement = Object.values(measurements).some(value => value !== '' && value !== null);

    if (!hasAnyMeasurement) {
      setError('Please enter at least one measurement');
      return;
    }

    // Validate measurements are positive numbers
    for (const [key, value] of Object.entries(measurements)) {
      if (value !== '' && value !== null && (isNaN(value) || parseFloat(value) <= 0)) {
        setError(`${key} must be a positive number`);
        return;
      }
    }

    try {
      setIsSubmitting(true);

      // Filter out empty measurements and convert to numbers
      const cleanedMeasurements = {};
      for (const [key, value] of Object.entries(measurements)) {
        if (value !== '' && value !== null) {
          cleanedMeasurements[key] = parseFloat(value);
        }
      }

      await logMeasurements(userId, cleanedMeasurements, date, notes);

      // Reset form
      setMeasurements({
        chest: '',
        waist: '',
        hips: '',
        leftArm: '',
        rightArm: '',
        leftThigh: '',
        rightThigh: '',
        neck: '',
        shoulders: '',
        calves: ''
      });
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error logging measurements:', err);
      setError('Failed to log measurements. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setError(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Log Measurements</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.instructions}>
            <p>Enter your body measurements in inches. Fill in as many or as few as you'd like.</p>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="date" className={styles.label}>
              Date <span className={styles.required}>*</span>
            </label>
            <input
              type="date"
              id="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className={styles.input}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className={styles.sectionTitle}>Upper Body</div>
          <div className={styles.measurementsRow}>
            <div className={styles.formGroup}>
              <label htmlFor="chest" className={styles.label}>
                Chest (in)
              </label>
              <input
                type="number"
                id="chest"
                value={measurements.chest}
                onChange={(e) => handleMeasurementChange('chest', e.target.value)}
                placeholder="38.5"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="shoulders" className={styles.label}>
                Shoulders (in)
              </label>
              <input
                type="number"
                id="shoulders"
                value={measurements.shoulders}
                onChange={(e) => handleMeasurementChange('shoulders', e.target.value)}
                placeholder="45.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="neck" className={styles.label}>
                Neck (in)
              </label>
              <input
                type="number"
                id="neck"
                value={measurements.neck}
                onChange={(e) => handleMeasurementChange('neck', e.target.value)}
                placeholder="15.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className={styles.sectionTitle}>Core</div>
          <div className={styles.measurementsRow}>
            <div className={styles.formGroup}>
              <label htmlFor="waist" className={styles.label}>
                Waist (in)
              </label>
              <input
                type="number"
                id="waist"
                value={measurements.waist}
                onChange={(e) => handleMeasurementChange('waist', e.target.value)}
                placeholder="32.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="hips" className={styles.label}>
                Hips (in)
              </label>
              <input
                type="number"
                id="hips"
                value={measurements.hips}
                onChange={(e) => handleMeasurementChange('hips', e.target.value)}
                placeholder="40.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className={styles.sectionTitle}>Arms</div>
          <div className={styles.measurementsRow}>
            <div className={styles.formGroup}>
              <label htmlFor="leftArm" className={styles.label}>
                Left Arm (in)
              </label>
              <input
                type="number"
                id="leftArm"
                value={measurements.leftArm}
                onChange={(e) => handleMeasurementChange('leftArm', e.target.value)}
                placeholder="13.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="rightArm" className={styles.label}>
                Right Arm (in)
              </label>
              <input
                type="number"
                id="rightArm"
                value={measurements.rightArm}
                onChange={(e) => handleMeasurementChange('rightArm', e.target.value)}
                placeholder="13.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className={styles.sectionTitle}>Legs</div>
          <div className={styles.measurementsRow}>
            <div className={styles.formGroup}>
              <label htmlFor="leftThigh" className={styles.label}>
                Left Thigh (in)
              </label>
              <input
                type="number"
                id="leftThigh"
                value={measurements.leftThigh}
                onChange={(e) => handleMeasurementChange('leftThigh', e.target.value)}
                placeholder="22.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="rightThigh" className={styles.label}>
                Right Thigh (in)
              </label>
              <input
                type="number"
                id="rightThigh"
                value={measurements.rightThigh}
                onChange={(e) => handleMeasurementChange('rightThigh', e.target.value)}
                placeholder="22.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="calves" className={styles.label}>
                Calves (in)
              </label>
              <input
                type="number"
                id="calves"
                value={measurements.calves}
                onChange={(e) => handleMeasurementChange('calves', e.target.value)}
                placeholder="14.0"
                step="0.1"
                min="0"
                className={styles.input}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any observations or context for these measurements..."
              rows="3"
              className={styles.textarea}
              disabled={isSubmitting}
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
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Logging...' : 'Log Measurements'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MeasurementsModal;
