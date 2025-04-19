import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase';
import {
  categorizeIngredient
} from '../../../../utils/ingredientCategories';
import { UNIT_CONVERSIONS } from '../../../../utils/quantityNormalizer';
import styles from './EnhancedIngredientSelector.module.css';

// Fuzzy search function to match ingredients
const fuzzyMatch = (text, query) => {
  if (!query) return false;
  
  const pattern = query.split('').map(char =>
    char.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  ).join('.*?');
  
  const regex = new RegExp(pattern, 'i');
  return regex.test(text);
};

const EnhancedIngredientSelector = ({ selectedIngredients, setSelectedIngredients }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [recentIngredients, setRecentIngredients] = useState([]);
  const [showCategorized, setShowCategorized] = useState(false);
  
  // Get all available units from the UNIT_CONVERSIONS object
  const availableUnits = useMemo(() => {
    const units = [];
    for (const category in UNIT_CONVERSIONS) {
      for (const unit in UNIT_CONVERSIONS[category]) {
        units.push({ value: unit, label: unit, category });
      }
    }
    return units;
  }, []);
  
  // Group units by category for the dropdown
  const unitsByCategory = useMemo(() => {
    const grouped = {
      volume: [],
      weight: [],
      units: []
    };
    
    availableUnits.forEach(unit => {
      if (grouped[unit.category]) {
        grouped[unit.category].push(unit);
      }
    });
    
    return grouped;
  }, [availableUnits]);
  
  // Fetch ingredients from Firestore
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        const ingredientCollection = collection(db, 'ingredients');
        const ingredientSnapshot = await getDocs(ingredientCollection);
        
        // Improved ingredient data handling
        const ingredientsList = ingredientSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return typeof data.name === 'string' ? data.name.trim() : null;
          })
          .filter(Boolean); // Remove any null/undefined values
        
        setAvailableIngredients(ingredientsList);
      } catch (error) {
        console.error('Error fetching ingredients:', error);
        setAvailableIngredients([]); // Set empty array on error
      }
    };

    fetchIngredients();
    
    // Load recent ingredients from localStorage
    try {
      const storedRecent = localStorage.getItem('recentIngredients');
      if (storedRecent) {
        setRecentIngredients(JSON.parse(storedRecent));
      }
    } catch (error) {
      console.error('Error loading recent ingredients:', error);
    }
  }, []);
  
  // Save recent ingredients to localStorage when they change
  useEffect(() => {
    if (recentIngredients.length > 0) {
      try {
        localStorage.setItem('recentIngredients', JSON.stringify(recentIngredients));
      } catch (error) {
        console.error('Error saving recent ingredients:', error);
      }
    }
  }, [recentIngredients]);
  
  // Handle input change for ingredient search
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length > 0) {
      try {
        // Use fuzzy search instead of just startsWith
        const filteredSuggestions = availableIngredients
          .filter(ingredient => 
            ingredient && fuzzyMatch(ingredient.toLowerCase(), value.toLowerCase())
          )
          .slice(0, 8); // Show more matches
        
        setSuggestions(filteredSuggestions);
      } catch (error) {
        console.error('Error filtering suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };
  
  // Add a new ingredient
  const handleAddIngredient = (ingredient) => {
    if (typeof ingredient !== 'string') {
      console.error('Invalid ingredient type:', ingredient);
      return;
    }

    const trimmedIngredient = ingredient.trim();
    if (!trimmedIngredient) return;

    // Check if ingredient already exists by ingredientId
    const ingredientExists = selectedIngredients.some(
      item => typeof item === 'object' && item.ingredientId === trimmedIngredient
    );

    if (!ingredientExists) {
      // Get category information safely
      const categoryInfo = categorizeIngredient(trimmedIngredient);
      
      // Create a new ingredient object
      const newIngredient = {
        ingredientId: trimmedIngredient,
        amount: '',
        unit: ''
      };
      
      setSelectedIngredients([...selectedIngredients, newIngredient]);
      
      // Add to recent ingredients if not already there
      if (!recentIngredients.includes(trimmedIngredient)) {
        const updatedRecent = [trimmedIngredient, ...recentIngredients.slice(0, 9)];
        setRecentIngredients(updatedRecent);
      }
    }
    
    setInputValue('');
    setSuggestions([]);
  };
  
  // Handle changes to ingredient fields
  const handleIngredientFieldChange = (index, field, value) => {
    const updatedIngredients = [...selectedIngredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      [field]: value
    };
    setSelectedIngredients(updatedIngredients);
  };
  
  // Remove an ingredient
  const handleRemoveIngredient = (index) => {
    const updatedIngredients = selectedIngredients.filter((_, i) => i !== index);
    setSelectedIngredients(updatedIngredients);
  };
  
  // Group ingredients by category for display
  const groupedIngredients = useMemo(() => {
    if (!showCategorized) return { ungrouped: selectedIngredients };
    
    const grouped = {};
    
    selectedIngredients.forEach(ingredient => {
      const { category } = categorizeIngredient(ingredient.ingredientId);
      const categoryName = category.name;
      
      if (!grouped[categoryName]) {
        grouped[categoryName] = [];
      }
      
      grouped[categoryName].push(ingredient);
    });
    
    return grouped;
  }, [selectedIngredients, showCategorized]);
  
  // Render the ingredient list based on grouping
  const renderIngredientList = () => {
    if (!showCategorized) {
      return (
        <div className={styles.selectedIngredients}>
          {selectedIngredients.map((ingredient, index) => (
            renderIngredientItem(ingredient, index)
          ))}
        </div>
      );
    }
    
    return (
      <div className={styles.categorizedIngredients}>
        {Object.entries(groupedIngredients).map(([category, ingredients]) => (
          ingredients.length > 0 && (
            <div key={category} className={styles.categoryGroup}>
              <h4 className={styles.categoryTitle}>{category}</h4>
              <div className={styles.selectedIngredients}>
                {ingredients.map((ingredient, index) => {
                  // Find the actual index in the original array
                  const originalIndex = selectedIngredients.findIndex(
                    item => item === ingredient
                  );
                  return renderIngredientItem(ingredient, originalIndex);
                })}
              </div>
            </div>
          )
        ))}
      </div>
    );
  };
  
  // Render an individual ingredient item
  const renderIngredientItem = (ingredient, index) => (
    <div key={index} className={styles.ingredientItem}>
      <div className={styles.ingredientFields}>
        <input
          type="text"
          className={styles.amountField}
          placeholder="Amount"
          value={ingredient.amount || ''}
          onChange={(e) => handleIngredientFieldChange(index, 'amount', e.target.value)}
        />
        
        <select
          className={styles.unitField}
          value={ingredient.unit || ''}
          onChange={(e) => handleIngredientFieldChange(index, 'unit', e.target.value)}
        >
          <option value="">Unit</option>
          <optgroup label="Volume">
            {unitsByCategory.volume.map(unit => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </optgroup>
          <optgroup label="Weight">
            {unitsByCategory.weight.map(unit => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </optgroup>
          <optgroup label="Count">
            {unitsByCategory.units.map(unit => (
              <option key={unit.value} value={unit.value}>{unit.label}</option>
            ))}
          </optgroup>
        </select>
        
        <input
          type="text"
          className={styles.ingredientNameField}
          placeholder="Ingredient"
          value={ingredient.ingredientId || ''}
          onChange={(e) => handleIngredientFieldChange(index, 'ingredientId', e.target.value)}
        />
      </div>
      <button
        type="button"
        onClick={() => handleRemoveIngredient(index)}
        className={styles.removeButton}
        aria-label="Remove ingredient"
      >
        −
      </button>
    </div>
  );
  
  return (
    <div className={styles.ingredientSelector}>
      <div className={styles.inputWrapper}>
        <div className={styles.inputContainer}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            placeholder="Add or search ingredient..."
            className={styles.input}
            aria-label="Search for ingredients"
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => handleAddIngredient(inputValue)}
              className={styles.addButton}
              aria-label="Add ingredient"
            >
              +
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <ul className={styles.suggestionsList} role="listbox">
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className={styles.suggestionItem}
                onClick={() => handleAddIngredient(suggestion)}
                role="option"
                aria-selected="false"
              >
                <span className={styles.suggestionText}>
                  {highlightMatch(suggestion, inputValue)}
                </span>
                <span className={styles.suggestionCategory}>
                  {categorizeIngredient(suggestion).subcategory}
                </span>
              </li>
            ))}
          </ul>
        )}
        
        {suggestions.length === 0 && inputValue.length === 0 && recentIngredients.length > 0 && (
          <div className={styles.recentIngredients}>
            <h4 className={styles.recentTitle}>Recent Ingredients</h4>
            <div className={styles.recentList}>
              {recentIngredients.map((ingredient, index) => (
                <button
                  key={index}
                  className={styles.recentItem}
                  onClick={() => handleAddIngredient(ingredient)}
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      
      <div className={styles.ingredientListControls}>
        <div className={styles.ingredientCount}>
          {selectedIngredients.length} {selectedIngredients.length === 1 ? 'ingredient' : 'ingredients'}
        </div>
        <button
          type="button"
          className={`${styles.groupToggle} ${showCategorized ? styles.active : ''}`}
          onClick={() => setShowCategorized(!showCategorized)}
        >
          {showCategorized ? 'Show List View' : 'Group by Category'}
        </button>
        {selectedIngredients.length > 0 && (
          <button
            type="button"
            className={styles.clearAllButton}
            onClick={() => setSelectedIngredients([])}
          >
            Clear All
          </button>
        )}
      </div>
      
      {renderIngredientList()}
      
      <button
        type="button"
        className={styles.addIngredientButton}
        onClick={() => handleAddIngredient('New Ingredient')}
      >
        + Add Ingredient
      </button>
    </div>
  );
};

// Helper function to highlight matching parts of suggestions
const highlightMatch = (text, query) => {
  if (!query) return text;
  
  try {
    const pattern = query.split('').map(char =>
      char.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
    ).join('.*?');
    
    const regex = new RegExp(`(${pattern})`, 'i');
    const parts = text.split(regex);
    
    return parts.map((part, i) => 
      regex.test(part) ? <strong key={i}>{part}</strong> : part
    );
  } catch (e) {
    return text;
  }
};

export default EnhancedIngredientSelector;