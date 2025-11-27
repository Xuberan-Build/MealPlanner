// src/services/creditService.js

import { db } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  setDoc,
  increment,
  serverTimestamp,
  runTransaction,
  collection,
  addDoc
} from 'firebase/firestore';
import { getCurrentUserId } from './authHelper';

/**
 * Default credit structure for new users
 */
const DEFAULT_CREDITS = {
  freeCredits: {
    total: 5,
    used: 0,
    remaining: 5,
    resetDate: null,
    lastResetAt: null
  },
  paidCredits: {
    balance: 0,
    totalPurchased: 0,
    totalSpent: 0.00
  },
  totalAvailable: 5,
  usage: {
    thisMonth: 0,
    lastMonth: 0,
    allTime: 0,
    averagePerMonth: 0
  }
};

/**
 * Initialize credits for a new user
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
export async function initializeUserCredits(userId) {
  try {
    if (!userId) {
      console.warn('Cannot initialize credits: No user ID provided');
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn('User document does not exist. Cannot initialize credits.');
      return;
    }

    const userData = userDoc.data();

    // Only initialize if credits don't already exist
    if (!userData.credits) {
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const credits = {
        ...DEFAULT_CREDITS,
        freeCredits: {
          ...DEFAULT_CREDITS.freeCredits,
          resetDate: nextMonth
        }
      };

      await updateDoc(userRef, { credits });
      console.log('✅ Credits initialized for user:', userId);
    } else {
      console.log('ℹ️ Credits already exist for user:', userId);
    }
  } catch (error) {
    console.error('❌ Error initializing user credits:', error);
  }
}

/**
 * Ensure credits object exists for a user (backward compatibility)
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<boolean>}
 */
async function ensureCreditsExist(userId) {
  try {
    if (!userId) return false;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return false;

    const userData = userDoc.data();

    if (!userData.credits) {
      await initializeUserCredits(userId);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring credits exist:', error);
    return false;
  }
}

/**
 * Get user's credit balance
 *
 * @param {string} userId - The user's ID (optional, uses current user if not provided)
 * @returns {Promise<Object|null>}
 */
export async function getCreditBalance(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) {
      console.warn('No user ID provided for getCreditBalance');
      return null;
    }

    await ensureCreditsExist(uid);

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn('User document not found');
      return null;
    }

    const userData = userDoc.data();
    const credits = userData.credits || DEFAULT_CREDITS;

    return {
      free: credits.freeCredits?.remaining || 0,
      paid: credits.paidCredits?.balance || 0,
      total: credits.totalAvailable || 0,
      resetDate: credits.freeCredits?.resetDate,
      usage: credits.usage || DEFAULT_CREDITS.usage,
      breakdown: {
        freeTotal: credits.freeCredits?.total || 5,
        freeUsed: credits.freeCredits?.used || 0,
        freeRemaining: credits.freeCredits?.remaining || 0,
        paidBalance: credits.paidCredits?.balance || 0,
        totalPurchased: credits.paidCredits?.totalPurchased || 0,
        totalSpent: credits.paidCredits?.totalSpent || 0
      }
    };
  } catch (error) {
    console.error('Error getting credit balance:', error);
    return null;
  }
}

/**
 * Check if user has enough credits for an action
 *
 * @param {string} userId - The user's ID (optional)
 * @param {number} requiredCredits - Number of credits required
 * @returns {Promise<boolean>}
 */
export async function hasAvailableCredits(userId = null, requiredCredits = 1) {
  try {
    const balance = await getCreditBalance(userId);
    if (!balance) return false;

    return balance.total >= requiredCredits;
  } catch (error) {
    console.error('Error checking available credits:', error);
    return false;
  }
}

/**
 * Consume credits for a feature
 * Uses free credits first, then paid credits
 * This is a transactional operation to prevent race conditions
 *
 * @param {string} feature - Feature name (e.g., 'ai_recipe_generation')
 * @param {Object} metadata - Additional metadata about the usage
 * @param {number} requiredCredits - Number of credits to consume
 * @returns {Promise<Object>}
 */
