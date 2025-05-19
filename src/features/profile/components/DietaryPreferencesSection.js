import React, { useState } from 'react';
import styles from '../ProfilePage.module.css';

/**
 * DietaryPreferencesSection Component
 * 
 * Displays and manages a user's dietary preferences, restrictions, and nutrition goals.
 * 
 * @param {Object} dietaryData - The user's current dietary preferences
 * @param {Function} onUpdate - Function to call when preferences are updated
 */
const DietaryPreferencesSection = ({ dietaryData = {}, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    restrictions: dietaryData.restrictions || [],
    cuisinePreferences: dietaryData.cuisinePreferences || [],
    calorieGoal: dietaryData.calorieGoal || 2000,
    macros: {
      protein: dietaryData.macros?.protein ?? 30,
      carbs: dietaryData.macros?.carbs ?? 40,
      fat: dietaryData.macros?.fat ?? 30,
    },
  });

  const dietaryRestrictions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 
    'Dairy-Free', 'Nut-Free', 'Shellfish-Free',
    'Low-Carb', 'Keto', 'Paleo'
  ];

  const cuisineOptions = [
    'Mediterranean', 'Asian', 'Mexican', 
    'Italian', 'Middle Eastern', 'American', 
    'Indian', 'French', 'Thai'
  ];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const updated = [...prev.restrictions];
      if (checked) {
        updated.push(name);
      } else {
        const index = updated.indexOf(name);
        if (index > -1) updated.splice(index, 1);
      }
      return {
        ...prev,
        restrictions: updated
      };
    });
  };

  const handleCuisineChange = (e) => {
    const { name, checked } = e.target;
    setFormData(prev => {
      const updated = [...prev.cuisinePreferences];
      if (checked) {
        updated.push(name);
      } else {
        const index = updated.indexOf(name);
        if (index > -1) updated.splice(index, 1);
      }
      return {
        ...prev,
        cuisinePreferences: updated
      };
    });
  };

  const handleSave = () => {
    onUpdate(formData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setFormData({
      restrictions: dietaryData.restrictions || [],
      cuisinePreferences: dietaryData.cuisinePreferences || [],
      calorieGoal: dietaryData.calorieGoal || 2000,
      macros: {
        protein: dietaryData.macros?.protein ?? 30,
        carbs: dietaryData.macros?.carbs ?? 40,
        fat: dietaryData.macros?.fat ?? 30,
      },
    });
    setIsEditing(false);
  };

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2>Dietary Preferences</h2>
        {!isEditing ? (
          <button 
            className={styles.editButton}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
        ) : (
          <div className={styles.editActions}>
            <button 
              className={styles.cancelButton}
              onClick={handleCancel}
            >
              Cancel
            </button>
            <button 
              className={styles.saveButton}
              onClick={handleSave}
            >
              Save
            </button>
          </div>
        )}
      </div>

      <div className={styles.sectionContent}>
        {!isEditing ? (
          <>
            <div className={styles.preferencesGroup}>
              <h3>Dietary Restrictions</h3>
              <div className={styles.tagContainer}>
                {Array.isArray(dietaryData.restrictions) && dietaryData.restrictions.length > 0 ? (
                  dietaryData.restrictions.map(restriction => (
                    <span key={restriction} className={styles.tag}>
                      {restriction}
                    </span>
                  ))
                ) : (
                  <p>No dietary restrictions set</p>
                )}
              </div>
            </div>

            <div className={styles.preferencesGroup}>
              <h3>Preferred Cuisines</h3>
              <div className={styles.tagContainer}>
                {Array.isArray(dietaryData.cuisinePreferences) && dietaryData.cuisinePreferences.length > 0 ? (
                  dietaryData.cuisinePreferences.map(cuisine => (
                    <span key={cuisine} className={styles.tag}>
                      {cuisine}
                    </span>
                  ))
                ) : (
                  <p>No cuisine preferences set</p>
                )}
              </div>
            </div>

            <div className={styles.preferencesGroup}>
              <h3>Nutrition Goals</h3>
              <p>Daily Calories: {dietaryData?.calorieGoal ?? 'Not set'} kcal</p>
              <div className={styles.macrosContainer}>
                <div className={styles.macroItem}>
                  <span>Protein</span>
                  <span>{dietaryData?.macros?.protein ?? 0}%</span>
                </div>
                <div className={styles.macroItem}>
                  <span>Carbs</span>
                  <span>{dietaryData?.macros?.carbs ?? 0}%</span>
                </div>
                <div className={styles.macroItem}>
                  <span>Fat</span>
                  <span>{dietaryData?.macros?.fat ?? 0}%</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className={styles.formGroup}>
              <h3>Dietary Restrictions</h3>
              <div className={styles.checkboxGrid}>
                {dietaryRestrictions.map(restriction => (
                  <label key={restriction} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name={restriction}
                      checked={formData.restrictions.includes(restriction)}
                      onChange={handleCheckboxChange}
                    />
                    {restriction}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <h3>Preferred Cuisines</h3>
              <div className={styles.checkboxGrid}>
                {cuisineOptions.map(cuisine => (
                  <label key={cuisine} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name={cuisine}
                      checked={formData.cuisinePreferences.includes(cuisine)}
                      onChange={handleCuisineChange}
                    />
                    {cuisine}
                  </label>
                ))}
              </div>
            </div>

            <div className={styles.formGroup}>
              <h3>Nutrition Goals</h3>
              <label className={styles.inputLabel}>
                Daily Calories (kcal)
                <input
                  type="number"
                  name="calorieGoal"
                  value={formData.calorieGoal}
                  onChange={handleInputChange}
                  min="1000"
                  max="5000"
                />
              </label>

              <h4>Macronutrient Ratio (%)</h4>
              <div className={styles.macroInputs}>
                <label className={styles.inputLabel}>
                  Protein
                  <input
                    type="number"
                    name="protein"
                    value={formData.macros.protein}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      macros: { ...prev.macros, protein: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="100"
                  />
                </label>

                <label className={styles.inputLabel}>
                  Carbs
                  <input
                    type="number"
                    name="carbs"
                    value={formData.macros.carbs}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      macros: { ...prev.macros, carbs: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="100"
                  />
                </label>

                <label className={styles.inputLabel}>
                  Fat
                  <input
                    type="number"
                    name="fat"
                    value={formData.macros.fat}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      macros: { ...prev.macros, fat: parseInt(e.target.value) || 0 }
                    }))}
                    min="0"
                    max="100"
                  />
                </label>
              </div>

              {(formData.macros.protein + formData.macros.carbs + formData.macros.fat !== 100) && (
                <p className={styles.warning}>
                  Note: Macronutrient percentages should total 100%.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
};

export default DietaryPreferencesSection;
