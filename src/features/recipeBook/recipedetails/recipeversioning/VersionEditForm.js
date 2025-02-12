import React, { useState, useEffect } from 'react';
import { Plus, Minus } from 'lucide-react';
import styles from './VersioningPanel.module.css';

const VersionEditForm = ({
  isOpen,
  onClose,
  currentVersion,
  recipe,
  onSave,
  initialData // Add this prop for handling duplicates
}) => {
  const [formData, setFormData] = useState({
    meal_version_name: '',
    ingredients: [],
    instructions: '',
    makeDefault: false
  });

  // Initialize form data when opening
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // If we have initial data (e.g., when duplicating), use it
        setFormData({
          meal_version_name: initialData.meal_version_name || '',
          ingredients: initialData.ingredients || [],
          instructions: initialData.instructions || '',
          makeDefault: false // Always start as non-default
        });
      } else {
        // For a new version, start with the recipe's current data
        setFormData({
          meal_version_name: `${recipe.title} variation`,
          ingredients: recipe.ingredients || [],
          instructions: recipe.instructions || '',
          makeDefault: false
        });
      }
    }
  }, [isOpen, initialData, recipe]);

  const handleIngredientChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing
      )
    }));
  };

  const addIngredient = () => {
    setFormData(prev => ({
      ...prev,
      ingredients: [...prev.ingredients, { amount: '', unit: '', ingredientId: '' }]
    }));
  };

  const removeIngredient = (index) => {
    setFormData(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.meal_version_name.trim()) {
      alert('Version name is required.');
      return;
    }

    // If user is setting this as default, show confirmation
    if (formData.makeDefault) {
      const confirmed = window.confirm(
        'Making this the default version will update the main recipe with these ingredients and instructions. Continue?'
      );
      if (!confirmed) {
        return;
      }
    }

    // Prepare and sanitize variation data
    const variationData = {
      meal_version_name: formData.meal_version_name.trim(),
      ingredients: formData.ingredients.map(ing => ({
        amount: typeof ing.amount === 'string' ? ing.amount.trim() : '',
        unit: typeof ing.unit === 'string' ? ing.unit.trim() : '',
        ingredientId: typeof ing.ingredientId === 'string' ? ing.ingredientId.trim() : ''
      })),
      instructions: typeof formData.instructions === 'string' ? formData.instructions.trim() : '',
      makeDefault: formData.makeDefault
    };

    onSave(variationData);

    // Reset form
    setFormData({
      meal_version_name: '',
      ingredients: [],
      instructions: '',
      makeDefault: false
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onMouseDown={onClose}>
      <div
        className={styles.modalContent}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Version Name Field */}
          <div className={styles.formGroup}>
            <label htmlFor="version-name" className={styles.label}>
              Version Name
            </label>
            <input
              id="version-name"
              name="version-name"
              type="text"
              value={formData.meal_version_name}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                meal_version_name: e.target.value
              }))}
              placeholder="Enter version name..."
              required
              className={styles.input}
            />
          </div>

          {/* Ingredients Section */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Ingredients</label>
            <div className={styles.ingredientsList}>
              {formData.ingredients.map((ingredient, index) => (
                <div key={`ingredient-${index}`} className={styles.ingredientRow}>
                  <input
                    id={`amount-${index}`}
                    name={`amount-${index}`}
                    type="text"
                    value={ingredient.amount || ''}
                    onChange={(e) => handleIngredientChange(index, 'amount', e.target.value)}
                    placeholder="Amount"
                    className={`${styles.input} ${styles.amountInput}`}
                  />
                  <input
                    id={`unit-${index}`}
                    name={`unit-${index}`}
                    type="text"
                    value={ingredient.unit || ''}
                    onChange={(e) => handleIngredientChange(index, 'unit', e.target.value)}
                    placeholder="Unit"
                    className={`${styles.input} ${styles.unitInput}`}
                  />
                  <input
                    id={`ingredient-${index}`}
                    name={`ingredient-${index}`}
                    type="text"
                    value={ingredient.ingredientId || ''}
                    onChange={(e) => handleIngredientChange(index, 'ingredientId', e.target.value)}
                    placeholder="Ingredient"
                    className={`${styles.input} ${styles.ingredientInput}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeIngredient(index)}
                    className={styles.removeButton}
                    aria-label={`Remove ingredient ${index + 1}`}
                  >
                    <Minus size={16} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addIngredient}
                className={styles.addButton}
              >
                <Plus size={16} /> Add Ingredient
              </button>
            </div>
          </div>

          {/* Instructions Field */}
          <div className={styles.formGroup}>
            <label htmlFor="instructions" className={styles.label}>
              Instructions
            </label>
            <textarea
              id="instructions"
              name="instructions"
              value={formData.instructions}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                instructions: e.target.value
              }))}
              placeholder="Enter cooking instructions..."
              className={styles.textarea}
              rows={6}
            />
          </div>

          {/* Make Default Version Section */}
          <div className={styles.formGroup}>
            <div className={styles.checkboxGroup}>
              <label htmlFor="make-default" className={styles.checkboxLabel}>
                <input
                  id="make-default"
                  name="make-default"
                  type="checkbox"
                  checked={formData.makeDefault}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    makeDefault: e.target.checked
                  }))}
                  className={styles.checkbox}
                />
                <div className={styles.checkboxContent}>
                  <span>Set as default version</span>
                  <small className={styles.helpText}>
                    This will update the main recipe to use these ingredients and instructions
                  </small>
                </div>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className={styles.formActions}>
            <button
              type="button"
              onClick={onClose}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
            >
              Save Version
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default VersionEditForm;
