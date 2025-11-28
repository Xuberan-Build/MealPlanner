// src/services/healthJourneyService.js

import { db, storage } from '../firebase';
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  serverTimestamp,
  setDoc,
  runTransaction
} from 'firebase/firestore';
import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage';
import { getCurrentUserId } from './authHelper';
import {
  validateJournalEntry,
  generateEntryId,
  checkEntriesLimit,
  findPotentialDuplicate,
  ValidationError
} from './foodJournalValidation';

/**
 * Default health journey structure
 */
const DEFAULT_HEALTH_JOURNEY = {
  privacy: {
    shareWithCoach: false,
    shareWeight: false,
    shareMeasurements: false,
    sharePhotos: false,
    shareGoals: false,
    shareFoodJournal: false
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
  foodJournal: {
    entries: []
  },
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
      timestamp: Date.now()
    };

    // Sanitize existing history to remove any serverTimestamp objects
    const existingHistory = (userData.healthJourney?.weight?.history || []).map(entry => ({
      ...entry,
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now()
    }));

    // Update current weight
    const updatedHistory = [...existingHistory, weightEntry];

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
      timestamp: Date.now()
    };

    // Sanitize existing history to remove any serverTimestamp objects
    const existingHistory = (userData.healthJourney?.measurements?.history || []).map(entry => ({
      ...entry,
      timestamp: typeof entry.timestamp === 'number' ? entry.timestamp : Date.now()
    }));

    const updatedHistory = [...existingHistory, measurementEntry];

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
      timestamp: Date.now()
    };

    // Get existing photos and sanitize them
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const existingPhotos = (userData.healthJourney?.progressPhotos || []).map(photo => ({
      ...photo,
      timestamp: typeof photo.timestamp === 'number' ? photo.timestamp : Date.now()
    }));

    // Update user document
    await updateDoc(userRef, {
      'healthJourney.progressPhotos': [...existingPhotos, photoEntry]
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
      createdAt: Date.now()
    };

    // Get existing goals and sanitize them
    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    const existingGoals = (userData.healthJourney?.goals || []).map(g => ({
      ...g,
      createdAt: typeof g.createdAt === 'number' ? g.createdAt : Date.now()
    }));

    await updateDoc(userRef, {
      'healthJourney.goals': [...existingGoals, goal]
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

// ============================================================================
// FOOD & WELLNESS JOURNAL
// ============================================================================

/**
 * Log a food journal entry with validation and transaction safety
 * @param {string} userId - User ID
 * @param {Object} entryData - Journal entry data
 * @param {Object} options - Options { checkDuplicates: boolean, allowWarnings: boolean }
 * @returns {Promise<Object>} - Result with entry and warnings
 * @throws {ValidationError} - If validation fails
 * @throws {Error} - If document size limit exceeded
 */
export async function logFoodJournalEntry(userId = null, entryData, options = {}) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) {
      throw new ValidationError('User ID is required');
    }

    if (!entryData) {
      throw new ValidationError('Entry data is required');
    }

    // Validate and sanitize entry data
    const validatedData = validateJournalEntry(entryData);

    // Ensure health journey exists
    await ensureHealthJourneyExists(uid);

    const userRef = doc(db, 'users', uid);

    // Use transaction for atomic read-modify-write
    const result = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const existingEntries = userData.healthJourney?.foodJournal?.entries || [];

      // Check document size limits
      const sizeCheck = checkEntriesLimit(existingEntries);
      if (sizeCheck.shouldArchive) {
        throw new Error(
          `Entry limit reached (${sizeCheck.count}/${sizeCheck.remainingCapacity}). ` +
          'Please contact support for archiving.'
        );
      }

      // Check for duplicates if requested
      let warnings = [];
      if (options.checkDuplicates !== false) {
        const duplicate = findPotentialDuplicate(validatedData, existingEntries);
        if (duplicate) {
          warnings.push({
            type: 'POTENTIAL_DUPLICATE',
            message: `Similar entry found for "${duplicate.mealName}" at ${new Date(duplicate.date).toLocaleString()}`,
            duplicateId: duplicate.id
          });

          // If not allowing warnings, throw error
          if (!options.allowWarnings) {
            const error = new Error('Potential duplicate entry detected');
            error.warnings = warnings;
            throw error;
          }
        }
      }

      // Warn if approaching limit
      if (sizeCheck.isNearLimit) {
        warnings.push({
          type: 'APPROACHING_LIMIT',
          message: `You have ${sizeCheck.remainingCapacity} entries remaining before archiving is needed.`,
          count: sizeCheck.count
        });
      }

      // Create new entry with validated data
      const entry = {
        id: generateEntryId(),
        timestamp: Date.now(),
        createdAt: new Date().toISOString(),
        ...validatedData
      };

      // Sanitize existing entries (defensive programming)
      const sanitizedEntries = existingEntries.map(e => ({
        ...e,
        timestamp: typeof e.timestamp === 'number' ? e.timestamp : Date.now()
      }));

      // Update document
      transaction.update(userRef, {
        'healthJourney.foodJournal.entries': [...sanitizedEntries, entry],
        'healthJourney.foodJournal.lastUpdated': Date.now()
      });

      return { entry, warnings };
    });

    console.log('📝 Food journal entry logged:', result.entry.id);
    if (result.warnings.length > 0) {
      console.warn('⚠️ Warnings:', result.warnings);
    }

    return result;
  } catch (error) {
    // Re-throw validation errors with clear messages
    if (error instanceof ValidationError) {
      console.error('❌ Validation error:', error.message, error.field);
      throw error;
    }

    // Log and re-throw other errors
    console.error('❌ Error logging food journal entry:', error);
    throw error;
  }
}

