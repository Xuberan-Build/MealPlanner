import React, { useEffect, useState } from 'react';
import styles from './BasicInfoFields.module.css';

const defaultMealTypes = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const BasicInfoFields = ({ formData, handleChange }) => {
  const [mealTypes, setMealTypes] = useState(defaultMealTypes);

  useEffect(() => {
    if (formData.mealType && !mealTypes.includes(formData.mealType)) {
      setMealTypes(prev => [...prev, formData.mealType]);
    }
  }, [formData.mealType]);

  return (
    <>
      <div className={styles.formField}>
        <label className={styles.label}>Recipe Name</label>
        <input
          type="text"
          value={formData.title}
          onChange={(e) => handleChange('title', e.target.value)}
          required
          className={styles.input}
          placeholder="Enter recipe name"
        />
      </div>
        
        <div className={styles.formField}>
          <label className={styles.label}>Cook Time</label>
          <input
            type="text"
            value={formData.cookTime}
            onChange={(e) => handleChange('cookTime', e.target.value)}
            placeholder="e.g., 25min"
            className={styles.input}
          />
        </div>

        <div className={styles.formField}>
          <label className={styles.label}>Servings</label>
          <input
            type="number"
            value={formData.servings}
            onChange={(e) => handleChange('servings', e.target.value)}
            placeholder="e.g. 6"
            className={styles.input}
          />
        </div>

      <div className={styles.formField}>
        <select
          value={formData.mealType}
          onChange={(e) => handleChange('mealType', e.target.value)}
          required
          className={styles.select}
        >
          <option value="">Select meal type</option>
          {mealTypes.map((type, i) => (
            <option key={i} value={type}>
              {type}
            </option>
          ))}
        </select>
        {/* <label className={styles.label}>Meal Type</label> */}
      </div>
    </>
  );
};

export default BasicInfoFields;
