// src/features/shoppingList/components/SaveShoppingListModal.js

import React, { useState, useEffect } from 'react';
import styles from './SaveShoppingListModal.module.css';

const SaveShoppingListModal = ({
  isOpen,
  onClose,
  onSave,
  existingName = '',
  isRenaming = false
}) => {
  const [listName, setListName] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (existingName) {
        setListName(existingName);
      } else {
        // Auto-generate name for new lists
        const today = new Date().toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        setListName(`Shopping List - ${today}`);
      }
    }
  }, [isOpen, existingName]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (listName.trim()) {
      onSave(listName.trim());
      setListName('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <h2 className={styles.modalTitle}>
          {isRenaming ? 'Rename Shopping List' : 'Save Shopping List'}
        </h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className={styles.listNameInput}
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="Enter list name"
            autoFocus
            required
          />
          <div className={styles.buttonContainer}>
            <button
              type="button"
              className={styles.closeButton}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.saveButton}
              disabled={!listName.trim()}
            >
              {isRenaming ? 'Rename' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SaveShoppingListModal;
