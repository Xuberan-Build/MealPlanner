import React, { useState } from 'react';
import { logWeight } from '../../../services/healthJourneyService';
import styles from './WeightLogModal.module.css';

/**
 * WeightLogModal Component
 *
 * Modal for logging weight entries
 */
const WeightLogModal = ({ isOpen, onClose, onSuccess, userId }) => {
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!weight || weight <= 0) {
      setError('Please enter a valid weight');
      return;
    }

    try {
      setIsSubmitting(true);

      await logWeight(userId, parseFloat(weight), new Date(date), notes);

      // Clear form
      setWeight('');
      setDate(new Date().toISOString().split('T')[0]);
      setNotes('');

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error logging weight:', err);
      setError('Failed to log weight. Please try again.');
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
          <h2>Log Weight</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="weight" className={styles.label}>
              Weight (lbs) <span className={styles.required}>*</span>
            </label>
            <input
              type="number"
              id="weight"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="Enter weight"
              step="0.1"
              min="0"
              max="1000"
              className={styles.input}
              required
              disabled={isSubmitting}
            />
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

          <div className={styles.formGroup}>
            <label htmlFor="notes" className={styles.label}>
              Notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling? Any observations?"
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
              {isSubmitting ? 'Logging...' : 'Log Weight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WeightLogModal;
