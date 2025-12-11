import React from 'react';
import { MEAL_TYPES } from '../../../../../constants/mealPlanner';
import styles from './BasicInfoFields.module.css';

const BasicInfoFields = ({ formData, handleChange }) => {
  return (
    <>
      <div className={styles.formField}>
        <label className={styles.label}>Recipe Name</label>
        <input
          type="text"
          value={formData.title || ''}  // Add || '' here
          onChange={(e) => handleChange('title', e.target.value)}
          required
          className={styles.input}
          placeholder="Enter recipe name"
        />``
      </div>

      <div className={styles.formRow}>
        <div className={styles.formField}>
          <label className={styles.label}>Prep Time</label>
          <input
            type="text"
            value={formData.prepTime || ''}  // Add || '' here
            onChange={(e) => handleChange('prepTime', e.target.value)}
            placeholder="e.g. 40min"
            className={styles.input}
          />

        </div>
        
        <div className={styles.formField}>
          <label className={styles.label}>Cook Time</label>
          <input
            type="text"
            value={formData.cookTime || ''}  // Add || '' here
            onChange={(e) => handleChange('cookTime', e.target.value)}
            placeholder="e.g., 25min"
            className={styles.input}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Servings</label>
          <input
            type="number"
            value={formData.servings || ''}  // Add || '' here
            onChange={(e) => handleChange('servings', e.target.value)}
            placeholder="e.g. 6"
            className={styles.input}
          />
        </div>
      </div>

      <div className={styles.formField}>
        <label className={styles.label}>Meal Type</label>
        <select
          value={formData.mealType}
          onChange={(e) => handleChange('mealType', e.target.value)}
          required
          className={styles.select}
        >
          <option value="">Select meal type</option>
          {MEAL_TYPES.map(mealType => (
            <option key={mealType} value={mealType}>{mealType}</option>
          ))}
        </select>
      </div>
    </>
  );
};

export default BasicInfoFields;
