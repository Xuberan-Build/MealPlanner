import React from 'react';
import './FilterPanel.css';

const FilterPanel = ({ 
  filters, 
  onFilterChange, 
  dietTypes, 
  mealTypes 
}) => {
  return (
    <div className="filter-panel">
      <div className="filter-section">
        <h3 className="filter-title">Diet Type</h3>
        <div className="filter-options">
          {dietTypes.map((diet) => (
            <label key={diet} className="filter-option">
              <input
                type="checkbox"
                checked={filters.dietTypes.includes(diet)}
                onChange={() => {
                  const updatedDietTypes = filters.dietTypes.includes(diet)
                    ? filters.dietTypes.filter(d => d !== diet)
                    : [...filters.dietTypes, diet];
                  onFilterChange({
                    ...filters,
                    dietTypes: updatedDietTypes
                  });
                }}
              />
              <span>{diet}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <h3 className="filter-title">Meal Type</h3>
        <div className="filter-options">
          {mealTypes.map((meal) => (
            <label key={meal} className="filter-option">
              <input
                type="checkbox"
                checked={filters.mealTypes.includes(meal)}
                onChange={() => {
                  const updatedMealTypes = filters.mealTypes.includes(meal)
                    ? filters.mealTypes.filter(m => m !== meal)
                    : [...filters.mealTypes, meal];
                  onFilterChange({
                    ...filters,
                    mealTypes: updatedMealTypes
                  });
                }}
              />
              <span>{meal}</span>
            </label>
          ))}
        </div>
      </div>
      
      <button 
        className="reset-filters-button"
        onClick={() => onFilterChange({ dietTypes: [], mealTypes: [] })}
      >
        Reset Filters
      </button>
    </div>
  );
};

export default FilterPanel;
