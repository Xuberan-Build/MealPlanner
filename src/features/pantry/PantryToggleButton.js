import React from 'react';
import { Check, Plus } from 'lucide-react';
import styles from './PantryToggleButton.module.css';

// The button says what tapping it DOES, so it is never a mystery where the item goes.
const LABELS = {
  need: {
    text: 'Have it',
    action: 'I have it, move to Already have',
    title: 'Already have this at home? Tap to move it to Already have',
  },
  partial: {
    text: 'Have enough',
    action: 'I have enough, move to Already have',
    title: 'You have some. Tap if what you have is enough',
  },
  have: {
    text: 'Need it',
    action: 'I need it, move back to the list',
    title: 'Tap if you need to buy it after all',
  },
};

/**
 * Pill for shopping list rows that moves an item between "to buy" and "Already have".
 * Presentational only: persistence is up to the caller (see markHave / markNeed in
 * services/pantryService).
 *
 * Props:
 *   item          the shopping item (passed back to onChange)
 *   pantryStatus  current status: 'have' | 'partial' | 'need' (default 'need')
 *   onChange      (nextStatus: 'have' | 'need', item) => void
 *   disabled      optional
 *   compact       optional: icon only (the text stays available to screen readers)
 */
const PantryToggleButton = ({ item, pantryStatus = 'need', onChange, disabled = false, compact = false }) => {
  const status = LABELS[pantryStatus] ? pantryStatus : 'need';
  const next = status === 'have' ? 'need' : 'have';
  const { text, action, title } = LABELS[status];

  const handleClick = (e) => {
    e.stopPropagation();
    if (!disabled && onChange) onChange(next, item);
  };

  return (
    <button
      type="button"
      className={`${styles.toggle} ${styles[status]} ${compact ? styles.compact : ''}`}
      onClick={handleClick}
      disabled={disabled}
      aria-label={`${item && item.name ? `${item.name}: ` : ''}${action}`}
      title={title}
    >
      {next === 'have'
        ? <Check size={14} strokeWidth={2.5} aria-hidden="true" />
        : <Plus size={14} strokeWidth={2.5} aria-hidden="true" />}
      {!compact && <span>{text}</span>}
    </button>
  );
};

export default PantryToggleButton;
