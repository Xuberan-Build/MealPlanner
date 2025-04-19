import React from 'react';
import styles from './InstructionsField.module.css';

const InstructionsField = ({ value, onChange }) => {
  return (
    <div className={styles.formField}>
      <textarea
        value={value}
        onChange={(e) => onChange('instructions', e.target.value)}
        className={styles.textarea}
        rows={6}
        placeholder="Enter recipe instructions..."
      />
      <label className={styles.label}>Instructions</label>
    </div>
  );
};

export default InstructionsField;
