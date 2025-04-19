import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase';
import styles from './IngredientSelector.module.css';

const SimpleIngredientSelector = ({ selectedIngredients, setSelectedIngredients }) => {
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

    // Check if ingredient already exists by ingredientId
    const ingredientExists = selectedIngredients.some(
      item => typeof item === 'object' && item.ingredientId === trimmedIngredient
    );

    if (!ingredientExists) {
      // Create a new ingredient object
      const newIngredient = {
        ingredientId: trimmedIngredient,
        amount: '',
        unit: ''
      };
      setSelectedIngredients([...selectedIngredients, newIngredient]);
    }
    
    setInputValue('');
    setSuggestions([]);
  };

  const handleIngredientFieldChange = (index, field, value) => {
    const updatedIngredients = [...selectedIngredients];
    updatedIngredients[index] = {
      ...updatedIngredients[index],
      [field]: value
    };
    setSelectedIngredients(updatedIngredients);
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
            <div className={styles.ingredientFields}>
              <input
                type="text"
                className={styles.amountField}
                placeholder="Amount"
                value={ingredient.amount || ''}
                onChange={(e) => handleIngredientFieldChange(index, 'amount', e.target.value)}
              />
              <input
                type="text"
                className={styles.unitField}
                placeholder="Unit"
                value={ingredient.unit || ''}
                onChange={(e) => handleIngredientFieldChange(index, 'unit', e.target.value)}
              />
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
            >
              −
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SimpleIngredientSelector;