// SavedMealPlans.js
import React, { useState } from 'react';
import { deleteMealPlanFromFirestore } from '../../../services/mealPlanService';
import styles from './SavedMealPlans.module.css';

const SavedMealPlans = ({ 
  savedMealPlans, 
  onLoadMealPlan, 
  onDeleteMealPlan,
  onEditMealPlan, // New prop for edit functionality
  currentEditingPlan // New prop to show which plan is being edited
}) => {
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
              {savedMealPlans.map((plan) => {
                const isCurrentlyEditing = currentEditingPlan?.id === plan.id;
                
                return (
                  <div key={plan.id} className={`${styles.planCard} ${isCurrentlyEditing ? styles.editing : ''}`}>
                    <div className={styles.planInfo}>
                      <h3 className={styles.planName}>
                        {plan.name}
                        {isCurrentlyEditing && <span className={styles.editingBadge}>Editing</span>}
                      </h3>
                      <span className={styles.savedDate}>
                        {new Date(plan.savedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.planActions}>
                      <button
                        className={styles.loadButton}
                        onClick={() => onLoadMealPlan(plan.plan)}
                        disabled={isCurrentlyEditing}
                      >
                        Load
                      </button>
                      <button
                        className={styles.editButton}
                        onClick={() => onEditMealPlan(plan)}
                        disabled={isCurrentlyEditing}
                      >
                        {isCurrentlyEditing ? 'Editing' : 'Edit'}
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => confirmDelete(plan.id, plan.name)}
                        disabled={deletingPlanId === plan.id || isCurrentlyEditing}
                      >
                        {deletingPlanId === plan.id ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.emptyState}>No saved meal plans yet.</p>
          )}
        </div>
      </div>
    );
};

export default SavedMealPlans;