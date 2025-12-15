import React, { useState, useRef, useEffect } from 'react';
import { useDietTypes, useDietTypePreferences } from '../../hooks/useDietTypes';
import { X, ChevronDown, Star, Search } from 'lucide-react';
import './DietTypeSelector.css';

/**
 * DietTypeSelector - Multi-select component for diet types
 * Features:
 * - Multi-select with visual badges
 * - Autocomplete search
 * - Favorites shown first
 * - Keyboard navigation
 * - Clean, intuitive UX
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
    loading,
    searchDietTypes
  } = useDietTypes({ visibleOnly: true });

  const { isFavorite } = useDietTypePreferences();

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
    let types = searchTerm ? searchDietTypes(searchTerm, allDietTypes) : allDietTypes;

    // Remove already selected
    types = types.filter(dt => !selectedDietTypes.includes(dt.name));

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
  }, [allDietTypes, searchTerm, selectedDietTypes, showFavorites, isFavorite, searchDietTypes]);

  // Favorites for quick access
  const favoriteDietTypes = React.useMemo(() => {
    return allDietTypes
      .filter(dt => isFavorite(dt.id) && !selectedDietTypes.includes(dt.name))
      .slice(0, 5);
  }, [allDietTypes, isFavorite, selectedDietTypes]);

  // Handle selection
  const handleSelect = (dietTypeName) => {
    if (maxSelections && selectedDietTypes.length >= maxSelections) {
      return;
    }

    onChange([...selectedDietTypes, dietTypeName]);
    setSearchTerm('');
    setFocusedIndex(0);
    inputRef.current?.focus();
  };

  // Handle removal
  const handleRemove = (dietTypeName) => {
    onChange(selectedDietTypes.filter(dt => dt !== dietTypeName));
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
        setFocusedIndex(prev => Math.min(prev + 1, filteredDietTypes.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredDietTypes[focusedIndex]) {
          handleSelect(filteredDietTypes[focusedIndex].name);
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
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex, isOpen]);

  const canAddMore = !maxSelections || selectedDietTypes.length < maxSelections;

  return (
    <div className={`diet-type-selector ${disabled ? 'disabled' : ''}`} ref={dropdownRef}>
      {/* Selected Badges */}
      <div className="selected-badges">
        {selectedDietTypes.map((dietType) => (
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
              placeholder={selectedDietTypes.length === 0 ? placeholder : ''}
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
                      className={`dropdown-item ${index === focusedIndex ? 'focused' : ''}`}
                      onClick={() => handleSelect(dietType.name)}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      <span>{dietType.name}</span>
                      {dietType.recipeCount > 0 && (
                        <span className="recipe-count">{dietType.recipeCount}</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dropdown-empty">
                  {searchTerm
                    ? `No diet types match "${searchTerm}"`
                    : 'No more diet types available'}
                </div>
              )}

              {/* Max Selections Info */}
              {maxSelections && (
                <div className="dropdown-footer">
                  {selectedDietTypes.length} / {maxSelections} selected
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Max Selections Message */}
      {maxSelections && selectedDietTypes.length >= maxSelections && (
        <div className="max-selections-message">
          Maximum {maxSelections} diet type{maxSelections !== 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
};

export default DietTypeSelector;
