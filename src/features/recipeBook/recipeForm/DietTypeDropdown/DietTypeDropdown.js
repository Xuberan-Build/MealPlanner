import React, { useState, useEffect } from 'react';
import { auth } from '../../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import dietTypeService from '../../../../services/dietTypeService';
import styles from './DietTypeDropdown.module.css';

const DietTypeDropdown = ({ dietType, setDietType }) => {
  const [user, setUser] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [customDiet, setCustomDiet] = useState('');
  const [allDietTypes, setAllDietTypes] = useState([
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 'Low-Carb',
    'Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Halal', 'Kosher'
  ]);
  const [filteredDietTypes, setFilteredDietTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Set up auth state listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // Load diet types when user changes
  useEffect(() => {
    loadDietTypes();
  }, [user]);

  // Filter diet types based on search
  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = dietTypeService.searchDietTypes(searchTerm, allDietTypes);
      setFilteredDietTypes(filtered);
    } else {
      setFilteredDietTypes(allDietTypes);
    }
  }, [searchTerm, allDietTypes]);

  const loadDietTypes = async () => {
    try {
      const types = await dietTypeService.getDietTypes(user?.uid);
      setAllDietTypes(types);
      setFilteredDietTypes(types);
    } catch (error) {
      console.error('Error loading diet types:', error);
    }
  };

  const handleDietSelection = (diet) => {
    setDietType(diet);
    setIsOpen(false);
  };

  const handleAddCustomDiet = async () => {
    if (!customDiet.trim() || !user) return;

    const newDiet = customDiet.trim();
    
    try {
      const success = await dietTypeService.addCustomDietType(user.uid, newDiet);
      
      if (success) {
        await loadDietTypes(); // Refresh the list
        setDietType(newDiet);
        setCustomDiet('');
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Error adding custom diet type:', error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddCustomDiet();
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const displayedTypes = searchTerm.trim() ? filteredDietTypes : allDietTypes;

  return (
    <div className={styles.selectContainer}>
      <div
        className={styles.select}
        onClick={() => setIsOpen(!isOpen)}
      >
        {dietType || 'Select diet type'}
      </div>

      {isOpen && (
        <div className={styles.optionsContainer}>
          {/* Search input at top */}
          <div className={styles.searchContainer}>
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search diet types..."
              className={styles.searchInput}
            />
          </div>

          {/* Grid of diet type options */}
          {displayedTypes.map((diet, index) => (
            <div
              key={index}
              className={`${styles.option} ${dietType === diet ? styles.selected : ''}`}
              onClick={() => handleDietSelection(diet)}
            >
              {diet}
            </div>
          ))}

          {/* Custom diet input */}
          <div className={styles.customInput}>
            <input
              type="text"
              value={customDiet}
              onChange={(e) => setCustomDiet(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Add custom diet type"
            />
            <button onClick={handleAddCustomDiet}>+</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DietTypeDropdown;