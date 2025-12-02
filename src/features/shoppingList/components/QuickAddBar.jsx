import React, { useState, useRef, useEffect } from 'react';
import ShoppingListAutocomplete from './ShoppingListAutocomplete';
import styles from './QuickAddBar.module.css';

const QuickAddBar = ({ onItemAdd, recentItems = [] }) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={styles.quickAddBar}>
      <div className={styles.inputWrapper}>
        <ShoppingListAutocomplete
          ref={inputRef}
          onItemAdd={onItemAdd}
          placeholder="Add item..."
          autoFocus={true}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </div>

      {!isFocused && recentItems.length > 0 && (
        <div className={styles.recentItems}>
          <span className={styles.recentLabel}>Recent:</span>
          {recentItems.slice(0, 3).map((item, index) => (
            <button
              key={index}
              className={styles.recentChip}
              onClick={() => onItemAdd(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuickAddBar;
