import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase';
import styles from './IngredientSelector.module.css';

const IngredientSelector = ({ selectedIngredients, setSelectedIngredients }) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [availableIngredients, setAvailableIngredients] = useState([]);

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
  }, []);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length > 0) {
      try {
        const filteredSuggestions = availableIngredients.filter(ingredient =>
          ingredient && ingredient.toLowerCase().startsWith(value.toLowerCase())
        ).slice(0, 5); // Keep limit to top 5 matches
        setSuggestions(filteredSuggestions);
      } catch (error) {
        console.error('Error filtering suggestions:', error);
        setSuggestions([]);
      }
    } else {
      setSuggestions([]);
    }
  };

  const handleAddIngredient = (ingredient) => {
    if (typeof ingredient !== 'string') {
      console.error('Invalid ingredient type:', ingredient);
      return;
    }

    const trimmedIngredient = ingredient.trim();
    if (!trimmedIngredient) return;

    if (!selectedIngredients.includes(trimmedIngredient)) {
      setSelectedIngredients([...selectedIngredients, trimmedIngredient]);
    }
    setInputValue('');
    setSuggestions([]);
  };

  const handleRemoveIngredient = (index) => {
    const updatedIngredients = selectedIngredients.filter((_, i) => i !== index);
    setSelectedIngredients(updatedIngredients);
  };

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
          />
          {inputValue && (
            <button
              type="button"
              onClick={() => handleAddIngredient(inputValue)}
              className={styles.addButton}
            >
              +
            </button>
          )}
        </div>

        {suggestions.length > 0 && (
          <ul className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <li
                key={index}
                className={styles.suggestionItem}
                onClick={() => handleAddIngredient(suggestion)}
              >
                <span className={styles.suggestionText}>
                  {suggestion.substring(0, inputValue.length)}
                  <strong>{suggestion.substring(inputValue.length)}</strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.selectedIngredients}>
        {selectedIngredients.map((ingredient, index) => (
          <div key={index} className={styles.ingredientItem}>
            <span className={styles.ingredientName}>{ingredient}</span>
            <button
              type="button"
              onClick={() => handleRemoveIngredient(index)}
              className={styles.removeButton}
            >
              −
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IngredientSelector;
