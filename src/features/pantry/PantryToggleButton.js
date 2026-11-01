import React from 'react';
import { Check, Plus } from 'lucide-react';
import styles from './PantryToggleButton.module.css';

const LABELS = {
  have: { text: 'Have it', title: 'In your pantry. Tap if you need to buy it' },
  partial: { text: 'Have some', title: 'You have some. Tap to mark that you have enough' },
  need: { text: 'Need', title: 'Tap if you already have this' }
};

/**
 * Small pill for shopping list rows: "we have this" / "we need this".
 * Presentational only: persistence is up to the caller (see markHave / markNeed in
 * services/pantryService).
 *
 * Props:
 *   item          the shopping item (passed back to onChange)
 *   pantryStatus  'have' | 'partial' | 'need' (default 'need')
 *   onChange      (nextStatus: 'have' | 'need', item) => void
 *   disabled      optional
 *   compact       optional: icon only
 */
const PantryToggleButton = ({ item, pantryStatus = 'need', onChange, disabled = false, compact = false }) => {
  const status = LABELS[pantryStatus] ? pantryStatus : 'need';
  const next = status === 'have' ? 'need' : 'have';
  const { text, title } = LABELS[status];

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
      aria-pressed={status === 'have'}
      aria-label={`${item && item.name ? `${item.name}: ` : ''}${text}`}
      title={title}
    >
      {status === 'need' ? <Plus size={14} strokeWidth={2.5} /> : <Check size={14} strokeWidth={2.5} />}
      {!compact && <span>{text}</span>}
    </button>
  );
};

export default PantryToggleButton;
