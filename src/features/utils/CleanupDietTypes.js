import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import styles from './CleanupDietTypes.module.css';

const CleanupDietTypes = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const handleCleanup = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const functions = getFunctions();
      const cleanupDietTypes = httpsCallable(functions, 'cleanupDietTypes');

      const response = await cleanupDietTypes();

      setResult(response.data);
      console.log('✅ Cleanup successful:', response.data);
    } catch (err) {
      console.error('❌ Cleanup failed:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>🧹 Clean Up Diet Types</h1>
        <p className={styles.description}>
          This will remove partial diet types (like "p", "pu", "puer", etc.) from your account.
        </p>

        <button
          onClick={handleCleanup}
          disabled={loading}
          className={styles.button}
        >
          {loading ? 'Cleaning...' : 'Clean Up Now'}
        </button>

        {error && (
          <div className={styles.error}>
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className={styles.success}>
            <h3>✅ Success!</h3>
            <p><strong>Removed:</strong> {result.removed} invalid diet types</p>

            {result.before.length > 0 && (
              <div className={styles.details}>
                <h4>Before:</h4>
                <ul>
                  {result.before.map((type, index) => (
                    <li key={index}>{type}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.after.length > 0 && (
              <div className={styles.details}>
                <h4>After:</h4>
                <ul>
                  {result.after.map((type, index) => (
                    <li key={index}>{type}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CleanupDietTypes;
