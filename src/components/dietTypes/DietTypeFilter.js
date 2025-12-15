import React, { useState } from 'react';
import { useDietTypes, useDietTypePreferences } from '../../hooks/useDietTypes';
import { Filter, X, Star, Check } from 'lucide-react';
import './DietTypeFilter.css';

/**
 * DietTypeFilter - Multi-select filter panel for recipes
 * Features:
 * - Multi-select filtering
 * - Quick filters (favorites)
 * - Clear all option
 * - Active filter count badge
 * - Clean, intuitive UX
 */
const DietTypeFilter = ({
  selectedFilters = [],
  onChange,
  showQuickFilters = true,
  inline = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Hooks
  const { dietTypes, loading } = useDietTypes({ visibleOnly: true });
  const { favorites, isFavorite } = useDietTypePreferences();

  // Favorite diet types for quick access
  const favoriteDietTypes = React.useMemo(() => {
    return dietTypes.filter(dt => isFavorite(dt.id)).slice(0, 5);
  }, [dietTypes, isFavorite]);

  // Toggle filter selection
  const handleToggle = (dietTypeName) => {
    if (selectedFilters.includes(dietTypeName)) {
      onChange(selectedFilters.filter(f => f !== dietTypeName));
    } else {
      onChange([...selectedFilters, dietTypeName]);
    }
  };

  // Clear all filters
  const handleClearAll = () => {
    onChange([]);
  };

  // Quick filter: Add all favorites
  const handleAddFavorites = () => {
    const favoriteNames = favoriteDietTypes.map(dt => dt.name);
    const newFilters = [...new Set([...selectedFilters, ...favoriteNames])];
    onChange(newFilters);
  };

  const activeFilterCount = selectedFilters.length;

  // Inline mode (horizontal pills)
  if (inline) {
    return (
      <div className="diet-type-filter-inline">
        <div className="filter-pills">
          {dietTypes.map((dietType) => {
            const isActive = selectedFilters.includes(dietType.name);
            const favorite = isFavorite(dietType.id);

            return (
              <button
                key={dietType.id}
                type="button"
                className={`filter-pill ${isActive ? 'active' : ''} ${favorite ? 'favorite' : ''}`}
                onClick={() => handleToggle(dietType.name)}
              >
                {favorite && <Star size={12} fill="currentColor" />}
                {dietType.name}
                {isActive && <Check size={14} />}
              </button>
            );
          })}
        </div>

        {activeFilterCount > 0 && (
          <button
            type="button"
            className="clear-filters-button"
            onClick={handleClearAll}
          >
            Clear ({activeFilterCount})
          </button>
        )}
      </div>
    );
  }

  // Dropdown mode (panel)
  return (
    <div className="diet-type-filter">
      {/* Filter Button */}
      <button
        type="button"
        className={`filter-toggle-button ${activeFilterCount > 0 ? 'has-filters' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Filter size={18} />
        <span>Filter by Diet Type</span>
        {activeFilterCount > 0 && (
          <span className="filter-count-badge">{activeFilterCount}</span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="filter-panel">
          <div className="filter-header">
            <h3>Filter by Diet Type</h3>
            <button
              type="button"
              className="close-panel"
              onClick={() => setIsOpen(false)}
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Quick Filters */}
          {showQuickFilters && favoriteDietTypes.length > 0 && (
            <div className="quick-filters">
              <div className="quick-filter-header">
                <Star size={14} fill="currentColor" />
                <span>Quick Filters</span>
              </div>
              <button
                type="button"
                className="quick-filter-action"
                onClick={handleAddFavorites}
              >
                Add All Favorites ({favoriteDietTypes.length})
              </button>
            </div>
          )}

          {/* Diet Types List */}
          <div className="filter-options">
            {loading ? (
              <div className="loading-state">Loading...</div>
            ) : dietTypes.length === 0 ? (
              <div className="empty-state">No diet types available</div>
            ) : (
              dietTypes.map((dietType) => {
                const isActive = selectedFilters.includes(dietType.name);
                const favorite = isFavorite(dietType.id);

                return (
                  <label
                    key={dietType.id}
                    className={`filter-option ${isActive ? 'active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(dietType.name)}
                      className="filter-checkbox"
                    />
                    <span className="filter-checkbox-custom">
                      {isActive && <Check size={14} />}
                    </span>
                    <span className="filter-label">
                      {favorite && <Star size={12} fill="currentColor" className="favorite-icon" />}
                      {dietType.name}
                    </span>
                    {dietType.recipeCount > 0 && (
                      <span className="filter-count">({dietType.recipeCount})</span>
                    )}
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="filter-footer">
            <button
              type="button"
              className="clear-all-button"
              onClick={handleClearAll}
              disabled={activeFilterCount === 0}
            >
              Clear All
            </button>
            <button
              type="button"
              className="apply-button"
              onClick={() => setIsOpen(false)}
            >
              Apply {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {activeFilterCount > 0 && !isOpen && (
        <div className="active-filters">
          {selectedFilters.map((filter) => (
            <div key={filter} className="active-filter-badge">
              <span>{filter}</span>
              <button
                type="button"
                className="remove-filter"
                onClick={() => handleToggle(filter)}
                aria-label={`Remove ${filter} filter`}
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DietTypeFilter;
