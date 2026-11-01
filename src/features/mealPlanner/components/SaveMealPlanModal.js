// src/features/mealPlanner/components/SaveMealPlanModal.js

import React, { useState, useEffect } from 'react';
import styles from './SaveMealPlanModal.module.css';

// Always creates a NEW saved plan. Updating an existing plan happens in place from
// the planner ("Update ..."), so this dialog can never overwrite a plan by accident.
const SaveMealPlanModal = ({
  isOpen,
  onClose,
  onSaveMealPlan,
  suggestedName = ''
}) => {
  const [planName, setPlanName] = useState('');
  const isCopy = Boolean(suggestedName);

  useEffect(() => {
    if (!isOpen) return;
    const today = new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    setPlanName(suggestedName || `Meal Plan - ${today}`);
  }, [isOpen, suggestedName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const name = planName.trim();
    if (!name) return;
    onSaveMealPlan(name);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          {isCopy ? 'Save a Copy' : 'Save New Meal Plan'}
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
              {isCopy ? 'Save Copy' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SaveMealPlanModal;
