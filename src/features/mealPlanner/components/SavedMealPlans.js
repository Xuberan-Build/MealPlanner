// SavedMealPlans.js
import React, { useState } from 'react';
import { deleteMealPlanFromFirestore } from '../../../services/mealPlanService';
import styles from './SavedMealPlans.module.css';

const SavedMealPlans = ({ savedMealPlans, onLoadMealPlan, onDeleteMealPlan }) => {
    const [isOpen, setIsOpen] = useState(false);

    const handleDelete = async (planId) => {
      try {
        await deleteMealPlanFromFirestore(planId);
        onDeleteMealPlan(planId);
      } catch (error) {
        console.error('Error deleting meal plan:', error);
      }
    };

    return (
      <div className={`${styles.sidePanel} ${isOpen ? styles.open : ''}`}>
        {/* Tab/Ribbon */}
        <div
          className={styles.tab}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={styles.tabText}>Saved Plans</span>
        </div>

        {/* Panel Content */}
        <div className={styles.panelContent}>
          <h2 className={styles.sectionTitle}>Saved Meal Plans</h2>
          {savedMealPlans?.length > 0 ? (
            <div className={styles.plansList}>
              {savedMealPlans.map((plan) => (
                <div key={plan.id} className={styles.planCard}>
                  <div className={styles.planInfo}>
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <span className={styles.savedDate}>
                      {new Date(plan.savedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={styles.planActions}>
                    <button
                      className={styles.loadButton}
                      onClick={() => onLoadMealPlan(plan.plan)}
                    >
                      Load
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => handleDelete(plan.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={styles.emptyState}>No saved meal plans yet.</p>
          )}
        </div>
      </div>
    );
};

export default SavedMealPlans;
