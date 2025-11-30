// src/features/profile/components/ReferralSection.js

import React, { useState, useEffect } from 'react';
import { Copy, Check, Users, Gift, Mail } from 'lucide-react';
import { getReferralLink, getReferralData, generateSocialShareUrls } from '../../../services/referralService';
import './ReferralSection.css';

export default function ReferralSection({ onInviteFriends }) {
  const [referralData, setReferralData] = useState(null);
  const [referralLink, setReferralLink] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadReferralData();
  }, []);

  async function loadReferralData() {
    setLoading(true);
    try {
      const [data, link] = await Promise.all([
        getReferralData(),
        getReferralLink()
      ]);

      setReferralData(data);
      setReferralLink(link);
    } catch (error) {
      console.error('Error loading referral data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!referralLink) return;

    try {
      await navigator.clipboard.writeText(referralLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  }

  if (loading) {
    return (
      <div className="referral-section">
        <div className="loading-state">
          <div className="spinner-small"></div>
          <p>Loading referral data...</p>
        </div>
      </div>
    );
  }

  if (!referralData || !referralLink) {
    return null;
  }

  const stats = referralData.stats || {};
  const rewards = referralData.rewards || {};

  return (
    <div className="referral-section">
      <div className="section-header">
        <h3>Invite Friends & Earn Rewards</h3>
        <p>Share MealPlanner with friends and earn 50 points for each signup!</p>
      </div>

      <div className="referral-code-card">
        <div className="code-display">
          <label>Your Referral Code</label>
          <div className="code-value">{referralLink.code}</div>
        </div>

        <div className="link-section">
          <label>Share Link</label>
          <div className="link-input-group">
            <input
              type="text"
              value={referralLink.url}
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

        <button onClick={onInviteFriends} className="btn-invite">
          <Mail size={20} />
          <span>Invite Friends</span>
        </button>
      </div>

      <div className="referral-stats">
        <div className="stat-card">
          <div className="stat-icon users">
            <Users size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{stats.successfulReferrals || 0}</div>
            <div className="stat-label">Successful Referrals</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon gift">
            <Gift size={24} />
          </div>
          <div className="stat-content">
            <div className="stat-value">{rewards.pointsEarned || 0}</div>
            <div className="stat-label">Points Earned</div>
          </div>
        </div>
      </div>

      <div className="referral-info">
        <h4>How it works</h4>
        <ol>
          <li>Share your unique referral link with friends</li>
          <li>They sign up using your link</li>
          <li>You earn 50 points for each successful referral</li>
          <li>Use points for future rewards and features!</li>
        </ol>
      </div>
    </div>
  );
}