/**
 * Get food journal entries
 * @param {string} userId - User ID
 * @param {Object} filters - Optional filters (startDate, endDate, mealPlanId)
 * @returns {Promise<Array>} - Array of journal entries
 */
export async function getFoodJournalEntries(userId = null, filters = {}) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return [];

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);

    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    let entries = userData.healthJourney?.foodJournal?.entries || [];

    // Apply filters
    if (filters.startDate) {
      entries = entries.filter(e => new Date(e.date) >= filters.startDate);
    }
    if (filters.endDate) {
      entries = entries.filter(e => new Date(e.date) <= filters.endDate);
    }
    if (filters.mealPlanId) {
      entries = entries.filter(e => e.mealPlanId === filters.mealPlanId);
    }

    // Sort by date (newest first)
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));

    return entries;
  } catch (error) {
    console.error('Error getting food journal entries:', error);
    return [];
  }
}

/**
 * Update a food journal entry with validation and transaction safety
 * @param {string} userId - User ID
 * @param {string} entryId - Entry ID
 * @param {Object} updates - Updates to apply
 * @returns {Promise<Object>} - Updated entry
 * @throws {ValidationError} - If validation fails
 * @throws {Error} - If entry not found
 */
export async function updateFoodJournalEntry(userId = null, entryId, updates) {
  try {
    const uid = userId || getCurrentUserId();

    if (!uid) {
      throw new ValidationError('User ID is required');
    }

    if (!entryId) {
      throw new ValidationError('Entry ID is required');
    }

    if (!updates || typeof updates !== 'object') {
      throw new ValidationError('Updates are required');
    }

    // Validate the updates
    const validatedUpdates = validateJournalEntry(updates);

    const userRef = doc(db, 'users', uid);

    // Use transaction for atomic update
    const result = await runTransaction(db, async (transaction) => {
      const userDoc = await transaction.get(userRef);

      if (!userDoc.exists()) {
        throw new Error('User document not found');
      }

      const userData = userDoc.data();
      const entries = userData.healthJourney?.foodJournal?.entries || [];

      // Find the entry to update
      const entryIndex = entries.findIndex(e => e.id === entryId);

      if (entryIndex === -1) {
        throw new Error(`Entry not found: ${entryId}`);
      }

      // Create updated entry
      const updatedEntry = {
        ...entries[entryIndex],
        ...validatedUpdates,
        updatedAt: new Date().toISOString(),
        lastModified: Date.now()
      };

      // Create new entries array with the update
      const updatedEntries = [
        ...entries.slice(0, entryIndex),
        updatedEntry,
        ...entries.slice(entryIndex + 1)
      ];

      // Update document
      transaction.update(userRef, {
        'healthJourney.foodJournal.entries': updatedEntries,
        'healthJourney.foodJournal.lastUpdated': Date.now()
      });

      return updatedEntry;
    });

    console.log('✏️ Food journal entry updated:', entryId);
    return result;
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('❌ Validation error:', error.message, error.field);
      throw error;
    }

    console.error('❌ Error updating food journal entry:', error);
    throw error;
  }
}

