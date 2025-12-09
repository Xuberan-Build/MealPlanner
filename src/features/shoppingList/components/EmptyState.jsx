import React, { useState } from 'react';
import { ShoppingCart, FileText, Plus, ChefHat, Edit2, Trash2 } from 'lucide-react';
import styles from './EmptyState.module.css';
import { SHOPPING_CATEGORIES } from '../constants/categories';

const EmptyState = ({
  onCreateNew,
  onLoadTemplate,
  onGenerateFromMealPlan,
  onAddRecipe,
  onViewSaved,
  savedLists = [],
  onLoadList,
  onDeleteList,
  onRenameList,
  onBrowseCategories,
  savedListsCount = 0,
  hasTemplates = false
}) => {
  const hasSavedLists = savedLists.length > 0;
  const [selectedListId, setSelectedListId] = useState('');
  const [showActions, setShowActions] = useState(null);

  // Sort saved lists by most recent
  const sortedLists = [...savedLists].sort((a, b) =>
    new Date(b.updatedAt) - new Date(a.updatedAt)
  );

  const handleLoadList = (listId) => {
    if (listId && onLoadList) {
      onLoadList(listId);
    }
  };

  const handleDeleteList = (e, listId) => {
    e.stopPropagation();
    if (onDeleteList) {
      onDeleteList(listId);
      setSelectedListId('');
    }
  };

  const handleRenameList = (e, listId) => {
    e.stopPropagation();
    if (onRenameList) {
      const list = savedLists.find(l => l.id === listId);
      onRenameList(listId, list?.name);
    }
  };

  return (
    <div className={styles.emptyState}>
      <h2 className={styles.mainTitle}>Your Shopping Lists</h2>

      {/* Load Saved List Dropdown - Always Visible */}
      <div className={styles.loadListSection}>
        <div className={styles.dropdownWrapper}>
          <select
            className={styles.loadListDropdown}
            value={selectedListId}
            onChange={(e) => {
              setSelectedListId(e.target.value);
              handleLoadList(e.target.value);
            }}
          >
            <option value="">
              {hasSavedLists ? 'Select a saved list...' : 'No saved lists yet'}
            </option>
            {sortedLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.items?.length || 0} items)
              </option>
            ))}
          </select>
          {selectedListId && (
            <div className={styles.listActions}>
              <button
                className={styles.actionButton}
                onClick={(e) => handleRenameList(e, selectedListId)}
                title="Rename list"
              >
                <Edit2 size={16} />
              </button>
              <button
                className={styles.actionButton}
                onClick={(e) => handleDeleteList(e, selectedListId)}
                title="Delete list"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Create New List Button */}
      <button
        className={`${styles.primaryButton} ${styles.createButton}`}
        onClick={() => onCreateNew()}
      >
        <Plus size={20} />
        <span>Create New List</span>
      </button>

      {/* Quick Actions */}
      <div className={styles.quickActionsRow}>
        <button
          className={styles.quickActionButton}
          onClick={() => onGenerateFromMealPlan()}
        >
          <FileText size={18} />
          <span>Generate from Meal Plan</span>
        </button>
        {onAddRecipe && (
          <button
            className={styles.quickActionButton}
            onClick={() => onAddRecipe()}
          >
            <ChefHat size={18} />
            <span>Add Recipe</span>
          </button>
        )}
      </div>

      {/* Quick Add Categories */}
      <div className={styles.categoriesSection}>
        <h3 className={styles.categoriesTitle}>Quick Add Categories</h3>
        <div className={styles.categoriesGrid}>
          {SHOPPING_CATEGORIES.map((category) => (
            <div key={category.name} className={styles.categoryCard}>
              <h4 className={styles.categoryName}>{category.name}</h4>
              <div className={styles.subcategoryButtons}>
                {category.subcategories.map((sub) => (
                  <button
                    key={sub.name}
                    className={styles.subcategoryButton}
                    onClick={() => {
                      if (onBrowseCategories) {
                        onBrowseCategories(category, sub);
                      }
                    }}
                  >
                    {sub.name}
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

export default EmptyState;
