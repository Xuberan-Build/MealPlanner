// src/features/shoppingList/components/ShoppingListAutocomplete.js
import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import { categorizeIngredient } from '../../../utils/ingredientCategories';
import styles from './ShoppingListAutocomplete.module.css';

// Fuzzy search function to match ingredients (reused from EnhancedIngredientSelector)
const fuzzyMatch = (text, query) => {
  if (!query) return false;
  
  const pattern = query.split('').map(char =>
    char.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')
  ).join('.*?');
  
  const regex = new RegExp(pattern, 'i');
  return regex.test(text);
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

const ShoppingListAutocomplete = ({ 
  onItemAdd, 
  placeholder = "Add item to shopping list...",
  autoFocus = false 
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);
  const [recentIngredients, setRecentIngredients] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch ingredients from Firestore
  useEffect(() => {
    const fetchIngredients = async () => {
      try {
        setIsLoading(true);
        const ingredientCollection = collection(db, 'ingredients');
        const ingredientSnapshot = await getDocs(ingredientCollection);
        
        const ingredientsList = ingredientSnapshot.docs
          .map(doc => {
            const data = doc.data();
            return typeof data.name === 'string' ? data.name.trim() : null;
          })
          .filter(Boolean);
        
        setAvailableIngredients(ingredientsList);
      } catch (error) {
        console.error('Error fetching ingredients:', error);
        setAvailableIngredients([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchIngredients();
    
    // Load recent ingredients from localStorage
    try {
      const storedRecent = localStorage.getItem('recentShoppingIngredients');
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
        localStorage.setItem('recentShoppingIngredients', JSON.stringify(recentIngredients));
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
        const filteredSuggestions = availableIngredients
          .filter(ingredient => 
            ingredient && fuzzyMatch(ingredient.toLowerCase(), value.toLowerCase())
          )
          .slice(0, 8);
        
        setSuggestions(filteredSuggestions);
      } catch (error) {
        console.error('Error filtering suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  // Add ingredient to shopping list
  const handleAddIngredient = (ingredientName) => {
    if (typeof ingredientName !== 'string') {
      console.error('Invalid ingredient type:', ingredientName);
      return;
    }

    const trimmedIngredient = ingredientName.trim();
    if (!trimmedIngredient) return;

    // Get category information
    const categoryInfo = categorizeIngredient(trimmedIngredient);
    
    // Call the parent's add function with the ingredient and category
    onItemAdd(trimmedIngredient, categoryInfo.category.name);
    
    // Add to recent ingredients if not already there
    if (!recentIngredients.includes(trimmedIngredient)) {
      const updatedRecent = [trimmedIngredient, ...recentIngredients.slice(0, 9)];
      setRecentIngredients(updatedRecent);
    }
    
    // Clear input and suggestions
    setInputValue('');
    setSuggestions([]);
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    if (inputValue.trim()) {
      handleAddIngredient(inputValue);
    }
  };

  // Handle key events
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (suggestions.length > 0) {
        handleAddIngredient(suggestions[0]);
      } else if (inputValue.trim()) {
        handleAddIngredient(inputValue);
      }
    } else if (e.key === 'Escape') {
      setInputValue('');
      setSuggestions([]);
    }
  };

  return (
    <div className={styles.autocompleteContainer}>
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <div className={styles.inputWrapper}>
          <input
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={styles.input}
            autoFocus={autoFocus}
            disabled={isLoading}
          />
          {inputValue && (
            <button
              type="submit"
              className={styles.addButton}
              aria-label="Add item"
            >
              +
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
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

        {/* Recent Ingredients */}
        {suggestions.length === 0 && inputValue.length === 0 && recentIngredients.length > 0 && (
          <div className={styles.recentIngredients}>
            <h4 className={styles.recentTitle}>Recent Items</h4>
            <div className={styles.recentList}>
              {recentIngredients.slice(0, 6).map((ingredient, index) => (
                <button
                  key={index}
                  type="button"
                  className={styles.recentItem}
                  onClick={() => handleAddIngredient(ingredient)}
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>
        )}
      </form>
    </div>
  );
};

export default ShoppingListAutocomplete;