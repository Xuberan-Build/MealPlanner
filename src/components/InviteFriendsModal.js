// src/components/InviteFriendsModal.js

import React, { useState } from 'react';
import { X, Mail, Send, Twitter, Facebook, MessageCircle } from 'lucide-react';
import { getReferralLink, sendEmailInvite, trackReferralShare, generateSocialShareUrls } from '../services/referralService';
import './InviteFriendsModal.css';

export default function InviteFriendsModal({ isOpen, onClose }) {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [referralLink, setReferralLink] = useState(null);

  React.useEffect(() => {
    if (isOpen) {
      loadReferralLink();
    }
  }, [isOpen]);

  async function loadReferralLink() {
    try {
      const link = await getReferralLink();
      setReferralLink(link);
    } catch (error) {
      console.error('Error loading referral link:', error);
    }
  }

  async function handleSendInvite(e) {
    e.preventDefault();

    if (!email) return;

    setSending(true);
    try {
      await sendEmailInvite(email, message);
      setSent(true);
      setEmail('');
      setMessage('');

      setTimeout(() => {
        setSent(false);
      }, 3000);
    } catch (error) {
      console.error('Error sending invite:', error);
      alert('Failed to send invite. Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function handleSocialShare(platform) {
    if (!referralLink) return;

    const shareUrls = generateSocialShareUrls(referralLink.url);

    if (shareUrls[platform]) {
      window.open(shareUrls[platform], '_blank', 'width=600,height=400');
      await trackReferralShare(platform);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="header-with-icon">
            <Mail size={24} className="header-icon" />
            <h2>Invite Friends</h2>
          </div>
          <button onClick={onClose} className="close-btn">
            <X size={24} />
          </button>
        </div>

        <div className="modal-body">
          <div className="invite-intro">
            <p>Invite your friends to MealPlanner and earn 50 points for each signup!</p>
          </div>

          <form onSubmit={handleSendInvite} className="email-invite-form">
            <h3>Send Email Invite</h3>

            <div className="form-group">
              <label htmlFor="email">Friend's Email</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="friend@example.com"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="message">Personal Message (Optional)</label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a personal note..."
                className="form-textarea"
                rows="3"
              />
            </div>

            <button
              type="submit"
              disabled={sending || !email}
              className={`btn-send ${sent ? 'sent' : ''}`}
            >
              {sent ? (
                <>
                  <span>Sent!</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>{sending ? 'Sending...' : 'Send Invite'}</span>
                </>
              )}
            </button>
          </form>

          <div className="divider">
            <span>or share via</span>
          </div>

          <div className="social-share-section">
            <button
              onClick={() => handleSocialShare('twitter')}
              className="social-share-btn twitter"
            >
              <Twitter size={20} />
              <span>Share on Twitter</span>
            </button>

            <button
              onClick={() => handleSocialShare('facebook')}
              className="social-share-btn facebook"
            >
              <Facebook size={20} />
              <span>Share on Facebook</span>
            </button>

            <button
              onClick={() => handleSocialShare('whatsapp')}
              className="social-share-btn whatsapp"
            >
              <MessageCircle size={20} />
              <span>Share on WhatsApp</span>
            </button>
          </div>

          <div className="referral-code-display">
            <label>Your Referral Code</label>
            <div className="code-box">{referralLink?.code || 'Loading...'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
