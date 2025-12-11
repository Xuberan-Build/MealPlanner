// src/constants/mealPlanner.js

/**
 * Standard meal types used throughout the application.
 * Order matters for UI display.
 */
export const MEAL_TYPES = [
  'Breakfast',
  'Lunch',
  'Dinner',
  'Snacks',
  'Desserts'
];

/**
 * Days of the week in Monday-first order.
 * Used in meal planning calendars and modals.
 */
export const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday'
];

/**
 * Days of week with abbreviated labels for compact UI display.
 */
export const DAYS_OF_WEEK_ABBREVIATED = [
  { key: 'Monday', label: 'Mon' },
  { key: 'Tuesday', label: 'Tue' },
  { key: 'Wednesday', label: 'Wed' },
  { key: 'Thursday', label: 'Thu' },
  { key: 'Friday', label: 'Fri' },
  { key: 'Saturday', label: 'Sat' },
  { key: 'Sunday', label: 'Sun' }
];

/**
 * Days of week in Sunday-first order.
 * Used for date calculations where Sunday = 0.
 */
export const DAYS_OF_WEEK_SUNDAY_FIRST = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday'
];
