import React from 'react';
import styles from './CommonItemsBar.module.css';

const CommonItemsBar = ({ items = [], onItemClick, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className={styles.commonItemsBar}>
        <span className={styles.label}>Loading common items...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.commonItemsBar}>
      <span className={styles.label}>Common Items:</span>
      <div className={styles.chipsContainer}>
        {items.map((item, index) => (
          <button
            key={index}
            className={styles.chip}
            onClick={() => onItemClick(item)}
            title={`Add ${item.name} (added ${item.count} times)`}
          >
            <span className={styles.chipText}>{item.name}</span>
            <span className={styles.chipBadge}>{item.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CommonItemsBar;
