// src/features/mealPlanner/components/SaveMealPlanModal.js


import React, { useState } from 'react';
import styles from './SaveMealPlanModal.module.css';
const SaveMealPlanModal = ({ isOpen, onClose, mealPlan, onSaveMealPlan }) => {
  const [planName, setPlanName] = useState('');
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
        <h2 className={styles.modalTitle}>Save Meal Plan</h2>
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
              Save Plan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default SaveMealPlanModal;
