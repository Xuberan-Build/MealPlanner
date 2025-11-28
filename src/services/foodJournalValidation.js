/**
 * Food Journal Validation Utilities
 *
 * Centralized validation and sanitization for food journal entries
 */

// Validation constants
export const VALIDATION_RULES = {
  mealName: {
    minLength: 1,
    maxLength: 200
  },
  notes: {
    maxLength: 1000
  },
  energyLevel: {
    min: 1,
    max: 5
  },
  physicalFeelings: {
    maxItems: 10,
    allowedValues: [
      'Satisfied',
      'Energized',
      'Light',
      'Comfortable',
      'Bloated',
      'Heavy',
      'Sluggish',
      'Hungry',
      'Full',
      'Nauseous'
    ]
  },
  date: {
    minDate: new Date('2020-01-01'), // Reasonable minimum
    maxDate: new Date() // No future dates
  },
  maxEntriesPerDocument: 2000, // Safety limit before archiving needed
  warningThreshold: 1500 // Warn user when approaching limit
};

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Sanitize a string input
 * @param {string} input - Input string
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Sanitized string
 */
export function sanitizeString(input, maxLength = 1000) {
  if (!input || typeof input !== 'string') return '';

  return input
    .trim()
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .slice(0, maxLength);
}

/**
 * Validate and sanitize energy level
 * @param {number} energy - Energy level input
 * @returns {number|null} - Valid energy level or null
 */
export function validateEnergyLevel(energy) {
  if (energy === null || energy === undefined) return null;

  const parsed = parseInt(energy, 10);
  if (isNaN(parsed)) return null;

  // Clamp between 1 and 5
  return Math.max(1, Math.min(5, parsed));
}

/**
 * Validate date input
 * @param {string|Date} dateInput - Date input
 * @returns {string} - Valid ISO date string
 * @throws {ValidationError} - If date is invalid
 */
export function validateDate(dateInput) {
  if (!dateInput) {
    throw new ValidationError('Date is required', 'date');
  }

  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  // Check if valid date
  if (isNaN(date.getTime())) {
    throw new ValidationError('Invalid date format', 'date');
  }

  // Check if date is not too old
  if (date < VALIDATION_RULES.date.minDate) {
    throw new ValidationError('Date is too far in the past', 'date');
  }

  // Check if date is not in the future
  if (date > VALIDATION_RULES.date.maxDate) {
    throw new ValidationError('Date cannot be in the future', 'date');
  }

  return date.toISOString();
}

/**
 * Validate and sanitize meal name
 * @param {string} mealName - Meal name input
 * @returns {string} - Valid meal name
 * @throws {ValidationError} - If meal name is invalid
 */
export function validateMealName(mealName) {
  const sanitized = sanitizeString(mealName, VALIDATION_RULES.mealName.maxLength);

  if (!sanitized || sanitized.length < VALIDATION_RULES.mealName.minLength) {
    throw new ValidationError('Meal name is required', 'mealName');
  }

  return sanitized;
}

/**
 * Validate and sanitize physical feelings array
 * @param {Array} feelings - Physical feelings array
 * @returns {Array} - Valid feelings array
 */
export function validatePhysicalFeelings(feelings) {
  if (!Array.isArray(feelings)) return [];

  const { allowedValues, maxItems } = VALIDATION_RULES.physicalFeelings;

  return feelings
    .filter(feeling => allowedValues.includes(feeling))
    .slice(0, maxItems);
}

/**
 * Validate and sanitize reactions array
 * @param {Array} reactions - Reactions array
 * @returns {Array} - Valid reactions array
 */
export function validateReactions(reactions) {
  if (!Array.isArray(reactions)) return [];

  return reactions
    .filter(r => r && (r.type === 'positive' || r.type === 'negative'))
    .slice(0, 20) // Max 20 reactions
    .map(r => ({
      type: r.type,
      food: sanitizeString(r.food || '', 100),
      note: sanitizeString(r.note || '', 200)
    }));
}

/**
 * Generate a unique entry ID
 * @returns {string} - Unique ID
 */
export function generateEntryId() {
  // Use timestamp + random string to avoid collisions
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `journal_${timestamp}_${random}`;
}

/**
 * Check if entries array is approaching size limit
 * @param {Array} entries - Entries array
 * @returns {Object} - Status object
 */
export function checkEntriesLimit(entries) {
  if (!Array.isArray(entries)) {
    return { isNearLimit: false, shouldArchive: false, count: 0 };
  }

  const count = entries.length;
  const { maxEntriesPerDocument, warningThreshold } = VALIDATION_RULES;

  return {
    count,
    isNearLimit: count >= warningThreshold,
    shouldArchive: count >= maxEntriesPerDocument,
    remainingCapacity: maxEntriesPerDocument - count
  };
}

/**
 * Validate complete journal entry data
 * @param {Object} entryData - Raw entry data
 * @returns {Object} - Validated and sanitized entry data
 * @throws {ValidationError} - If validation fails
 */
export function validateJournalEntry(entryData) {
  if (!entryData || typeof entryData !== 'object') {
    throw new ValidationError('Invalid entry data');
  }

  // Validate required fields
  const mealName = validateMealName(entryData.mealName);
  const date = validateDate(entryData.date || new Date());

  // Validate optional fields
  const energyBefore = validateEnergyLevel(entryData.energyBefore);
  const energyAfter = validateEnergyLevel(entryData.energyAfter);
  const physicalFeelings = validatePhysicalFeelings(entryData.physicalFeelings);
  const reactions = validateReactions(entryData.reactions);
  const notes = sanitizeString(entryData.notes || '', VALIDATION_RULES.notes.maxLength);

  // Validate meal plan IDs if provided
  const mealPlanId = entryData.mealPlanId || null;
  const mealId = entryData.mealId || null;

  return {
    mealName,
    date,
    energyBefore,
    energyAfter,
    energyLevel: energyAfter, // Use after as primary energy level
    physicalFeelings,
    reactions,
    notes,
    mealPlanId,
    mealId,
    foodItems: Array.isArray(entryData.foodItems) ? entryData.foodItems.slice(0, 50) : [],
    mood: entryData.mood || null
  };
}

/**
 * Check for potential duplicate entries
 * @param {Object} newEntry - New entry to check
 * @param {Array} existingEntries - Existing entries
 * @param {number} thresholdMinutes - Time threshold in minutes
 * @returns {Object|null} - Potential duplicate or null
 */
export function findPotentialDuplicate(newEntry, existingEntries, thresholdMinutes = 60) {
  if (!Array.isArray(existingEntries) || existingEntries.length === 0) {
    return null;
  }

  const newDate = new Date(newEntry.date);
  const threshold = thresholdMinutes * 60 * 1000; // Convert to milliseconds

  return existingEntries.find(entry => {
    const entryDate = new Date(entry.date);
    const timeDiff = Math.abs(newDate - entryDate);

    return (
      timeDiff < threshold &&
      entry.mealName.toLowerCase() === newEntry.mealName.toLowerCase()
    );
  });
}

export default {
  VALIDATION_RULES,
  ValidationError,
  sanitizeString,
  validateEnergyLevel,
  validateDate,
  validateMealName,
  validatePhysicalFeelings,
  validateReactions,
  generateEntryId,
  checkEntriesLimit,
  validateJournalEntry,
  findPotentialDuplicate
};
