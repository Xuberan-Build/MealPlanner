// src/components/ShareRecipeModal.js

import React, { useState } from 'react';
import { X, Copy, Check, Share2, Facebook, Twitter, MessageCircle, Mail } from 'lucide-react';
import { shareRecipe, copyLinkToClipboard } from '../services/recipeSharingService';
import './ShareRecipeModal.css';

export default function ShareRecipeModal({ isOpen, onClose, recipe }) {
  const [shareLink, setShareLink] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  React.useEffect(() => {
    if (isOpen && recipe && !shareLink) {
      handleShareRecipe();
    }
  }, [isOpen, recipe]);

  async function handleShareRecipe() {
    setLoading(true);
    setError(null);

    try {
      const result = await shareRecipe(recipe.id, {
        visibility: 'public',
        tags: recipe.tags || []
      });

      setShareLink(result.shareLink);
    } catch (err) {
      console.error('Error sharing recipe:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!shareLink) return;

    const success = await copyLinkToClipboard(shareLink);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleSocialShare(platform) {
    if (!shareLink) return;

    const text = encodeURIComponent(`Check out this delicious recipe: ${recipe.title} 🍽️`);
    const url = encodeURIComponent(shareLink);

    let shareUrl;
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
        break;
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
        break;
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`;
        break;
      case 'email':
        shareUrl = `mailto:?subject=${encodeURIComponent(`Recipe: ${recipe.title}`)}&body=${text}%0A%0A${url}`;
        break;
      default:
        return;
    }

    window.open(shareUrl, '_blank', 'width=600,height=400');
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content share-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-with-icon">
            <Share2 size={24} className="header-icon" />
            <h2>Share Recipe</h2>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Generating share link...</p>
            </div>
          ) : error ? (
            <div className="error-state">
              <p className="error-message">{error}</p>
              <button onClick={handleShareRecipe} className="btn-secondary">
                Try Again
              </button>
            </div>
          ) : (
            <>
              <div className="recipe-preview">
                <h3>{recipe.title}</h3>
                {recipe.description && <p className="recipe-description">{recipe.description}</p>}
              </div>

              <div className="share-link-section">
                <label>Share Link</label>
                <div className="link-input-group">
                  <input
                    type="text"
                    value={shareLink || ''}
                    readOnly
                    className="link-input"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`btn-copy ${copied ? 'copied' : ''}`}
                  >
                    {copied ? (
                      <>
                        <Check size={18} />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={18} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="share-options">
                <label>Share via</label>
                <div className="social-buttons">
                  <button
                    onClick={() => handleSocialShare('twitter')}
                    className="social-btn twitter"
                  >
                    <Twitter size={20} />
                    <span>Twitter</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('facebook')}
                    className="social-btn facebook"
                  >
                    <Facebook size={20} />
                    <span>Facebook</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('whatsapp')}
                    className="social-btn whatsapp"
                  >
                    <MessageCircle size={20} />
                    <span>WhatsApp</span>
                  </button>

                  <button
                    onClick={() => handleSocialShare('email')}
                    className="social-btn email"
                  >
                    <Mail size={20} />
                    <span>Email</span>
                  </button>
                </div>
              </div>

              <div className="share-info">
                <p>
                  🌟 Anyone with this link can view and save this recipe to their collection.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
