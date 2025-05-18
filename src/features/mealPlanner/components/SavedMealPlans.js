// SavedMealPlans.js
import React, { useState } from 'react';
import { deleteMealPlanFromFirestore } from '../../../services/mealPlanService';
import styles from './SavedMealPlans.module.css';

const SavedMealPlans = ({ savedMealPlans, onLoadMealPlan, onDeleteMealPlan }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [deletingPlanId, setDeletingPlanId] = useState(null);
    
    // Handle delete button click - show confirmation first
    const confirmDelete = (planId, planName) => {
      if (window.confirm(`Are you sure you want to delete the meal plan "${planName}"?`)) {
        handleDelete(planId);
      }
    };
    
    // Actual delete function after confirmation
    const handleDelete = async (planId) => {
      try {
        setDeletingPlanId(planId); // Set the deleting plan ID to show loading state
        
        // Delete from Firestore
        await deleteMealPlanFromFirestore(planId);
        
        // Update local state by filtering out the deleted plan
        if (onDeleteMealPlan) {
          // If parent provided a callback, use it
          onDeleteMealPlan(planId);
        }
        
        console.log('Meal plan deleted successfully:', planId);
      } catch (error) {
        console.error('Error deleting meal plan:', error);
        alert('Failed to delete meal plan. Please try again.');
      } finally {
        setDeletingPlanId(null); // Clear the deleting state
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
                      onClick={() => confirmDelete(plan.id, plan.name)}
                      disabled={deletingPlanId === plan.id}
                    >
                      {deletingPlanId === plan.id ? 'Deleting...' : 'Delete'}
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
