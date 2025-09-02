// src/features/shoppingList/components/EditItemModal.js
import React, { useState, useEffect } from 'react';
import styles from './EditItemModal.module.css';

const EditItemModal = ({
  isOpen,
  onClose,
  item,
  onSave,
  onDelete
}) => {
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    quantity: 1,
    unit: 'items',
    category: 'Other',
    notes: ''
  });
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Common units for dropdown
  const commonUnits = [
    'items', 'lbs', 'oz', 'cups', 'tbsp', 'tsp', 
    'gallons', 'quarts', 'pints', 'liters', 'ml',
    'packages', 'bottles', 'cans', 'bags', 'boxes'
  ];

  // Common categories for dropdown
  const commonCategories = [
    'Snacks & Treats', 'Beverages', 'Household Items', 
    'Personal Care', 'Pet Supplies', 'Produce', 
    'Dairy', 'Meat', 'Bakery', 'Frozen', 'Other'
  ];

  // Initialize form data when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name || '',
        quantity: item.quantity || 1,
        unit: item.unit || 'items',
        category: item.category || 'Other',
        notes: item.notes || ''
      });
    }
  }, [item]);

  if (!isOpen || !item) return null;

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    // Validate required fields
    if (!formData.name.trim()) {
      alert('Item name is required');
      return;
    }

    if (formData.quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }

    // Call parent save function with updated data
    onSave(item.id, formData);
    onClose();
  };

  const handleDelete = () => {
    onDelete(item.id);
    setShowDeleteConfirm(false);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className={styles['modal-overlay']} onClick={handleOverlayClick}>
      <div className={styles['modal-content']} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div className={styles['modal-header']}>
          <h3>Edit Item</h3>
          <button 
            className={styles['modal-close']}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Form Content */}
        <div className={styles['modal-body']}>
          
          {/* Item Name */}
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>Item Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={styles['form-input']}
              placeholder="Enter item name..."
            />
          </div>

          {/* Quantity and Unit */}
          <div className={styles['form-row']}>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Quantity</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value) || 0)}
                className={styles['form-input']}
                min="0"
                step="0.1"
              />
            </div>
            <div className={styles['form-group']}>
              <label className={styles['form-label']}>Unit</label>
              <select
                value={formData.unit}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className={styles['form-select']}
              >
                {commonUnits.map(unit => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Category */}
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>Category</label>
            <select
              value={formData.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className={styles['form-select']}
            >
              {commonCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div className={styles['form-group']}>
            <label className={styles['form-label']}>Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              className={styles['form-textarea']}
              placeholder="Add any notes..."
              rows="3"
            />
          </div>

        </div>

        {/* Actions */}
        <div className={styles['modal-actions']}>
          
          {/* Delete Section */}
          <div className={styles['delete-section']}>
            {showDeleteConfirm ? (
              <div className={styles['delete-confirm']}>
                <span className={styles['delete-text']}>Delete this item?</span>
                <button
                  className={styles['delete-confirm-button']}
                  onClick={handleDelete}
                >
                  Yes, Delete
                </button>
                <button
                  className={styles['delete-cancel-button']}
                  onClick={() => setShowDeleteConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                className={styles['delete-button']}
                onClick={() => setShowDeleteConfirm(true)}
              >
                Delete Item
              </button>
            )}
          </div>

          {/* Save/Cancel */}
          <div className={styles['save-cancel-section']}>
            <button
              className={styles['cancel-button']}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className={styles['save-button']}
              onClick={handleSave}
            >
              Save Changes
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default EditItemModal;