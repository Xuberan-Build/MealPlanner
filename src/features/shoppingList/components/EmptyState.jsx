import React from 'react';
import { ShoppingCart, FileText, Clock, Users } from 'lucide-react';
import styles from './EmptyState.module.css';

const EmptyState = ({
  onCreateNew,
  onLoadTemplate,
  onGenerateFromMealPlan,
  onViewSaved,
  savedListsCount = 0,
  hasTemplates = false
}) => {
  return (
    <div className={styles.emptyState}>
      <div className={styles.iconContainer}>
        <ShoppingCart size={64} className={styles.icon} />
      </div>

      <h2 className={styles.title}>No Active Shopping List</h2>
      <p className={styles.subtitle}>
        Create a new list or load an existing one to get started
      </p>

      {/* Primary Action */}
      <button
        className={styles.primaryButton}
        onClick={onCreateNew}
      >
        <span className={styles.buttonIcon}>+</span>
        New Shopping List
      </button>

      {/* Quick Actions */}
      <div className={styles.quickActions}>
        <h3 className={styles.quickActionsTitle}>Quick Actions:</h3>

        <button
          className={styles.quickActionButton}
          onClick={onLoadTemplate}
          disabled={!hasTemplates}
        >
          <Clock size={20} />
          <span>Load "Weekly Staples" template</span>
        </button>

        <button
          className={styles.quickActionButton}
          onClick={onGenerateFromMealPlan}
        >
          <FileText size={20} />
          <span>Generate from Meal Plan</span>
        </button>

        {savedListsCount > 0 && (
          <button
            className={styles.quickActionButton}
            onClick={onViewSaved}
          >
            <Users size={20} />
            <span>View Saved Lists ({savedListsCount})</span>
          </button>
        )}
      </div>

      {/* Settings Link */}
      <button className={styles.settingsLink}>
        ⚙ Preferences
      </button>
    </div>
  );
};

export default EmptyState;
