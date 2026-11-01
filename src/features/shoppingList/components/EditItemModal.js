// src/features/shoppingList/components/EditItemModal.js
import React, { useState, useEffect } from 'react';
import { AISLES } from '../../../utils/ingredientCategories';
import { editableAmountText } from '../listModel';
import styles from './EditItemModal.module.css';

/**
 * Edit one shopping list item.
 * onSave(itemId, { name, amountText, aisleId, notes })
 *   amountText is free text: "2 cups", "1 1/2 lb + 200 g", "3", "to taste" or blank.
 */
const EditItemModal = ({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete
}) => {
  const [formData, setFormData] = useState({ name: '', amountText: '', aisleId: 'household', notes: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        amountText: editableAmountText(item),
        aisleId: item.aisleId || (item.aisle && item.aisle.aisleId) || 'household',
        notes: item.notes || ''
      });
      setShowDeleteConfirm(false);
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Item name is required');
      return;
    }
    onSave(item.id, formData);
    onClose();
  };

  const handleDelete = () => {
    onDelete(item.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  const sourceCount = Array.isArray(item.sources) ? item.sources.length : 0;

  return (
    <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
      <div
        className={styles['modal-content']}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-item-title"
      >
        <div className={styles['modal-header']}>
          <h3 id="edit-item-title">Edit Item</h3>
          <button className={styles['modal-close']} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles['modal-body']}>
          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="edit-item-name">Item Name</label>
            <input
              id="edit-item-name"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={styles['form-input']}
              placeholder="Enter item name..."
            />
          </div>

          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="edit-item-amount">Amount</label>
            <input
              id="edit-item-amount"
              type="text"
              inputMode="text"
              value={formData.amountText}
              onChange={(e) => handleInputChange('amountText', e.target.value)}
              className={styles['form-input']}
              placeholder="e.g. 2 cups, 1 1/2 lb, 3"
              aria-describedby="edit-item-amount-hint"
            />
            <span id="edit-item-amount-hint" className={styles['form-hint']}>
              {sourceCount > 0
                ? 'Changing the amount replaces the recipe total with your own.'
                : 'Leave blank if the amount does not matter.'}
            </span>
          </div>

          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="edit-item-aisle">Aisle</label>
            <select
              id="edit-item-aisle"
              value={formData.aisleId}
              onChange={(e) => handleInputChange('aisleId', e.target.value)}
              className={styles['form-select']}
            >
              {AISLES.map(aisle => (
                <option key={aisle.id} value={aisle.id}>{aisle.name}</option>
              ))}
            </select>
          </div>

          <div className={styles['form-group']}>
            <label className={styles['form-label']} htmlFor="edit-item-notes">Notes</label>
            <textarea
              id="edit-item-notes"
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className={styles['form-textarea']}
              placeholder="Add any notes..."
              rows="3"
            />
          </div>
        </div>

        <div className={styles['modal-actions']}>
          <div className={styles['delete-section']}>
            {showDeleteConfirm ? (
              <div className={styles['delete-confirm']}>
                <span className={styles['delete-text']}>Delete this item?</span>
                <button className={styles['delete-confirm-button']} onClick={handleDelete}>Yes, Delete</button>
                <button className={styles['delete-cancel-button']} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              </div>
            ) : (
              <button className={styles['delete-button']} onClick={() => setShowDeleteConfirm(true)}>Delete Item</button>
            )}
          </div>

          <div className={styles['save-cancel-section']}>
            <button className={styles['cancel-button']} onClick={onClose}>Cancel</button>
            <button className={styles['save-button']} onClick={handleSave}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditItemModal;
