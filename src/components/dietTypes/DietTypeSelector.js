import React, { useState, useRef, useEffect } from 'react';
import { useDietTypes, useDietTypePreferences } from '../../hooks/useDietTypes';
import { X, ChevronDown, Star, Search } from 'lucide-react';
import { canonicalDietType, dietTypeKey, normalizeDietTypeList } from '../../utils/dietTypes/normalize';
import { suggestDietTypes } from '../../utils/dietTypes/suggest';
import './DietTypeSelector.css';

/**
 * DietTypeSelector - Multi-select component for diet types
 * Features:
 * - Multi-select with visual badges
 * - Autocomplete search
 * - Favorites shown first
 * - Keyboard navigation
 * - Smart matching: aliases ("GF" -> Gluten-Free), typo "Did you mean …?", and
 *   "Add 'X'" only when nothing is close. Values are emitted canonical and deduped by key.
 */
const DietTypeSelector = ({
  selectedDietTypes = [],
  onChange,
  placeholder = 'Select diet types...',
  maxSelections = null,
  showFavorites = true,
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Hooks
  const {
    dietTypes: allDietTypes,
    loading
  } = useDietTypes({ visibleOnly: true });

  const { isFavorite } = useDietTypePreferences();

  // Selected values, canonical and one per key ("vegan" + "Vegan " -> ["Vegan"])
  const selected = React.useMemo(() => normalizeDietTypeList(selectedDietTypes), [selectedDietTypes]);
  const selectedKeys = React.useMemo(() => new Set(selected.map(dietTypeKey)), [selected]);

  const suggestion = React.useMemo(
    () => (searchTerm.trim() ? suggestDietTypes(searchTerm, allDietTypes, { limit: 20 }) : null),
    [searchTerm, allDietTypes]
  );
  const didYouMean = suggestion && suggestion.didYouMean && !selectedKeys.has(dietTypeKey(suggestion.didYouMean))
    ? suggestion.didYouMean
    : null;
  const createName = suggestion && suggestion.showCreate && !selectedKeys.has(dietTypeKey(suggestion.createName))
    ? suggestion.createName
    : null;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort diet types
  const filteredDietTypes = React.useMemo(() => {
    if (suggestion) {
      // Ranked matches (user types + curated list), already selected removed
      const byKey = new Map(allDietTypes.map(dt => [dietTypeKey(dt.name), dt]));
      return suggestion.suggestions
        .filter(s => !s.isNew && s.name !== suggestion.didYouMean && !selectedKeys.has(dietTypeKey(s.name)))
        .map(s => byKey.get(dietTypeKey(s.name)) || { id: `canonical-${dietTypeKey(s.name)}`, name: s.name });
    }

    // Remove already selected
    let types = allDietTypes.filter(dt => !selectedKeys.has(dietTypeKey(dt.name)));

    // Sort: favorites first, then alphabetically
    if (showFavorites) {
      types.sort((a, b) => {
        const aFav = isFavorite(a.id);
        const bFav = isFavorite(b.id);
        if (aFav && !bFav) return -1;
        if (!aFav && bFav) return 1;
        return a.name.localeCompare(b.name);
      });
    } else {
      types.sort((a, b) => a.name.localeCompare(b.name));
    }

    return types;
  }, [allDietTypes, suggestion, selectedKeys, showFavorites, isFavorite]);

  // Keyboard-navigable rows: did-you-mean, matches, then "Add 'X'"
  const navItems = React.useMemo(() => [
    ...(didYouMean ? [didYouMean] : []),
    ...filteredDietTypes.map(dt => dt.name),
    ...(createName ? [createName] : [])
  ], [didYouMean, filteredDietTypes, createName]);
  const offset = didYouMean ? 1 : 0;

  // Favorites for quick access
  const favoriteDietTypes = React.useMemo(() => {
    return allDietTypes
      .filter(dt => isFavorite(dt.id) && !selectedKeys.has(dietTypeKey(dt.name)))
      .slice(0, 5);
  }, [allDietTypes, isFavorite, selectedKeys]);

  // Handle selection (stored canonical, never twice)
  const handleSelect = (dietTypeName) => {
    if (maxSelections && selected.length >= maxSelections) {
      return;
    }
    const name = canonicalDietType(dietTypeName);
    if (!name) return;

    onChange(selectedKeys.has(dietTypeKey(name)) ? selected : [...selected, name]);
    setSearchTerm('');
    setFocusedIndex(0);
    inputRef.current?.focus();
  };

  // Handle removal (every spelling of it)
  const handleRemove = (dietTypeName) => {
    const key = dietTypeKey(dietTypeName);
    onChange(selected.filter(dt => dietTypeKey(dt) !== key));
  };

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, navItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (navItems[focusedIndex]) {
          handleSelect(navItems[focusedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchTerm('');
        break;
      default:
        break;
    }
  };

  // Scroll focused item into view
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const focusedElement = dropdownRef.current.querySelector('.dropdown-item.focused');
      if (focusedElement && typeof focusedElement.scrollIntoView === 'function') {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, isOpen]);

  const canAddMore = !maxSelections || selected.length < maxSelections;

  return (
    <div className={`diet-type-selector ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      {/* Selected Badges */}
      <div className="selected-badges">
        {selected.map((dietType) => (
          <div key={dietType} className="diet-badge">
            <span>{dietType}</span>
            {!disabled && (
              <button
                type="button"
                className="remove-badge"
                onClick={() => handleRemove(dietType)}
                aria-label={`Remove ${dietType}`}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ))}

        {/* Input Field */}
        {canAddMore && !disabled && (
          <div className="input-wrapper">
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
                setFocusedIndex(0);
              }}
              onFocus={() => setIsOpen(true)}
              onKeyDown={handleKeyDown}
              placeholder={selected.length === 0 ? placeholder : ''}
              className="search-input"
              disabled={disabled}
            />
            <ChevronDown
              size={18}
              className={`dropdown-icon ${isOpen ? 'open' : ''}`}
            />
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="dropdown-menu">
          {loading ? (
            <div className="dropdown-loading">Loading...</div>
          ) : (
            <>
              {/* Quick Favorites */}
              {showFavorites && favoriteDietTypes.length > 0 && !searchTerm && (
                <div className="favorites-section">
                  <div className="section-header">
                    <Star size={14} fill="currentColor" />
                    <span>Favorites</span>
                  </div>
                  {favoriteDietTypes.map((dietType) => (
                    <button
                      key={dietType.id}
                      type="button"
                      className="dropdown-item favorite"
                      onClick={() => handleSelect(dietType.name)}
                    >
                      <span>{dietType.name}</span>
                      {dietType.recipeCount > 0 && (
                        <span className="recipe-count">{dietType.recipeCount}</span>
                      )}
                    </button>
                  ))}
                  {filteredDietTypes.length > 0 && <div className="divider" />}
                </div>
              )}

              {/* Near miss: offer the existing type instead of a duplicate */}
              {didYouMean && (
                <button
                  type="button"
                  className={`dropdown-item did-you-mean ${focusedIndex === 0 ? 'focused' : ''}`}
                  onClick={() => handleSelect(didYouMean)}
                  onMouseEnter={() => setFocusedIndex(0)}
                >
                  <span>Did you mean <strong>{didYouMean}</strong>?</span>
                </button>
              )}

              {/* Filtered Results */}
              {filteredDietTypes.length > 0 ? (
                <div className="results-section">
                  {searchTerm && (
                    <div className="section-header">
                      <Search size={14} />
                      <span>Results</span>
                    </div>
                  )}
                  {filteredDietTypes.map((dietType, index) => (
                    <button
                      key={dietType.id}
                      type="button"
                      className={`dropdown-item ${index + offset === focusedIndex ? 'focused' : ''}`}
                      onClick={() => handleSelect(dietType.name)}
                      onMouseEnter={() => setFocusedIndex(index + offset)}
                    >
                      <span>{dietType.name}</span>
                      {dietType.recipeCount > 0 && (
                        <span className="recipe-count">{dietType.recipeCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : !didYouMean && !createName ? (
                <div className="dropdown-empty">
                  {searchTerm
                    ? `No diet types match "${searchTerm}"`
                    : 'No more diet types available'}
                </div>
              ) : null}

              {/* Nothing close: allow a new custom type */}
              {createName && (
                <button
                  type="button"
                  className={`dropdown-item create-new ${focusedIndex === navItems.length - 1 ? 'focused' : ''}`}
                  onClick={() => handleSelect(createName)}
                  onMouseEnter={() => setFocusedIndex(navItems.length - 1)}
                >
                  <span>Add &ldquo;{createName}&rdquo;</span>
                </button>
              )}

              {/* Max Selections Info */}
              {maxSelections && (
                <div className="dropdown-footer">
                  {selected.length} / {maxSelections} selected
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Max Selections Message */}
      {maxSelections && selected.length >= maxSelections && (
        <div className="max-selections-message">
          Maximum {maxSelections} diet type{maxSelections !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

export default DietTypeSelector;
