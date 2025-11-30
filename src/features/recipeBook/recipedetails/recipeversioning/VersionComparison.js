import React, { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import styles from './VersionComparison.module.css';

const VersionComparison = ({ originalRecipe, versionRecipe }) => {
  const differences = useMemo(() => {
    const diffs = {
      ingredients: {
        added: [],
        removed: [],
        modified: []
      },
      instructions: false
    };

    if (!originalRecipe || !versionRecipe) return diffs;

    // Compare ingredients
    const originalIngredients = originalRecipe.ingredients || [];
    const versionIngredients = versionRecipe.ingredients || [];

    // Create maps for easier comparison
    const originalMap = new Map();
    originalIngredients.forEach(ing => {
      const key = ing.ingredientId || ing;
      originalMap.set(key, ing);
    });

    const versionMap = new Map();
    versionIngredients.forEach(ing => {
      const key = ing.ingredientId || ing;
      versionMap.set(key, ing);
    });

    // Find added ingredients
    versionIngredients.forEach(ing => {
      const key = ing.ingredientId || ing;
      if (!originalMap.has(key)) {
        diffs.ingredients.added.push(ing);
      } else {
        // Check if amount or unit changed
        const original = originalMap.get(key);
        if (
          original.amount !== ing.amount ||
          original.unit !== ing.unit
        ) {
          diffs.ingredients.modified.push({
            ingredient: ing,
            original: original
          });
        }
      }
    });

    // Find removed ingredients
    originalIngredients.forEach(ing => {
      const key = ing.ingredientId || ing;
      if (!versionMap.has(key)) {
        diffs.ingredients.removed.push(ing);
      }
    });

    // Compare instructions
    const originalInstructions = (originalRecipe.instructions || '').trim();
    const versionInstructions = (versionRecipe.instructions || '').trim();
    diffs.instructions = originalInstructions !== versionInstructions;

    return diffs;
  }, [originalRecipe, versionRecipe]);

  const formatIngredient = (ing) => {
    if (typeof ing === 'object' && ing !== null) {
      const name = ing.ingredientId ? ing.ingredientId.replace(/-/g, ' ') : 'Unknown';
      return `${ing.amount} ${ing.unit} of ${name}`;
    }
    return ing;
  };

  const hasChanges =
    differences.ingredients.added.length > 0 ||
    differences.ingredients.removed.length > 0 ||
    differences.ingredients.modified.length > 0 ||
    differences.instructions;

  if (!hasChanges) {
    return (
      <div className={styles.noChanges}>
        <AlertCircle size={20} />
        <p>No differences detected</p>
      </div>
    );
  }

  return (
    <div className={styles.comparisonContainer}>
      <h3 className={styles.title}>Changes from Main Recipe</h3>

      {differences.ingredients.added.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.added}>+</span> Added Ingredients
          </h4>
          <ul className={styles.list}>
            {differences.ingredients.added.map((ing, idx) => (
              <li key={idx} className={styles.addedItem}>
                {formatIngredient(ing)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {differences.ingredients.removed.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.removed}>-</span> Removed Ingredients
          </h4>
          <ul className={styles.list}>
            {differences.ingredients.removed.map((ing, idx) => (
              <li key={idx} className={styles.removedItem}>
                {formatIngredient(ing)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {differences.ingredients.modified.length > 0 && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.modified}>~</span> Modified Ingredients
          </h4>
          <ul className={styles.list}>
            {differences.ingredients.modified.map(({ ingredient, original }, idx) => (
              <li key={idx} className={styles.modifiedItem}>
                <div className={styles.modifiedRow}>
                  <span className={styles.originalValue}>
                    {formatIngredient(original)}
                  </span>
                  <span className={styles.arrow}>→</span>
                  <span className={styles.newValue}>
                    {formatIngredient(ingredient)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {differences.instructions && (
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <span className={styles.modified}>~</span> Instructions Modified
          </h4>
          <p className={styles.note}>
            The cooking instructions have been customized for this version.
          </p>
        </div>
      )}
    </div>
  );
};

export default VersionComparison;
