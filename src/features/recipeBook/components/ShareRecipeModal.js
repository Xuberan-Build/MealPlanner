import React, { useState, useEffect } from 'react';
import { X, Mail, UserPlus } from 'lucide-react';
import {
  shareRecipeWithUser,
  searchUsersByEmail
} from '../../../services/recipeSharingService';
import styles from './ShareRecipeModal.module.css';

const ShareRecipeModal = ({ recipe, isOpen, onClose }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (email.length >= 3) {
      searchUsers(email);
    } else {
      setSearchResults([]);
    }
  }, [email]);

  const searchUsers = async (emailPrefix) => {
    try {
      const users = await searchUsersByEmail(emailPrefix);
      setSearchResults(users);
    } catch (err) {
      console.error('Failed to search users:', err);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await shareRecipeWithUser(recipe, email);
      setSuccess(result.message);
      setEmail('');
      setSearchResults([]);

      // Auto-close modal after 2 seconds on success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message || 'Failed to share recipe');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSelect = (selectedEmail) => {
    setEmail(selectedEmail);
    setSearchResults([]);
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <Mail size={24} />
            Share Recipe: {recipe.title}
          </h2>
          <button className={styles.closeButton} onClick={onClose}>
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

          {error && <div className={styles.error}>{error}</div>}
          {success && <div className={styles.success}>{success}</div>}

          <form onSubmit={handleShare} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Recipient Email</label>
              <div className={styles.inputWrapper}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address..."
                  className={styles.input}
                  required
                  disabled={loading}
                />
                {searchResults.length > 0 && (
                  <ul className={styles.searchResults}>
                    {searchResults.map((user) => (
                      <li
                        key={user.id}
                        className={styles.searchResult}
                        onClick={() => handleEmailSelect(user.email)}
                      >
                        <UserPlus size={16} />
                        <span>{user.displayName}</span>
                        <span className={styles.userEmail}>{user.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
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