/**
 * Delete a food journal entry
 * @param {string} userId - User ID
 * @param {string} entryId - Entry ID
 */
export async function deleteFoodJournalEntry(userId = null, entryId) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid || !entryId) return;

    const userRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();

    const entries = userData.healthJourney?.foodJournal?.entries || [];
    const updatedEntries = entries.filter(entry => entry.id !== entryId);

    await updateDoc(userRef, {
      'healthJourney.foodJournal.entries': updatedEntries
    });

    console.log('🗑 Food journal entry deleted:', entryId);
  } catch (error) {
    console.error('Error deleting food journal entry:', error);
    throw error;
  }
}

/**
 * Get food insights (patterns and statistics)
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Insights object
 */
export async function getFoodInsights(userId = null) {
  try {
    const uid = userId || getCurrentUserId();
    if (!uid) return null;

    const entries = await getFoodJournalEntries(uid);

    if (entries.length === 0) return null;

    // Calculate average energy levels
    const energyLevels = entries
      .filter(e => e.energyAfter !== null)
      .map(e => e.energyAfter);
    const avgEnergy = energyLevels.length > 0
      ? energyLevels.reduce((a, b) => a + b, 0) / energyLevels.length
      : null;

    // Find most common physical feelings
    const allFeelings = entries.flatMap(e => e.physicalFeelings || []);
    const feelingCounts = allFeelings.reduce((acc, feeling) => {
      acc[feeling] = (acc[feeling] || 0) + 1;
      return acc;
    }, {});

    // Find foods with positive/negative reactions
    const allReactions = entries.flatMap(e => e.reactions || []);
    const positiveReactions = allReactions.filter(r => r.type === 'positive');
    const negativeReactions = allReactions.filter(r => r.type === 'negative');

    return {
      totalEntries: entries.length,
      averageEnergy: avgEnergy,
      commonFeelings: Object.entries(feelingCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([feeling, count]) => ({ feeling, count })),
      positiveReactions: positiveReactions.length,
      negativeReactions: negativeReactions.length,
      topPositiveFoods: getTopFoods(positiveReactions, 5),
      topNegativeFoods: getTopFoods(negativeReactions, 5)
    };
  } catch (error) {
    console.error('Error getting food insights:', error);
    return null;
  }
}

/**
 * Helper function to get top foods from reactions
 */
function getTopFoods(reactions, limit = 5) {
  const foodCounts = reactions.reduce((acc, r) => {
    if (r.food) {
      acc[r.food] = (acc[r.food] || 0) + 1;
    }
    return acc;
  }, {});

  return Object.entries(foodCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([food, count]) => ({ food, count }));
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
  getHealthJourney,
  // Food Journal
  logFoodJournalEntry,
  getFoodJournalEntries,
  updateFoodJournalEntry,
  deleteFoodJournalEntry,
  getFoodInsights
};
