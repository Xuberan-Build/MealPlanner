// src/services/myCircleValidation.js

/**
 * Input validation and sanitization for My Circle feature
 * Prevents XSS, injection attacks, and data corruption
 */

/**
 * Validate and sanitize email address
 * @param {string} email - Email to validate
 * @returns {string} Sanitized email
 * @throws {Error} If email is invalid
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required');
  }

  const trimmed = email.trim().toLowerCase();

  // Check length
  if (trimmed.length < 3 || trimmed.length > 254) {
    throw new Error('Email must be between 3 and 254 characters');
  }

  // RFC 5322 compliant email regex
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  if (!emailRegex.test(trimmed)) {
    throw new Error('Invalid email format');
  }

  // Prevent javascript: and data: URI schemes
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:')) {
    throw new Error('Invalid email format');
  }

  return trimmed;
}

/**
 * Validate and sanitize name
 * @param {string} name - Name to validate
 * @returns {string} Sanitized name
 * @throws {Error} If name is invalid
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    throw new Error('Name is required');
  }

  const trimmed = name.trim();

  // Check length
  if (trimmed.length < 1) {
    throw new Error('Name cannot be empty');
  }

  if (trimmed.length > 100) {
    throw new Error('Name must be 100 characters or less');
  }

  // Remove potentially dangerous characters
  const sanitized = trimmed.replace(/[<>\"\']/g, '');

  // Check for suspicious patterns
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,  // onclick=, onload=, etc.
    /<iframe/i,
    /<object/i,
    /<embed/i
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(name)) {
      throw new Error('Name contains invalid characters');
    }
  }

  return sanitized;
}

/**
 * Validate relationship type
 * @param {string} relationship - Relationship type
 * @returns {string} Validated relationship
 * @throws {Error} If relationship is invalid
 */
export function validateRelationship(relationship) {
  const validTypes = ['family', 'clients', 'friends'];

  if (!relationship || typeof relationship !== 'string') {
    throw new Error('Relationship type is required');
  }

  const normalized = relationship.toLowerCase().trim();

  if (!validTypes.includes(normalized)) {
    throw new Error('Invalid relationship type. Must be: family, clients, or friends');
  }

  return normalized;
}

/**
 * Validate permissions object
 * @param {Object} permissions - Permissions to validate
 * @returns {Object} Validated permissions
 */
export function validatePermissions(permissions = {}) {
  const validPermissions = {
    viewMealPlans: false,
    shareRecipes: true,
    collaboration: false,
    trackProgress: false
  };

  // Start with defaults
  const validated = { ...validPermissions };

  // Only allow known permission keys
  for (const key of Object.keys(permissions)) {
    if (key in validPermissions && typeof permissions[key] === 'boolean') {
      validated[key] = permissions[key];
    }
  }

  return validated;
}

/**
 * Validate member data for adding to circle
 * @param {Object} memberData - Member data to validate
 * @returns {Object} Validated and sanitized member data
 * @throws {Error} If validation fails
 */
export function validateMemberData(memberData) {
  if (!memberData || typeof memberData !== 'object') {
    throw new Error('Invalid member data');
  }

  const { email, name, relationship, permissions } = memberData;

  return {
    email: validateEmail(email),
    name: validateName(name),
    relationship: validateRelationship(relationship),
    permissions: validatePermissions(permissions)
  };
}

/**
 * Validate referral code format
 * @param {string} code - Referral code to validate
 * @returns {string} Validated code
 * @throws {Error} If code is invalid
 */
export function validateReferralCode(code) {
  if (!code || typeof code !== 'string') {
    throw new Error('Referral code is required');
  }

  const trimmed = code.trim().toUpperCase();

  // Check length (4-12 characters)
  if (trimmed.length < 4 || trimmed.length > 12) {
    throw new Error('Referral code must be between 4 and 12 characters');
  }

  // Only allow alphanumeric characters
  if (!/^[A-Z0-9]+$/.test(trimmed)) {
    throw new Error('Referral code must contain only letters and numbers');
  }

  return trimmed;
}

/**
 * Validate user name for referral code generation
 * @param {string} userName - User name
 * @returns {string} Sanitized name safe for code generation
 */
export function sanitizeUserNameForCode(userName) {
  if (!userName || typeof userName !== 'string') {
    return 'USER';
  }

  // Remove all non-alphabetic characters
  const cleaned = userName.replace(/[^a-zA-Z]/g, '');

  if (cleaned.length === 0) {
    return 'USER';
  }

  return cleaned.substring(0, 4).toUpperCase();
}

/**
 * Validate array size to prevent document size limit issues
 * @param {Array} array - Array to check
 * @param {number} maxSize - Maximum allowed size
 * @param {string} arrayName - Name of array for error message
 * @throws {Error} If array exceeds max size
 */
export function validateArraySize(array, maxSize, arrayName = 'Array') {
  if (!Array.isArray(array)) {
    throw new Error(`${arrayName} must be an array`);
  }

  if (array.length >= maxSize) {
    throw new Error(`${arrayName} has reached maximum size of ${maxSize}`);
  }
}

/**
 * Rate limiting check (client-side helper)
 * @param {string} action - Action being performed
 * @param {number} maxPerHour - Maximum actions per hour
 * @returns {boolean} Whether action is allowed
 */
export function checkRateLimit(action, maxPerHour = 10) {
  const key = `rateLimit_${action}`;
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  // Get stored actions from localStorage
  const stored = localStorage.getItem(key);
  let actions = stored ? JSON.parse(stored) : [];

  // Remove actions older than 1 hour
  actions = actions.filter(timestamp => now - timestamp < oneHour);

  // Check if limit exceeded
  if (actions.length >= maxPerHour) {
    return false;
  }

  // Add current action
  actions.push(now);
  localStorage.setItem(key, JSON.stringify(actions));

  return true;
}

/**
 * Validate recipe ID format
 * @param {string} recipeId - Recipe ID to validate
 * @returns {string} Validated recipe ID
 * @throws {Error} If invalid
 */
export function validateRecipeId(recipeId) {
  if (!recipeId || typeof recipeId !== 'string') {
    throw new Error('Recipe ID is required');
  }

  const trimmed = recipeId.trim();

  if (trimmed.length < 1 || trimmed.length > 128) {
    throw new Error('Invalid recipe ID length');
  }

  // Prevent path traversal
  if (trimmed.includes('..') || trimmed.includes('/') || trimmed.includes('\\')) {
    throw new Error('Invalid recipe ID format');
  }

  return trimmed;
}

/**
 * Validate member IDs array
 * @param {Array} memberIds - Array of member IDs
 * @returns {Array} Validated member IDs
 * @throws {Error} If invalid
 */
export function validateMemberIds(memberIds) {
  if (!Array.isArray(memberIds)) {
    throw new Error('Member IDs must be an array');
  }

  if (memberIds.length === 0) {
    throw new Error('At least one member ID is required');
  }

  if (memberIds.length > 50) {
    throw new Error('Cannot share with more than 50 members at once');
  }

  return memberIds.map(id => {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new Error('Invalid member ID');
    }
    return id.trim();
  });
}

export default {
  validateEmail,
  validateName,
  validateRelationship,
  validatePermissions,
  validateMemberData,
  validateReferralCode,
  sanitizeUserNameForCode,
  validateArraySize,
  checkRateLimit,
  validateRecipeId,
  validateMemberIds
};
