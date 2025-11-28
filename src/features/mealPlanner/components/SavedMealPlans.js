// SavedMealPlans.js
import React, { useState } from 'react';
import { deleteMealPlanFromFirestore } from '../../../services/mealPlanService';
import { Calendar, Edit2, Trash2, X } from 'lucide-react';
import styles from './SavedMealPlans.module.css';

const SavedMealPlans = ({
  savedMealPlans,
  onLoadMealPlan,
  onDeleteMealPlan,
  onEditMealPlan,
  currentEditingPlan,
  isOpen,
  onToggle
}) => {
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
        setDeletingPlanId(planId);
        await deleteMealPlanFromFirestore(planId);

        if (onDeleteMealPlan) {
          onDeleteMealPlan(planId);
        }

        console.log('Meal plan deleted successfully:', planId);
      } catch (error) {
        console.error('Error deleting meal plan:', error);
        alert('Failed to delete meal plan. Please try again.');
      } finally {
        setDeletingPlanId(null);
      }
    };

    // Get preview of meals in plan
    const getMealPreview = (plan) => {
      const days = Object.keys(plan || {});
      if (days.length === 0) return 'Empty plan';

      const meals = [];
      for (let i = 0; i < Math.min(2, days.length); i++) {
        const dayMeals = plan[days[i]];
        const mealTypes = Object.keys(dayMeals || {});
        if (mealTypes.length > 0) {
          const meal = dayMeals[mealTypes[0]];
          const title = meal?.recipe?.title || meal?.title || 'Meal';
          meals.push(`${days[i]}: ${title}`);
        }
      }

      return meals.length > 0 ? meals.join(' • ') : 'No meals added';
    };
    
    return (
      <>
        {/* Close overlay - only visible on mobile when panel is open */}
        {isOpen && <div className={styles.overlay} onClick={onToggle} />}

        <div className={`${styles.sidePanel} ${isOpen ? styles.open : ''}`}>
          {/* Panel Content */}
          <div className={styles.panelContent}>
            <div className={styles.panelHeader}>
              <h2 className={styles.sectionTitle}>Saved Meal Plans</h2>
              <button
                className={styles.closeButton}
                onClick={onToggle}
                aria-label="Close saved plans"
              >
                <X size={24} />
              </button>
            </div>
          
          {savedMealPlans?.length > 0 ? (
            <div className={styles.plansList}>
              {savedMealPlans.map((plan) => {
                const isCurrentlyEditing = currentEditingPlan?.id === plan.id;
                
                return (
                  <div key={plan.id} className={`${styles.planCard} ${isCurrentlyEditing ? styles.editing : ''}`}>
                    <div className={styles.planInfo}>
                      <div className={styles.planHeader}>
                        <h3 className={styles.planName}>
                          {plan.name}
                          {isCurrentlyEditing && <span className={styles.editingBadge}>Editing</span>}
                        </h3>
                        <span className={styles.savedDate}>
                          <Calendar size={14} />
                          {new Date(plan.savedAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className={styles.planPreview}>{getMealPreview(plan.plan)}</p>
                    </div>
                    <div className={styles.planActions}>
                      <button
                        className={styles.loadButton}
                        onClick={() => onLoadMealPlan(plan.plan)}
                        disabled={isCurrentlyEditing}
                        title="Load this plan"
                      >
                        Load
                      </button>
                      <button
                        className={styles.editButton}
                        onClick={() => onEditMealPlan(plan)}
                        disabled={isCurrentlyEditing}
                        title="Edit this plan"
                      >
                        <Edit2 size={16} />
                        {isCurrentlyEditing ? 'Editing' : 'Edit'}
                      </button>
                      <button
                        className={styles.deleteButton}
                        onClick={() => confirmDelete(plan.id, plan.name)}
                        disabled={deletingPlanId === plan.id || isCurrentlyEditing}
                        title="Delete this plan"
                      >
                        <Trash2 size={16} />
                        {deletingPlanId === plan.id ? 'Deleting...' : ''}
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
      </>
    );
};

export default SavedMealPlans;