import React from 'react';
import styles from './ImportPrompt.module.css';

const ImportPrompt = ({ onImportClick }) => {
  return (
    <div className={styles.importPrompt}>
      <button
        onClick={onImportClick}
        className={styles.importButton}
      >
        Import Recipe
      </button>
    </div>
  );
};

export default ImportPrompt;
