// src/services/referralService.js

import { db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  increment,
  serverTimestamp
} from 'firebase/firestore';
import { getCurrentUserId } from './authHelper';

/**
 * Generate a unique referral code for a user
 *
 * @param {string} userName - User's name
 * @returns {string} - Unique referral code
 */
function generateReferralCode(userName) {
  // Create code from first part of name + random string
  const namePrefix = userName
    .replace(/[^a-zA-Z]/g, '')
    .substring(0, 4)
    .toUpperCase();

  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `${namePrefix}${randomSuffix}`;
}

/**
 * Initialize referral system for a user
 *
 * @param {string} userId - The user's ID
 * @param {string} userName - The user's name
 * @param {string} referredBy - Optional referrer code
 * @returns {Promise<Object>}
 */
export async function initializeReferralSystem(userId, userName, referredBy = null) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      throw new Error('User not found');
    }

    const userData = userDoc.data();

    // Check if referral already initialized
    if (userData.referral?.code) {
      console.log('Referral system already initialized for user');
      return userData.referral;
    }

    // Generate unique referral code
    let referralCode = generateReferralCode(userName);
    let isUnique = false;
    let attempts = 0;

    // Ensure code is unique
    while (!isUnique && attempts < 5) {
      const existingRef = await getDocs(
        query(collection(db, 'users'), where('referral.code', '==', referralCode))
      );

      if (existingRef.empty) {
        isUnique = true;
      } else {
        referralCode = generateReferralCode(userName);
        attempts++;
      }
    }

    if (!isUnique) {
      // Fallback to guaranteed unique code
      referralCode = `USER${userId.substring(0, 8).toUpperCase()}`;
    }

    // Initialize referral data
    const referralData = {
      code: referralCode,
      referredBy: referredBy || null,
      referredAt: referredBy ? serverTimestamp() : null,

      stats: {
        invitesSent: 0,
        successfulReferrals: 0,
        activeReferrals: 0 // Referrals who stayed active
      },

      rewards: {
        pointsEarned: 0,
        bonusesReceived: []
      }
    };

    // Update user document
    await updateDoc(userRef, {
      referral: referralData
    });

    // If user was referred, process the referral
    if (referredBy) {
      await processReferralSignup(referredBy, userId);
    }

    // Create referral record in separate collection
    const referralRecordRef = doc(db, 'referrals', userId);
    await setDoc(referralRecordRef, {
      referrerId: userId,
      referralCode,
      referred: [],
      stats: {
        invitesSent: 0,
        signups: 0,
        activeUsers: 0
      },
      rewards: {
        totalPoints: 0,
        bonusesUnlocked: []
      },
      createdAt: serverTimestamp()
    });

    console.log('✅ Referral system initialized:', referralCode);

    return referralData;
  } catch (error) {
    console.error('Error initializing referral system:', error);
    throw error;
  }
}

/**
 * Process a successful referral signup
 *
 * @param {string} referrerCode - The referrer's code
 * @param {string} newUserId - The new user's ID
 * @returns {Promise<void>}
 */
async function processReferralSignup(referrerCode, newUserId) {
  try {
    // Find referrer by code
    const usersQuery = query(
      collection(db, 'users'),
      where('referral.code', '==', referrerCode)
    );

    const usersSnapshot = await getDocs(usersQuery);

    if (usersSnapshot.empty) {
      console.warn('Referrer not found for code:', referrerCode);
      return;
    }

    const referrerDoc = usersSnapshot.docs[0];
    const referrerId = referrerDoc.id;

    // Get new user info
    const newUserDoc = await getDoc(doc(db, 'users', newUserId));
    const newUserData = newUserDoc.data();

    // Update referrer's stats
    await updateDoc(doc(db, 'users', referrerId), {
      'referral.stats.successfulReferrals': increment(1)
    });

    // Update referral record
    const referralRecordRef = doc(db, 'referrals', referrerId);
    const referralRecord = await getDoc(referralRecordRef);

    if (referralRecord.exists()) {
      await updateDoc(referralRecordRef, {
        referred: arrayUnion({
          email: newUserData.email || null,
          signedUp: true,
          signedUpAt: serverTimestamp(),
          userId: newUserId
        }),
        'stats.signups': increment(1)
      });
    }

    // Award points to referrer (50 points per successful referral)
    await updateDoc(doc(db, 'users', referrerId), {
      'referral.rewards.pointsEarned': increment(50)
    });

    // Create notification for referrer
    const notificationRef = doc(collection(db, 'notifications'));
    await setDoc(notificationRef, {
      userId: referrerId,
      type: 'referral_signup',
      title: 'New Referral!',
      message: 'Someone joined using your referral link. You earned 50 points!',
      icon: 'user-plus',
      actionUrl: '/profile?tab=referrals',
      read: false,
      createdAt: serverTimestamp(),
      metadata: {
        referredUserId: newUserId,
        pointsEarned: 50
      }
    });

    console.log('✅ Processed referral signup for:', referrerId);
  } catch (error) {
    console.error('Error processing referral signup:', error);
    // Don't throw - this shouldn't block user registration
  }
}

