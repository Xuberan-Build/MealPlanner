// SavedShoppingLists.js
import React, { useState } from 'react';
import { deleteShoppingList } from '../../../services/ShoppingListService';
import { ChevronDown, Calendar, Edit2, Trash2, ShoppingBag } from 'lucide-react';
import styles from './SavedShoppingLists.module.css';

const SavedShoppingLists = ({
  savedLists,
  onLoadList,
  onDeleteList,
  onRenameList,
  currentListId
}) => {
  // Closed by default - user opens manually when needed
  const [isOpen, setIsOpen] = useState(false);
  const [deletingListId, setDeletingListId] = useState(null);

  // Handle delete button click - show confirmation first
  const confirmDelete = (e, listId, listName) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the shopping list "${listName}"?`)) {
      handleDelete(listId);
    }
  };

  // Actual delete function after confirmation
  const handleDelete = async (listId) => {
    try {
      setDeletingListId(listId);
      await deleteShoppingList(listId);

      if (onDeleteList) {
        onDeleteList(listId);
      }

      console.log('Shopping list deleted successfully:', listId);
    } catch (error) {
      console.error('Error deleting shopping list:', error);
      alert('Failed to delete shopping list. Please try again.');
    } finally {
      setDeletingListId(null);
    }
  };

  // Get preview of items in list
  const getListPreview = (items) => {
    if (!items || items.length === 0) return 'Empty list';

    const itemCount = items.length;
    const previewItems = items.slice(0, 2).map(item => item.name).join(', ');

    if (itemCount > 2) {
      return `${previewItems}, +${itemCount - 2} more`;
    }
    return previewItems;
  };

  return (
    <div className={`${styles.sidePanel} ${isOpen ? styles.open : ''}`}>
      {/* Tab/Ribbon */}
      <div
        className={styles.tab}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.tabText}>
          Saved Lists {savedLists?.length > 0 && `(${savedLists.length})`}
        </span>
        <ChevronDown className={`${styles.tabIcon} ${isOpen ? styles.rotated : ''}`} />
      </div>

      {/* Panel Content */}
      <div className={styles.panelContent}>
        <h2 className={styles.sectionTitle}>Saved Shopping Lists</h2>

        {savedLists?.length > 0 ? (
          <div className={styles.listsList}>
            {savedLists.map((list) => {
              const isCurrentlyActive = currentListId === list.id;

              return (
                <div key={list.id} className={`${styles.listCard} ${isCurrentlyActive ? styles.active : ''}`}>
                  <div className={styles.listInfo}>
                    <div className={styles.listHeader}>
                      <h3 className={styles.listName}>
                        {list.name}
                        {isCurrentlyActive && <span className={styles.activeBadge}>Active</span>}
                      </h3>
                      <span className={styles.savedDate}>
                        <Calendar size={14} />
                        {new Date(list.updatedAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className={styles.listMeta}>
                      <span className={styles.itemCount}>
                        <ShoppingBag size={14} />
                        {list.items?.length || 0} items
                      </span>
                    </div>
                    <p className={styles.listPreview}>{getListPreview(list.items)}</p>
                  </div>
                  <div className={styles.listActions}>
                    <button
                      className={styles.loadButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadList(list.id);
                      }}
                      disabled={isCurrentlyActive}
                      title="Load this list"
                    >
                      {isCurrentlyActive ? 'Active' : 'Load'}
                    </button>
                    <button
                      className={styles.editButton}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRenameList(list.id, list.name);
                      }}
                      title="Rename this list"
                    >
                      <Edit2 size={16} />
                      Rename
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => confirmDelete(e, list.id, list.name)}
                      disabled={deletingListId === list.id}
                      title="Delete this list"
                    >
                      <Trash2 size={16} />
                      {deletingListId === list.id ? 'Deleting...' : ''}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyState}>No saved shopping lists yet.</p>
        )}
      </div>
    </div>
  );
};

export default SavedShoppingLists;
