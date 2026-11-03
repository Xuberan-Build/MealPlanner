import React from 'react';
import { Star, X } from 'lucide-react';
import { canonicalDietType, dietTypeKey, normalizeDietTypeList } from '../../utils/dietTypes/normalize';
import './DietTypeBadge.css';

/**
 * DietTypeBadge - Visual indicator for diet types
 * Features:
 * - Clean, colorful design
 * - Optional favorite indicator
 * - Optional remove button
 * - Different sizes (small, medium, large)
 * - Different variants (default, outlined, filled)
 */
const DietTypeBadge = ({
  name,
  isFavorite = false,
  onRemove = null,
  size = 'medium',
  variant = 'default',
  className = '',
  clickable = false,
  onClick = null
}) => {
  const handleClick = () => {
    if (clickable && onClick) {
      onClick(name);
    }
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(name);
    }
  };

  // Show the canonical spelling ("gluten free" -> "Gluten-Free"); callbacks get `name` as passed.
  const displayName = canonicalDietType(name) || name;

  return (
    <div
      className={`diet-type-badge ${size} ${variant} ${clickable ? 'clickable' : ''} ${className}`}
      onClick={handleClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
    >
      {isFavorite && (
        <Star
          size={size === 'small' ? 10 : size === 'large' ? 14 : 12}
          fill="currentColor"
          className="favorite-star"
        />
      )}
      <span className="badge-text">{displayName}</span>
      {onRemove && (
        <button
          type="button"
          className="remove-button"
          onClick={handleRemove}
          aria-label={`Remove ${displayName}`}
        >
          <X size={size === 'small' ? 12 : size === 'large' ? 16 : 14} />
        </button>
      )}
    </div>
  );
};

/**
 * DietTypeBadgeGroup - Group of diet type badges
 */
export const DietTypeBadgeGroup = ({
  dietTypes = [],
  favorites = [],
  onRemove = null,
  size = 'medium',
  variant = 'default',
  maxDisplay = null,
  className = ''
}) => {
  // Canonical names, one per key, blanks ("Not Specified") dropped
  const uniqueTypes = normalizeDietTypeList(dietTypes);
  const favoriteKeys = new Set((favorites || []).map(dietTypeKey));
  const displayTypes = maxDisplay ? uniqueTypes.slice(0, maxDisplay) : uniqueTypes;
  const remainingCount = maxDisplay && uniqueTypes.length > maxDisplay
    ? uniqueTypes.length - maxDisplay
    : 0;

  if (uniqueTypes.length === 0) {
    return null;
  }

  return (
    <div className={`diet-type-badge-group ${className}`}>
      {displayTypes.map((dietType) => (
        <DietTypeBadge
          key={dietType}
          name={dietType}
          isFavorite={favoriteKeys.has(dietTypeKey(dietType))}
          onRemove={onRemove}
          size={size}
          variant={variant}
        />
      ))}
      {remainingCount > 0 && (
        <div className={`more-badge ${size} ${variant}`}>
          +{remainingCount} more
        </div>
      )}
    </div>
  );
};

export default DietTypeBadge;