export async function consumeCredits(feature, metadata = {}, requiredCredits = 1) {
  const userId = getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  try {
    return await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      const userData = userDoc.data();
      const credits = userData.credits || DEFAULT_CREDITS;

      const freeRemaining = credits.freeCredits?.remaining || 0;
      const paidBalance = credits.paidCredits?.balance || 0;
      const totalAvailable = freeRemaining + paidBalance;

      // Check if enough credits
      if (totalAvailable < requiredCredits) {
        throw new Error('INSUFFICIENT_CREDITS');
      }

      // Determine credit source (use free first)
      let freeUsed = Math.min(freeRemaining, requiredCredits);
      let paidUsed = requiredCredits - freeUsed;

      const balanceBefore = {
        free: freeRemaining,
        paid: paidBalance,
        total: totalAvailable
      };

      const balanceAfter = {
        free: freeRemaining - freeUsed,
        paid: paidBalance - paidUsed,
        total: totalAvailable - requiredCredits
      };

      // Update user credits
      const updates = {
        'credits.totalAvailable': increment(-requiredCredits),
        'credits.usage.thisMonth': increment(requiredCredits),
        'credits.usage.allTime': increment(requiredCredits)
      };

      if (freeUsed > 0) {
        updates['credits.freeCredits.remaining'] = increment(-freeUsed);
        updates['credits.freeCredits.used'] = increment(freeUsed);
      }

      if (paidUsed > 0) {
        updates['credits.paidCredits.balance'] = increment(-paidUsed);
      }

      transaction.update(userRef, updates);

      // Create transaction record
      const transactionRef = doc(collection(db, 'transactions'));
      transaction.set(transactionRef, {
        userId,
        type: 'credit_used',
        creditsUsed: requiredCredits,
        feature,
        resourceId: metadata.resourceId || null,
        status: 'completed',
        createdAt: serverTimestamp(),
        completedAt: serverTimestamp()
      });

      // Create usage event
      const eventRef = doc(collection(db, 'usageEvents'));
      transaction.set(eventRef, {
        userId,
        eventType: 'credit_used',
        feature,
        creditsConsumed: requiredCredits,
        creditType: freeUsed > 0 ? 'free' : 'paid',
        balanceBefore,
        balanceAfter,
        metadata,
        timestamp: serverTimestamp()
      });

      console.log(`✅ Consumed ${requiredCredits} credit(s) for ${feature}`);
      console.log(`   Free used: ${freeUsed}, Paid used: ${paidUsed}`);
      console.log(`   New balance: ${balanceAfter.total}`);

      return {
        success: true,
        creditsUsed: requiredCredits,
        breakdown: {
          freeUsed,
          paidUsed
        },
        balanceBefore,
        balanceAfter,
        newBalance: balanceAfter.total
      };
    });
  } catch (error) {
    console.error('Error consuming credits:', error);
    throw error;
  }
}

/**
 * Add credits to user account (for purchases)
 *
 * @param {string} userId - The user's ID
 * @param {number} credits - Number of credits to add
 * @param {Object} paymentData - Payment transaction details
 * @returns {Promise<Object>}
 */
export async function addPurchasedCredits(userId, credits, paymentData = {}) {
  try {
    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!credits || credits <= 0) {
      throw new Error('Invalid credit amount');
    }

    return await runTransaction(db, async (transaction) => {
      const userRef = doc(db, 'users', userId);
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User not found');
      }

      // Update user credits
      transaction.update(userRef, {
        'credits.paidCredits.balance': increment(credits),
        'credits.paidCredits.totalPurchased': increment(credits),
        'credits.paidCredits.totalSpent': increment(paymentData.amount || 0),
        'credits.totalAvailable': increment(credits)
      });

      // Create transaction record
      const transactionRef = doc(collection(db, 'transactions'));
      transaction.set(transactionRef, {
        userId,
        type: 'purchase',
        amount: paymentData.amount || 0,
        currency: paymentData.currency || 'USD',
        creditsAdded: credits,
        paymentMethod: paymentData.provider || 'unknown',
        paymentIntentId: paymentData.transactionId || null,
        status: 'completed',
        productId: paymentData.productId || null,
        productName: paymentData.productName || null,
        createdAt: serverTimestamp(),
        completedAt: serverTimestamp()
      });

      console.log(`✅ Added ${credits} purchased credits to user ${userId}`);

      return {
        success: true,
        creditsAdded: credits,
        newBalance: (userDoc.data().credits?.totalAvailable || 0) + credits
      };
    });
  } catch (error) {
    console.error('Error adding purchased credits:', error);
    throw error;
  }
}

