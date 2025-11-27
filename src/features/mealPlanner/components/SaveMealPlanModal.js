// src/features/mealPlanner/components/SaveMealPlanModal.js

import React, { useState, useEffect } from 'react';
import styles from './SaveMealPlanModal.module.css';

const SaveMealPlanModal = ({
  isOpen,
  onClose,
  mealPlan,
  onSaveMealPlan,
  isEditing = false,
  existingPlanName = ''
}) => {
  const [planName, setPlanName] = useState('');

  // Pre-fill name when editing or generate suggested name for new plans
  useEffect(() => {
    if (isOpen) {
      if (isEditing && existingPlanName) {
        // Pre-fill with existing name when editing
        setPlanName(existingPlanName);
      } else if (!isEditing) {
        // Auto-generate name for new plans
        const today = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        setPlanName(`Meal Plan - ${today}`);
      }
    }
  }, [isOpen, isEditing, existingPlanName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSaveMealPlan(planName);
    setPlanName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          {isEditing ? 'Update Meal Plan' : 'Save New Meal Plan'}
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.planNameInput}
            value={planName}
            onChange={(e) => setPlanName(e.target.value)}
            placeholder="Enter meal plan name"
            required
          />
          <div className={styles.buttonContainer}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={!planName.trim()}
            >
              {isEditing ? 'Update Plan' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SaveMealPlanModal;
