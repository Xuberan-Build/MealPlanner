import React, { useEffect, useRef, useState } from 'react';
import { X, Mail } from 'lucide-react';
import { shareRecipeWithUser } from '../../../services/recipeSharingService';
import styles from './ShareRecipeModal.module.css';

// Sharing is by exact sign-in email. There is no people search: listing other users'
// profiles would expose their emails.
const ShareRecipeModal = ({ recipe, isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const closeTimer = useRef(null);

  useEffect(() => () => clearTimeout(closeTimer.current), []);

  const handleShare = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await shareRecipeWithUser(recipe, email);
      setSuccess(result.message);
      setEmail('');
      // Auto-close after 2 seconds on success
      closeTimer.current = setTimeout(onClose, 2000);
    } catch (err) {
      setError(err.message || 'Failed to share recipe');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="share-recipe-title">
        <div className={styles.header}>
          <h2 id="share-recipe-title" className={styles.title}>
            <Mail size={24} />
            Share Recipe: {recipe.title}
          </h2>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
            <X size={24} />
          </button>
        </div>

        <div className={styles.content}>
          <div className={styles.ctaBox}>
            <p>
              <strong>Spread the joy of cooking.</strong> Share this recipe and inspire someone
              to create something delicious tonight.
            </p>
          </div>

          {error && <div className={styles.error} role="alert">{error}</div>}
          {success && <div className={styles.success} role="status">{success}</div>}

          <form onSubmit={handleShare} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label} htmlFor="share-recipient-email">Recipient Email</label>
              <div className={styles.inputWrapper}>
                <input
                  id="share-recipient-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Their Savor Meals sign-in email"
                  className={styles.input}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className={styles.shareButton}
              disabled={loading || !email.trim()}
            >
              {loading ? 'Sharing...' : 'Share Recipe'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ShareRecipeModal;
