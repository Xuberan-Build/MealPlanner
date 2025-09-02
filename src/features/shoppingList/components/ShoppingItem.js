// src/features/shoppingList/components/ShoppingItem.js
import React, { useState } from 'react';
import styles from './ShoppingItem.module.css';

const ShoppingItem = ({ 
  item, 
  onQuantityChange, 
  onNoteChange, 
  onToggleComplete,
  onToggleHave,
  onClick // New prop for clicking to edit
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempQuantity, setTempQuantity] = useState(item.quantity);
  const [tempNote, setTempNote] = useState(item.notes || '');

  const handleQuantitySubmit = () => {
    onQuantityChange(item.id, tempQuantity);
    setIsEditing(false);
  };

  const handleQuantityCancel = () => {
    setTempQuantity(item.quantity);
    setIsEditing(false);
  };

  const handleNoteSubmit = () => {
    onNoteChange(item.id, tempNote);
    setIsEditing(false);
  };

  // Handle clicking on item - only if not currently editing
  const handleItemClick = (e) => {
    // Don't trigger if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('input')) {
      return;
    }
    
    // Don't trigger if currently editing
    if (isEditing) {
      return;
    }

    if (onClick) {
      onClick(item);
    }
  };

  const estimatedTotal = (item.estimatedCost * item.quantity).toFixed(2);

  return (
    <div 
      className={`${styles.shoppingItem} ${item.alreadyHave ? styles.alreadyHave : ''} ${onClick ? styles.clickable : ''}`}
      onClick={handleItemClick}
    >
      {/* Main item content */}
      <div className={styles.itemHeader}>
        <div className={styles.itemInfo}>
          <h3 className={styles.itemName}>{item.name}</h3>
          <div className={styles.itemMeta}>
            <span className={styles.category}>{item.category}</span>
            {item.subcategory && (
              <span className={styles.subcategory}>• {item.subcategory}</span>
            )}
          </div>
        </div>
        
        {/* Quick actions */}
        <div className={styles.quickActions}>
          <button
            className={`${styles.actionButton} ${styles.haveButton} ${item.alreadyHave ? styles.active : ''}`}
            onClick={(e) => {
              e.stopPropagation(); // Prevent item click
              onToggleHave(item.id);
            }}
            aria-label={item.alreadyHave ? "Mark as needed" : "Mark as already have"}
          >
            ✓
          </button>
        </div>
      </div>

      {/* Quantity and details section */}
      <div className={styles.itemDetails}>
        <div className={styles.quantitySection}>
          {isEditing ? (
            <div className={styles.editingControls}>
              <input
                type="number"
                value={tempQuantity}
                onChange={(e) => setTempQuantity(Number(e.target.value))}
                className={styles.quantityInput}
                min="0"
                step="0.1"
                autoFocus
                onClick={(e) => e.stopPropagation()} // Prevent item click
              />
              <span className={styles.unit}>{item.unit}</span>
              <div className={styles.editActions}>
                <button 
                  className={styles.saveButton}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent item click
                    handleQuantitySubmit();
                  }}
                >
                  ✓
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent item click
                    handleQuantityCancel();
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              className={styles.quantityDisplay}
              onClick={(e) => {
                e.stopPropagation(); // Prevent item click
                setIsEditing(true);
              }}
            >
              <span className={styles.quantity}>{item.quantity}</span>
              <span className={styles.unit}>{item.unit}</span>
              <span className={styles.editIcon}>✏️</span>
            </button>
          )}
        </div>

        {/* Cost display */}
        {item.estimatedCost > 0 && (
          <div className={styles.costSection}>
            <span className={styles.costLabel}>Est.</span>
            <span className={styles.cost}>${estimatedTotal}</span>
          </div>
        )}
      </div>

      {/* Notes section */}
      {(item.notes || isEditing) && (
        <div className={styles.notesSection}>
          {isEditing ? (
            <div className={styles.noteEditing}>
              <input
                type="text"
                value={tempNote}
                onChange={(e) => setTempNote(e.target.value)}
                className={styles.noteInput}
                placeholder="Add a note..."
                onClick={(e) => e.stopPropagation()} // Prevent item click
              />
              <button 
                className={styles.saveButton}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent item click
                  handleNoteSubmit();
                }}
              >
                Save
              </button>
            </div>
          ) : (
            <div className={styles.noteDisplay}>
              <span className={styles.noteText}>{item.notes}</span>
              <button 
                className={styles.editNoteButton}
                onClick={(e) => {
                  e.stopPropagation(); // Prevent item click
                  setIsEditing(true);
                }}
              >
                Edit
              </button>
            </div>
          )}
        </div>
      )}

      {/* Progress indicator */}
      <div className={styles.progressIndicator}>
        <div className={`${styles.progressBar} ${item.alreadyHave ? styles.complete : ''}`} />
      </div>

      {/* Click hint */}
      {onClick && !isEditing && (
        <div className={styles.clickHint}>
          <span>Tap to edit</span>
        </div>
      )}
    </div>
  );
};

export default ShoppingItem;