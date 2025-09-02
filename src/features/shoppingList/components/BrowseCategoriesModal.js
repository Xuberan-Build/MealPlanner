// src/features/shoppingList/components/BrowseCategoriesModal.js
import React from 'react';
import styles from './BrowseCategoriesModal.module.css';

const BrowseCategoriesModal = ({
  isOpen,
  onClose,
  selectedCategory,
  selectedSubcategory,
  onCategorySelect,
  onSubcategorySelect,
  onItemAdd,
  categories
}) => {
  
  if (!isOpen) return null;

  // Handle clicking outside modal to close
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Render specific items when subcategory is selected
  if (selectedSubcategory) {
    return (
      <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
        <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
          <div className={styles['modal-header']}>
            <button 
              className={styles['modal-back']}
              onClick={() => onSubcategorySelect(null)}
            >
              ← Back
            </button>
            <h3>{selectedSubcategory.name}</h3>
            <button 
              className={styles['modal-close']}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
          
          <div className={styles['modal-items-grid']}>
            {selectedSubcategory.items.map((item, index) => (
              <button
                key={index}
                className={styles['modal-item-button']}
                onClick={() => onItemAdd(item, selectedCategory.name)}
              >
                <span className={styles['item-name']}>{item}</span>
                <span className={styles['add-icon']}>+</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Render all categories and subcategories (main browse view)
  return (
    <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
      <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
        <div className={styles['modal-header']}>
          <h3>Browse Categories</h3>
          <button 
            className={styles['modal-close']}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        
        <div className={styles['modal-categories']}>
          {categories.map((category, categoryIndex) => (
            <div key={categoryIndex} className={styles['modal-category-card']}>
              <h4>{category.name}</h4>
              <div className={styles['modal-category-items']}>
                {category.subcategories.map((subcategory, subIndex) => (
                  <button
                    key={subIndex}
                    className={styles['modal-subcategory-button']}
                    onClick={() => {
                      onCategorySelect(category);
                      onSubcategorySelect(subcategory);
                    }}
                  >
                    {subcategory.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BrowseCategoriesModal;