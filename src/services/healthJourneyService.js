// src/services/healthJourneyService.js

import { db, storage } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { getCurrentUserId } from './authHelper';

/**
 * Default health journey structure
 */
const DEFAULT_HEALTH_JOURNEY = {
  privacy: {
    shareWithCoach: false,
    shareWeight: false,
    shareMeasurements: false,
    sharePhotos: false,
    shareGoals: false
  },
  weight: {
    current: null,
    start: null,
    target: null,
    history: []
  },
  measurements: {
    current: {},
    history: []
  },
  goals: [],
  progressPhotos: [],
  coachId: null
};

/**
 * Initialize health journey for a user
 */
export async function initializeHealthJourney(userId) {
  try {
    if (!userId) {
      console.warn('Cannot initialize health journey: No user ID provided');
      return;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) {
      console.warn('User document does not exist');
      return;
    }

    const userData = userDoc.data();

    if (!userData.healthJourney) {
      await updateDoc(userRef, {
        healthJourney: DEFAULT_HEALTH_JOURNEY
      });
      console.log('✅ Health journey initialized for user:', userId);
    }
  } catch (error) {
    console.error('❌ Error initializing health journey:', error);
  }
}

/**
 * Ensure health journey exists (backward compatibility)
 */
async function ensureHealthJourneyExists(userId) {
  try {
    if (!userId) return false;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return false;

    const userData = userDoc.data();

    if (!userData.healthJourney) {
      await initializeHealthJourney(userId);
    }

    return true;
  } catch (error) {
    console.error('Error ensuring health journey exists:', error);
    return false;
  }
}

// ============================================================================
// WEIGHT TRACKING
// ============================================================================

/**
 * Log weight entry
 * @param {string} userId - User ID (optional)
 * @param {number} weight - Weight in lbs
 * @param {Date} date - Date of measurement
 * @param {string} notes - Optional notes
 */
export async function logWeight(userId = null, weight, date = new Date(), notes = '') {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !weight) return null;

    await ensureHealthJourneyExists(uid);

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const weightEntry = {
      id: `weight_${Date.now()}`,
      weight: parseFloat(weight),
      date: date instanceof Date ? date.toISOString() : date,
      notes: notes || '',
      loggedBy: 'self',
      timestamp: serverTimestamp()
    };

    // Update current weight
    const updatedHistory = [...(userData.healthJourney?.weight?.history || []), weightEntry];

    // Set start weight if not set
    const startWeight = userData.healthJourney?.weight?.start || weight;

    await updateDoc(userRef, {
      'healthJourney.weight.current': parseFloat(weight),
      'healthJourney.weight.start': startWeight,
      'healthJourney.weight.history': updatedHistory
    });

    console.log('📊 Weight logged:', weight, 'lbs');
    return weightEntry;
  } catch (error) {
    console.error('Error logging weight:', error);
    throw error;
  }
}

/**
 * Get weight history
 * @param {string} userId - User ID
 * @param {Date} startDate - Start date for history
 * @param {Date} endDate - End date for history
 */
export async function getWeightHistory(userId = null, startDate = null, endDate = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    let history = userData.healthJourney?.weight?.history || [];

    // Filter by date range if provided
    if (startDate || endDate) {
      history = history.filter(entry => {
        const entryDate = new Date(entry.date);
        if (startDate && entryDate < startDate) return false;
        if (endDate && entryDate > endDate) return false;
        return true;
      });
    }

    // Sort by date (newest first)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));

    return history;
  } catch (error) {
    console.error('Error getting weight history:', error);
    return [];
  }
}

/**
 * Get weight statistics
 * @param {string} userId - User ID
 */