/**
 * Get user's referral data
 *
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object|null>}
 */
export async function getReferralData(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    const referralData = userData.referral || null;

    // Also get detailed referral record
    const referralRecordDoc = await getDoc(doc(db, 'referrals', uid));
    const referralRecord = referralRecordDoc.exists() ? referralRecordDoc.data() : null;

    return {
      ...referralData,
      detailed: referralRecord
    };
  } catch (error) {
    console.error('Error getting referral data:', error);
    return null;
  }
}

/**
 * Get referral link for user
 *
 * @param {string} userId - User ID (optional)
 * @returns {Promise<Object|null>}
 */
export async function getReferralLink(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const userDoc = await getDoc(doc(db, 'users', uid));
    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    const referralCode = userData.referral?.code;

    if (!referralCode) {
      throw new Error('Referral code not initialized');
    }

    const baseUrl = window.location.origin;
    const referralUrl = `${baseUrl}/signup?ref=${referralCode}`;

    return {
      code: referralCode,
      url: referralUrl,
      shortUrl: referralUrl
    };
  } catch (error) {
    console.error('Error getting referral link:', error);
    return null;
  }
}

/**
 * Track referral link share
 *
 * @param {string} platform - Platform where link was shared
 * @returns {Promise<void>}
 */
export async function trackReferralShare(platform) {
  try {
    const userId = getCurrentUserId();
    if (!userId) return;

    await updateDoc(doc(db, 'users', userId), {
      'referral.stats.invitesSent': increment(1)
    });

    const referralRecordRef = doc(db, 'referrals', userId);
    await updateDoc(referralRecordRef, {
      'stats.invitesSent': increment(1),
      lastSharedAt: serverTimestamp(),
      lastSharedPlatform: platform
    });

    console.log('✅ Tracked referral share:', platform);
  } catch (error) {
    console.error('Error tracking referral share:', error);
  }
}

/**
 * Send email invite (placeholder - requires email service)
 *
 * @param {string} email - Email address to invite
 * @param {string} message - Optional personal message
 * @returns {Promise<boolean>}
 */
export async function sendEmailInvite(email, message = '') {
  try {
    const userId = getCurrentUserId();
    if (!userId) throw new Error('User must be logged in');

    const referralLink = await getReferralLink(userId);

    // In a real implementation, this would call an email service
    // For now, we'll just track the invite
    await trackReferralShare('email');

    console.log('Email invite sent to:', email);
    console.log('Referral link:', referralLink.url);
    console.log('Message:', message);

    // TODO: Integrate with email service (SendGrid, Firebase Email Extension, etc.)

    return true;
  } catch (error) {
    console.error('Error sending email invite:', error);
    return false;
  }
}

/**
 * Generate social share URLs for different platforms
 *
 * @param {string} referralUrl - The referral URL
 * @returns {Object} - Share URLs for different platforms
 */
export function generateSocialShareUrls(referralUrl) {
  const shareText = encodeURIComponent(
    'Check out this amazing meal planning app! Plan your meals, discover recipes, and organize your cooking. 🍽️'
  );

  return {
    twitter: `https://twitter.com/intent/tweet?text=${shareText}&url=${encodeURIComponent(referralUrl)}`,

    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralUrl)}`,

    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralUrl)}`,

    whatsapp: `https://wa.me/?text=${shareText}%20${encodeURIComponent(referralUrl)}`,

    email: `mailto:?subject=${encodeURIComponent('Check out this meal planning app!')}&body=${shareText}%0A%0A${encodeURIComponent(referralUrl)}`
  };
}

/**
 * Validate and apply referral code during signup
 *
 * @param {string} referralCode - The referral code to apply
 * @returns {Promise<Object>} - Validation result
 */
export async function validateReferralCode(referralCode) {
  try {
    if (!referralCode) {
      return { valid: false, message: 'No referral code provided' };
    }

    // Find user with this referral code
    const usersQuery = query(
      collection(db, 'users'),
      where('referral.code', '==', referralCode.toUpperCase())
    );

    const usersSnapshot = await getDocs(usersQuery);

    if (usersSnapshot.empty) {
      return {
        valid: false,
        message: 'Invalid referral code'
      };
    }

    const referrerDoc = usersSnapshot.docs[0];
    const referrerData = referrerDoc.data();

    return {
      valid: true,
      referrerId: referrerDoc.id,
      referrerName: referrerData.name || 'A friend',
      message: `You were referred by ${referrerData.name || 'a friend'}!`
    };
  } catch (error) {
    console.error('Error validating referral code:', error);
    return {
      valid: false,
      message: 'Error validating referral code'
    };
  }
}