/**
 * Reset monthly free credits for a user
 * Called by scheduled Cloud Function
 *
 * @param {string} userId - The user's ID
 * @returns {Promise<void>}
 */
export async function resetMonthlyCredits(userId) {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn(`User ${userId} not found, skipping credit reset`);
      return;
    }

    const userData = userDoc.data();
    const currentCredits = userData.credits || DEFAULT_CREDITS;

    // Determine monthly allowance based on subscription tier
    const tier = userData.subscription?.tier || 'free';
    const monthlyAllowance = tier === 'free' ? 5 : 0;

    // Move current month usage to last month
    const thisMonthUsage = currentCredits.usage?.thisMonth || 0;

    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    // Calculate change in total available
    const previousFreeRemaining = currentCredits.freeCredits?.remaining || 0;
    const creditDelta = monthlyAllowance - previousFreeRemaining;

    await updateDoc(userRef, {
      'credits.freeCredits.total': monthlyAllowance,
      'credits.freeCredits.used': 0,
      'credits.freeCredits.remaining': monthlyAllowance,
      'credits.freeCredits.resetDate': nextMonth,
      'credits.freeCredits.lastResetAt': serverTimestamp(),
      'credits.totalAvailable': increment(creditDelta),
      'credits.usage.lastMonth': thisMonthUsage,
      'credits.usage.thisMonth': 0
    });

    console.log(`✅ Reset monthly credits for user ${userId}`);
    console.log(`   New free credits: ${monthlyAllowance}`);
  } catch (error) {
    console.error(`Error resetting monthly credits for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Check if user has reached free tier limit
 *
 * @param {string} userId - The user's ID (optional)
 * @returns {Promise<Object>}
 */
export async function checkFreeLimit(userId = null) {
  try {
    const balance = await getCreditBalance(userId);

    if (!balance) {
      return {
        hasReachedLimit: true,
        freeLimitReached: true,
        totalCredits: 0,
        resetDate: null
      };
    }

    return {
      hasReachedLimit: balance.total === 0,
      freeLimitReached: balance.free === 0,
      totalCredits: balance.total,
      freeCredits: balance.free,
      paidCredits: balance.paid,
      resetDate: balance.resetDate
    };
  } catch (error) {
    console.error('Error checking free limit:', error);
    return {
      hasReachedLimit: true,
      freeLimitReached: true,
      totalCredits: 0,
      resetDate: null
    };
  }
}

/**
 * Get user's transaction history
 *
 * @param {string} userId - The user's ID (optional)
 * @param {number} limit - Maximum number of transactions to return
 * @returns {Promise<Array>}
 */
export async function getTransactionHistory(userId = null, limit = 20) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const { getDocs, query, where, orderBy, limit: limitQuery } = await import('firebase/firestore');

    const transactionsRef = collection(db, 'transactions');
    const q = query(
      transactionsRef,
      where('userId', '==', uid),
      orderBy('createdAt', 'desc'),
      limitQuery(limit)
    );

    const snapshot = await getDocs(q);
    const transactions = [];

    snapshot.forEach((doc) => {
      transactions.push({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        completedAt: doc.data().completedAt?.toDate()
      });
    });

    return transactions;
  } catch (error) {
    console.error('Error getting transaction history:', error);
    return [];
  }
}

/**
 * Calculate usage statistics for a user
 *
 * @param {string} userId - The user's ID (optional)
 * @returns {Promise<Object>}
 */
export async function getUsageStatistics(userId = null) {
  try {
    const balance = await getCreditBalance(userId);

    if (!balance) return null;

    const usage = balance.usage || {};
    const breakdown = balance.breakdown || {};

    return {
      currentMonth: usage.thisMonth || 0,
      lastMonth: usage.lastMonth || 0,
      allTime: usage.allTime || 0,
      average: usage.averagePerMonth || 0,

      credits: {
        free: balance.free,
        paid: balance.paid,
        total: balance.total,
        totalPurchased: breakdown.totalPurchased || 0,
        totalSpent: breakdown.totalSpent || 0
      },

      resetDate: balance.resetDate
    };
  } catch (error) {
    console.error('Error getting usage statistics:', error);
    return null;
  }
}
