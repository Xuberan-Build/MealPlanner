import React, { useMemo } from 'react';
import { dietTypeKey } from '../../../utils/dietTypes/normalize';
import { createDietTypeIndex } from '../../../utils/dietTypes/collection';
import './FilterPanel.css';

const FilterPanel = ({
  filters,
  onFilterChange,
  dietTypes = [],
  mealTypes = []
}) => {
  // One checkbox per diet (by key), canonical names: "vegan" / "Vegan " show once as "Vegan".
  const dietOptions = useMemo(() => createDietTypeIndex(dietTypes).names, [dietTypes]);
  const selectedDietKeys = useMemo(
    () => new Set((filters.dietTypes || []).map(dietTypeKey)),
    [filters.dietTypes]
  );

  return (
    <div className="filter-panel">
      <div className="filter-section">
        <h3 className="filter-title">Diet Type</h3>
        <div className="filter-options">
          {dietOptions.map((diet) => (
            <label key={diet} className="filter-option">
              <input
                type="checkbox"
                checked={selectedDietKeys.has(dietTypeKey(diet))}
                onChange={() => {
                  const key = dietTypeKey(diet);
                  const updatedDietTypes = selectedDietKeys.has(key)
                    ? filters.dietTypes.filter(d => dietTypeKey(d) !== key)
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
