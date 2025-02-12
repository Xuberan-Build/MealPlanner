import React from 'react';
import styles from './ImportFeedback.module.css';

const ImportFeedback = ({ feedback }) => {
  if (!feedback.status) return null;

  return (
    <div className={`${styles.feedback} ${styles[feedback.status]}`}>
      {feedback.message}
    </div>
  );
};

export default ImportFeedback;
