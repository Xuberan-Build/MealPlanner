import React, { useState, useEffect } from 'react';
import { logFoodJournalEntry, updateFoodJournalEntry } from '../../../services/healthJourneyService';
import styles from './FoodJournalEntryModal.module.css';

/**
 * FoodJournalEntryModal Component
 *
 * Modal for creating or editing food journal entries
 */
const FoodJournalEntryModal = ({
  isOpen,
  onClose,
  onSuccess,
  userId,
  editEntry = null,
  mealPlanData = null // Optional: { mealPlanId, mealId, mealName }
}) => {
  const [mealName, setMealName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [energyBefore, setEnergyBefore] = useState(3);
  const [energyAfter, setEnergyAfter] = useState(3);
  const [physicalFeelings, setPhysicalFeelings] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Populate form when editing or when meal plan data is provided
  useEffect(() => {
    if (editEntry) {
      setMealName(editEntry.mealName || '');
      setDate(new Date(editEntry.date).toISOString().split('T')[0]);
      setEnergyBefore(editEntry.energyBefore || 3);
      setEnergyAfter(editEntry.energyAfter || 3);
      setPhysicalFeelings(editEntry.physicalFeelings || []);
      setReactions(editEntry.reactions || []);
      setNotes(editEntry.notes || '');
    } else if (mealPlanData) {
      // Pre-populate with meal plan data
      setMealName(mealPlanData.mealName || '');
      setDate(new Date().toISOString().split('T')[0]);
      setEnergyBefore(3);
      setEnergyAfter(3);
      setPhysicalFeelings([]);
      setReactions([]);
      setNotes('');
    } else {
      // Reset form when creating new
      setMealName('');
      setDate(new Date().toISOString().split('T')[0]);
      setEnergyBefore(3);
      setEnergyAfter(3);
      setPhysicalFeelings([]);
      setReactions([]);
      setNotes('');
    }
  }, [editEntry, mealPlanData, isOpen]);

  const feelingOptions = [
    'Satisfied',
    'Energized',
    'Light',
    'Comfortable',
    'Bloated',
    'Heavy',
    'Sluggish',
    'Hungry',
    'Full',
    'Nauseous'
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setWarnings([]);

    try {
      setIsSubmitting(true);

      const entryData = {
        mealName: mealName.trim(),
        date: new Date(date).toISOString(),
        energyBefore: parseInt(energyBefore),
        energyAfter: parseInt(energyAfter),
        physicalFeelings,
        reactions,
        notes: notes.trim(),
        // Include meal plan data if provided
        ...(mealPlanData && {
          mealPlanId: mealPlanData.mealPlanId,
          mealId: mealPlanData.mealId
        })
      };

      if (editEntry) {
        // Update existing entry
        await updateFoodJournalEntry(userId, editEntry.id, entryData);
      } else {
        // Create new entry with duplicate checking
        const result = await logFoodJournalEntry(userId, entryData, {
          checkDuplicates: true,
          allowWarnings: true
        });

        // Show warnings if any
        if (result.warnings && result.warnings.length > 0) {
          setWarnings(result.warnings);

          // If it's a duplicate warning, ask user if they want to proceed
          const hasDuplicate = result.warnings.some(w => w.type === 'POTENTIAL_DUPLICATE');
          if (hasDuplicate) {
            // Don't close modal, show warning and let user decide
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }

      // Close modal
      onClose();
    } catch (err) {
      console.error('Error saving food journal entry:', err);

      // Handle different error types
      if (err.name === 'ValidationError') {
        setError(err.message);
      } else if (err.message && err.message.includes('Entry limit reached')) {
        setError('You have reached the maximum number of journal entries. Please contact support for help archiving old entries.');
      } else if (err.message && err.message.includes('duplicate')) {
        setError('A similar entry was recently logged. Are you sure you want to add this entry?');
      } else {
        setError('Failed to save entry. Please try again.');
      }
    } finally {
      if (!warnings.some(w => w.type === 'POTENTIAL_DUPLICATE')) {
        setIsSubmitting(false);
      }
    }
  };

  const handleDismissWarnings = () => {
    setWarnings([]);
    setIsSubmitting(false);
  };

  const handleProceedDespiteWarnings = async () => {
    try {
      setWarnings([]);
      setIsSubmitting(true);

      const entryData = {
        mealName: mealName.trim(),
        date: new Date(date).toISOString(),
        energyBefore: parseInt(energyBefore),
        energyAfter: parseInt(energyAfter),
        physicalFeelings,
        reactions,
        notes: notes.trim(),
        ...(mealPlanData && {
          mealPlanId: mealPlanData.mealPlanId,
          mealId: mealPlanData.mealId
        })
      };

      // Force create without duplicate checking
      await logFoodJournalEntry(userId, entryData, {
        checkDuplicates: false
      });

      if (onSuccess) {
        onSuccess();
      }

      onClose();
    } catch (err) {
      console.error('Error saving entry:', err);
      setError('Failed to save entry. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFeeling = (feeling) => {
    setPhysicalFeelings(prev =>
      prev.includes(feeling)
        ? prev.filter(f => f !== feeling)
        : [...prev, feeling]
    );
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
          <h2>{editEntry ? 'Edit Journal Entry' : 'Log Food Journal Entry'}</h2>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            disabled={isSubmitting}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {mealPlanData && (
            <div className={styles.mealPlanBadge}>
              Linked to meal plan
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="mealName" className={styles.label}>
              Meal / Food <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              id="mealName"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="What did you eat?"
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

          <div className={styles.energySection}>
            <div className={styles.formGroup}>
              <label htmlFor="energyBefore" className={styles.label}>
                Energy Before (1-5)
              </label>
              <div className={styles.energySlider}>
                <span>Low</span>
                <input
                  type="range"
                  id="energyBefore"
                  min="1"
                  max="5"
                  value={energyBefore}
                  onChange={(e) => setEnergyBefore(e.target.value)}
                  className={styles.slider}
                  disabled={isSubmitting}
                />
                <span>High</span>
                <div className={styles.energyValue}>{energyBefore}</div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="energyAfter" className={styles.label}>
                Energy After (1-5)
              </label>
              <div className={styles.energySlider}>
                <span>Low</span>
                <input
                  type="range"
                  id="energyAfter"
                  min="1"
                  max="5"
                  value={energyAfter}
                  onChange={(e) => setEnergyAfter(e.target.value)}
                  className={styles.slider}
                  disabled={isSubmitting}
                />
                <span>High</span>
                <div className={styles.energyValue}>{energyAfter}</div>
              </div>
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label}>How did you feel?</label>
            <div className={styles.feelingsGrid}>
              {feelingOptions.map((feeling) => (
                <button
                  key={feeling}
                  type="button"
                  className={`${styles.feelingButton} ${
                    physicalFeelings.includes(feeling) ? styles.selected : ''
                  }`}
                  onClick={() => toggleFeeling(feeling)}
                  disabled={isSubmitting}
                >
                  {feeling}
                </button>
              ))}
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
              placeholder="Any additional observations or reactions?"
              rows="3"
              className={styles.textarea}
              disabled={isSubmitting}
            />
          </div>

          {warnings.length > 0 && (
            <div className={styles.warning}>
              {warnings.map((warning, index) => (
                <div key={index} className={styles.warningMessage}>
                  <strong>{warning.type === 'POTENTIAL_DUPLICATE' ? 'Duplicate Detected' : 'Warning'}:</strong>
                  <p>{warning.message}</p>
                </div>
              ))}
              <div className={styles.warningActions}>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={handleDismissWarnings}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.proceedButton}
                  onClick={handleProceedDespiteWarnings}
                >
                  Log Anyway
                </button>
              </div>
            </div>
          )}

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
              {isSubmitting
                ? (editEntry ? 'Saving...' : 'Logging...')
                : (editEntry ? 'Save Changes' : 'Log Entry')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FoodJournalEntryModal;