export async function getWeightStats(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    const weightData = userData.healthJourney?.weight || {};

    const current = weightData.current || 0;
    const start = weightData.start || current;
    const target = weightData.target || current;
    const history = weightData.history || [];

    // Calculate progress
    const totalToLose = start - target;
    const lostSoFar = start - current;
    const remaining = current - target;
    const progressPercentage = totalToLose > 0 ? (lostSoFar / totalToLose) * 100 : 0;

    // Calculate average weekly loss (if enough data)
    let averageWeeklyLoss = 0;
    if (history.length >= 2) {
      const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstEntry = sortedHistory[0];
      const lastEntry = sortedHistory[sortedHistory.length - 1];
      const weightChange = firstEntry.weight - lastEntry.weight;
      const daysBetween = (new Date(lastEntry.date) - new Date(firstEntry.date)) / (1000 * 60 * 60 * 24);
      const weeksBetween = daysBetween / 7;
      averageWeeklyLoss = weeksBetween > 0 ? weightChange / weeksBetween : 0;
    }

    return {
      current,
      start,
      target,
      lostSoFar,
      remaining,
      progressPercentage: Math.min(Math.max(progressPercentage, 0), 100),
      averageWeeklyLoss,
      totalEntries: history.length
    };
  } catch (error) {
    console.error('Error getting weight stats:', error);
    return null;
  }
}

/**
 * Set weight goal
 * @param {string} userId - User ID
 * @param {number} targetWeight - Target weight in lbs
 */
export async function setWeightGoal(userId = null, targetWeight) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !targetWeight) return;

    await ensureHealthJourneyExists(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'healthJourney.weight.target': parseFloat(targetWeight)
    });

    console.log('🎯 Weight goal set:', targetWeight, 'lbs');
  } catch (error) {
    console.error('Error setting weight goal:', error);
    throw error;
  }
}

// ============================================================================
// MEASUREMENTS TRACKING
// ============================================================================

/**
 * Log body measurements
 * @param {string} userId - User ID
 * @param {Object} measurements - Object with measurement values
 * @param {Date} date - Date of measurement
 * @param {string} notes - Optional notes
 */
export async function logMeasurements(userId = null, measurements, date = new Date(), notes = '') {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !measurements) return null;

    await ensureHealthJourneyExists(uid);

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const measurementEntry = {
      id: `measurement_${Date.now()}`,
      ...measurements,
      date: date instanceof Date ? date.toISOString() : date,
      notes: notes || '',
      loggedBy: 'self',
      timestamp: serverTimestamp()
    };

    const updatedHistory = [...(userData.healthJourney?.measurements?.history || []), measurementEntry];

    await updateDoc(userRef, {
      'healthJourney.measurements.current': measurements,
      'healthJourney.measurements.history': updatedHistory
    });

    console.log('📏 Measurements logged');
    return measurementEntry;
  } catch (error) {
    console.error('Error logging measurements:', error);
    throw error;
  }
}

/**
 * Get measurements history
 * @param {string} userId - User ID
 */
export async function getMeasurementsHistory(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    const history = userData.healthJourney?.measurements?.history || [];

    // Sort by date (newest first)
    return history.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error('Error getting measurements history:', error);
    return [];
  }
}

/**
 * Compare measurements between two dates
 * @param {string} userId - User ID
 * @param {string} entryId1 - First measurement entry ID
 * @param {string} entryId2 - Second measurement entry ID
 */
export async function compareMeasurements(userId = null, entryId1, entryId2) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const history = await getMeasurementsHistory(uid);
    const entry1 = history.find(e => e.id === entryId1);
    const entry2 = history.find(e => e.id === entryId2);

    if (!entry1 || !entry2) return null;

    const comparison = {};
    const fields = ['waist', 'chest', 'hips', 'arms', 'thighs'];

    fields.forEach(field => {
      if (entry1[field] !== undefined && entry2[field] !== undefined) {
        comparison[field] = {
          before: entry1[field],
          after: entry2[field],
          change: entry2[field] - entry1[field]
        };
      }
    });

    return comparison;
  } catch (error) {
    console.error('Error comparing measurements:', error);
    return null;
  }
}

// ============================================================================
// PROGRESS PHOTOS
// ============================================================================

/**
 * Upload progress photo
 * @param {string} userId - User ID
 * @param {File} photoFile - Photo file
 * @param {string} type - Photo type (front/side/back)
 * @param {number} weight - Current weight at time of photo
 * @param {string} notes - Optional notes
 */
