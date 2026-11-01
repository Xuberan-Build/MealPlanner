import React, { useState, useEffect } from 'react';
import { auth } from '../../../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import dietTypeService from '../../../../services/dietTypeService';
import { dietTypeNames } from '../../../../utils/dietTypeNames';
import TypeSelector from '../../components/TypeSelector';
import styles from './DietTypeDropdown.module.css';

/**
 * Single diet type picker for the recipe form. Same smart typeahead as Recipe Details
 * (TypeSelector in diet mode): ranks the user's diet types + the curated list, understands
 * aliases ("GF" -> Gluten-Free), offers "Did you mean …?" for typos and "Create" only when
 * nothing is close. The committed value is canonical; a brand-new value is saved as the
 * user's custom diet type (the service returns the existing one if the key already exists).
 *
 * Props: dietType (string), setDietType(value)
 */
const DietTypeDropdown = ({ dietType, setDietType, label = 'Diet Type', placeholder = 'Select or type diet type...' }) => {
  const [user, setUser] = useState(null);
  const [userDietTypes, setUserDietTypes] = useState([]);
  const [justAdded, setJustAdded] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    dietTypeService.getDietTypes(user?.uid)
      .then((types) => { if (!cancelled) setUserDietTypes(dietTypeNames(types)); })
      .catch((error) => console.error('Error loading diet types:', error));
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (!justAdded) return undefined;
    const timer = setTimeout(() => setJustAdded(''), 2000);
    return () => clearTimeout(timer);
  }, [justAdded]);

  const handleCommit = async (value, { isNew }) => {
    if (!isNew || !value || !user) return;
    const saved = await dietTypeService.addCustomDietType(user.uid, value);
    if (saved) {
      setUserDietTypes((prev) => dietTypeNames([...prev, saved]));
      if (!saved.existing) setJustAdded(saved.name);
    }
  };

  return (
    <div className={styles.selectContainer}>
      <TypeSelector
        mode="diet"
        value={dietType}
        onChange={setDietType}
        onCommit={handleCommit}
        options={userDietTypes}
        label={label}
        placeholder={placeholder}
      />
      {justAdded && (
        <span className={styles.added} role="status">Added &ldquo;{justAdded}&rdquo; to your diet types</span>
      )}
    </div>
  );
};

export default DietTypeDropdown;
