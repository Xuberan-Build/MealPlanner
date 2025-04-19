import React, { useState, useEffect } from 'react';
import styles from './DietTypeDropdown.module.css';

const DietTypeDropdown = ({ dietType, setDietType, dietTypeOptions = [] }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [customDiet, setCustomDiet] = useState('');
  const [dietOptions, setDietOptions] = useState([
    ...dietTypeOptions,
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low-Carb',
    'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'
  ]);

  useEffect(() => {
    if (dietType && !dietOptions.includes(dietType)) {
      setDietOptions((prev) => [...prev, dietType]);
    }
  }, [dietType]);

  const handleDietSelection = (diet) => {
    setDietType(diet);
    setIsOpen(false);
  };

  const handleAddCustomDiet = () => {
    if (customDiet.trim() && !dietOptions.includes(customDiet)) {
      setDietOptions([...dietOptions, customDiet]);
      setDietType(customDiet);
      setCustomDiet('');
      setIsOpen(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleAddCustomDiet();
  };

  return (
    <div className={styles.selectContainer}>
      <div className={styles.select} onClick={() => setIsOpen(!isOpen)}>
        {dietType || 'Select diet type'}
      </div>

      {isOpen && (
        <div className={styles.optionsContainer}>
          {dietOptions.map((diet, index) => (
            <div
              key={index}
              className={`${styles.option} ${dietType === diet ? styles.selected : ''}`}
              onClick={() => handleDietSelection(diet)}
            >
              {diet}
            </div>
          ))}
          <div className={styles.customInput}>
            <input
              type="text"
              value={customDiet}
              onChange={(e) => setCustomDiet(e.target.value)}
              placeholder="Add custom diet type"
              onKeyDown={handleKeyPress}
            />
            <button onClick={handleAddCustomDiet}>+</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietTypeDropdown;