export async function uploadProgressPhoto(userId = null, photoFile, type = 'front', weight = null, notes = '', date = null, visibility = 'private') {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !photoFile) return null;

    await ensureHealthJourneyExists(uid);

    // Upload photo to Firebase Storage
    const photoId = `photo_${Date.now()}`;
    const storageRef = ref(storage, `progress_photos/${uid}/${photoId}`);

    await uploadBytes(storageRef, photoFile);
    const photoURL = await getDownloadURL(storageRef);

    // Create photo entry
    const photoEntry = {
      id: photoId,
      url: photoURL,
      type,
      weight: weight || null,
      notes: notes || '',
      date: date || new Date().toISOString(),
      visibility: visibility || 'private',
      timestamp: serverTimestamp()
    };

    // Update user document
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'healthJourney.progressPhotos': arrayUnion(photoEntry)
    });

    console.log('📸 Progress photo uploaded:', type);
    return photoEntry;
  } catch (error) {
    console.error('Error uploading progress photo:', error);
    throw error;
  }
}

/**
 * Get progress photos
 * @param {string} userId - User ID
 */
export async function getProgressPhotos(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    const photos = userData.healthJourney?.progressPhotos || [];

    // Sort by date (newest first)
    return photos.sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error('Error getting progress photos:', error);
    return [];
  }
}

/**
 * Update photo privacy
 * @param {string} userId - User ID
 * @param {string} photoId - Photo ID
 * @param {string} visibility - Visibility setting (private/coach_only/public)
 */
export async function updatePhotoPrivacy(userId = null, photoId, visibility) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !photoId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const photos = userData.healthJourney?.progressPhotos || [];
    const updatedPhotos = photos.map(photo =>
      photo.id === photoId ? { ...photo, visibility } : photo
    );

    await updateDoc(userRef, {
      'healthJourney.progressPhotos': updatedPhotos
    });

    console.log('🔒 Photo privacy updated:', photoId, visibility);
  } catch (error) {
    console.error('Error updating photo privacy:', error);
    throw error;
  }
}

/**
 * Delete a progress photo
 * @param {string} userId - User ID
 * @param {string} photoId - Photo ID to delete
 */
export async function deleteProgressPhoto(userId = null, photoId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !photoId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const photos = userData.healthJourney?.progressPhotos || [];
    const updatedPhotos = photos.filter(photo => photo.id !== photoId);

    await updateDoc(userRef, {
      'healthJourney.progressPhotos': updatedPhotos
    });

    console.log('🗑 Progress photo deleted:', photoId);
  } catch (error) {
    console.error('Error deleting progress photo:', error);
    throw error;
  }
}

// ============================================================================
// GOALS & MILESTONES
// ============================================================================

/**
 * Create a new goal
 * @param {string} userId - User ID
 * @param {Object} goalData - Goal data
 */
export async function createGoal(userId = null, goalData) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !goalData) return null;

    await ensureHealthJourneyExists(uid);

    const goal = {
      id: `goal_${Date.now()}`,
      title: goalData.title,
      description: goalData.description || '',
      setBy: 'self',
      setByUserId: uid,
      startWeight: goalData.startWeight || null,
      targetWeight: goalData.targetWeight || null,
      deadline: goalData.deadline || null,
      status: 'active',
      milestones: goalData.milestones || [],
      notes: goalData.notes || '',
      createdAt: serverTimestamp()
    };

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'healthJourney.goals': arrayUnion(goal)
    });

    console.log('🎯 Goal created:', goal.title);
    return goal;
  } catch (error) {
    console.error('Error creating goal:', error);
    throw error;
  }
}

/**
 * Update goal
 * @param {string} userId - User ID
 * @param {string} goalId - Goal ID
 * @param {Object} updates - Updates to apply
 */
export async function updateGoal(userId = null, goalId, updates) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !goalId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const goals = userData.healthJourney?.goals || [];
    const updatedGoals = goals.map(goal =>
      goal.id === goalId ? { ...goal, ...updates } : goal
    );

    await updateDoc(userRef, {
      'healthJourney.goals': updatedGoals
    });

    console.log('✏️ Goal updated:', goalId);
  } catch (error) {
    console.error('Error updating goal:', error);
    throw error;
  }
}

/**
 * Complete a goal
 * @param {string} userId - User ID
 * @param {string} goalId - Goal ID
 */
export async function completeGoal(userId = null, goalId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !goalId) return;

    await updateGoal(uid, goalId, {
      status: 'completed',
      completedAt: new Date().toISOString()
    });

    console.log('✅ Goal completed:', goalId);
  } catch (error) {
    console.error('Error completing goal:', error);
    throw error;
  }
}

