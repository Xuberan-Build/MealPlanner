import React, { memo } from 'react';
import { Edit, Trash2, Plus } from 'lucide-react';
import { DietTypeBadgeGroup } from '../../../components/dietTypes';
import styles from './RecipeCard.module.css';

const RecipeCard = memo(({
  recipe,
  onView,
  onEdit,
  onDelete,
  onAddToMealPlan
}) => {
  const handleCardClick = (e) => {
    if (e.target.closest('button')) {
      return;
    }
    onView(recipe);
  };

  const handleEdit = (e) => {
    e.stopPropagation();
    onEdit(recipe);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    onDelete(recipe);
  };

  const handleAddToMealPlan = (e) => {
    e.stopPropagation();
    onAddToMealPlan(recipe);
  };

  return (
    <div className={styles.card} onClick={handleCardClick}>
      {recipe.imageUrl && (
        <div className={styles.imageContainer}>
          <img src={recipe.imageUrl} alt={recipe.title} className={styles.image} />
        </div>
      )}
      <div className={styles.content}>
        <div className={styles.header}>
          <h3 className={styles.title}>{recipe.title}</h3>
          <div className={styles.actions}>
            <button
              className={styles.actionButton}
              onClick={handleEdit}
              aria-label={`Edit ${recipe.title}`}
              title="Edit Recipe"
            >
              <Edit size={16} />
            </button>
            <button
              className={`${styles.actionButton} ${styles.addButton}`}
              onClick={handleAddToMealPlan}
              aria-label={`Add ${recipe.title} to meal plan`}
              title="Add to Meal Plan"
            >
              <Plus size={16} />
            </button>
            <button
              className={`${styles.actionButton} ${styles.deleteButton}`}
              onClick={handleDelete}
              aria-label={`Delete ${recipe.title}`}
              title="Delete Recipe"
            >
              <Trash2 size={16} />
            </button>
          </div>
        </div>
        <div className={styles.meta}>
          <p className={styles.metaItem}>
            <span className={styles.metaLabel}>Meal:</span> {recipe.mealType || 'Not Specified'}
          </p>
          <p className={styles.metaItem}>
            <span className={styles.metaLabel}>Prep:</span> {recipe.prepTime || 'Not Specified'}
          </p>
        </div>

        {/* Diet Type Badges */}
        {(recipe.dietTypes && recipe.dietTypes.length > 0) || recipe.dietType ? (
          <div className={styles.dietBadges}>
            <DietTypeBadgeGroup
              dietTypes={recipe.dietTypes || (recipe.dietType ? [recipe.dietType] : [])}
              size="small"
              variant="filled"
              maxDisplay={3}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
});

RecipeCard.displayName = 'RecipeCard';

export default RecipeCard;
