import { useState, useEffect } from 'react';

export const useImportFeedback = (duration = 5000) => {
  const [feedback, setFeedback] = useState({ status: '', message: '' });

  useEffect(() => {
    if (feedback.status) {
      const timer = setTimeout(() => {
        setFeedback({ status: '', message: '' });
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [feedback, duration]);

  const showFeedback = (status, message) => {
    setFeedback({ status, message });
  };

  const clearFeedback = () => {
    setFeedback({ status: '', message: '' });
  };

  return {
    feedback,
    showFeedback,
    clearFeedback
  };
};