/**
 * Add milestone to goal
 * @param {string} userId - User ID
 * @param {string} goalId - Goal ID
 * @param {Object} milestone - Milestone data
 */
export async function addMilestone(userId = null, goalId, milestone) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !goalId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const goals = userData.healthJourney?.goals || [];
    const updatedGoals = goals.map(goal => {
      if (goal.id === goalId) {
        const milestones = goal.milestones || [];
        return {
          ...goal,
          milestones: [...milestones, { ...milestone, id: `milestone_${Date.now()}` }]
        };
      }
      return goal;
    });

    await updateDoc(userRef, {
      'healthJourney.goals': updatedGoals
    });

    console.log('🏅 Milestone added to goal:', goalId);
  } catch (error) {
    console.error('Error adding milestone:', error);
    throw error;
  }
}

/**
 * Complete milestone
 * @param {string} userId - User ID
 * @param {string} goalId - Goal ID
 * @param {string} milestoneId - Milestone ID
 */
export async function completeMilestone(userId = null, goalId, milestoneId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !goalId || !milestoneId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const goals = userData.healthJourney?.goals || [];
    const updatedGoals = goals.map(goal => {
      if (goal.id === goalId) {
        const milestones = goal.milestones.map(m =>
          m.id === milestoneId ? { ...m, achieved: true, date: new Date().toISOString() } : m
        );
        return { ...goal, milestones };
      }
      return goal;
    });

    await updateDoc(userRef, {
      'healthJourney.goals': updatedGoals
    });

    console.log('✅ Milestone completed:', milestoneId);
  } catch (error) {
    console.error('Error completing milestone:', error);
    throw error;
  }
}

/**
 * Get all goals
 * @param {string} userId - User ID
 * @param {string} status - Filter by status (active/completed/all)
 */
export async function getGoals(userId = null, status = 'all') {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    let goals = userData.healthJourney?.goals || [];

    if (status !== 'all') {
      goals = goals.filter(goal => goal.status === status);
    }

    return goals;
  } catch (error) {
    console.error('Error getting goals:', error);
    return [];
  }
}

// ============================================================================
// PRIVACY & SHARING
// ============================================================================

/**
 * Update privacy settings
 * @param {string} userId - User ID
 * @param {Object} privacySettings - Privacy settings object
 */
export async function updatePrivacySettings(userId = null, privacySettings) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return;

    await ensureHealthJourneyExists(uid);

    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      'healthJourney.privacy': privacySettings
    });

    console.log('🔒 Privacy settings updated');
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
}

/**
 * Get health journey data (respecting privacy if requested by coach)
 * @param {string} userId - User ID
 * @param {string} requestingUserId - ID of user requesting data (for privacy check)
 */
export async function getHealthJourney(userId, requestingUserId = null) {
  try {
    if (!userId) return null;

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return null;

    const userData = userDoc.data();
    const healthJourney = userData.healthJourney || DEFAULT_HEALTH_JOURNEY;

    // If requesting user is not the owner, check privacy settings
    if (requestingUserId && requestingUserId !== userId) {
      const privacy = healthJourney.privacy || {};

      // Check if requesting user is the coach
      const isCoach = healthJourney.coachId === requestingUserId;

      if (!isCoach || !privacy.shareWithCoach) {
        // Return limited data based on privacy settings
        return {
          weight: privacy.shareWeight ? healthJourney.weight : null,
          measurements: privacy.shareMeasurements ? healthJourney.measurements : null,
          progressPhotos: privacy.sharePhotos ? healthJourney.progressPhotos : [],
          goals: privacy.shareGoals ? healthJourney.goals : []
        };
      }
    }

    return healthJourney;
  } catch (error) {
    console.error('Error getting health journey:', error);
    return null;
  }
}

export default {
  initializeHealthJourney,
  logWeight,
  getWeightHistory,
  getWeightStats,
  setWeightGoal,
  logMeasurements,
  getMeasurementsHistory,
  compareMeasurements,
  uploadProgressPhoto,
  getProgressPhotos,
  updatePhotoPrivacy,
  deleteProgressPhoto,
  createGoal,
  updateGoal,
  completeGoal,
  addMilestone,
  completeMilestone,
  getGoals,
  updatePrivacySettings,
  getHealthJourney
};
