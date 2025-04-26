import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Account.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { auth } from '../../firebase'; // Import Firebase auth
import { signOut } from 'firebase/auth'; // Import Firebase sign out function
const Account = () => {
  const navigate = useNavigate();
  const [isEditing, setIsEditing] = useState(false);
  const [userData, setUserData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    dietaryPreferences: ['Vegetarian', 'Gluten-Free'],
    allergies: ['Peanuts', 'Shellfish']
  });
  const [formData, setFormData] = useState({...userData});
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // Available dietary options for the user to select
  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 
    'Low-Carb', 'Gluten-Free', 'Dairy-Free'
  ];
  
  // Common allergies for the user to select
  const commonAllergies = [
    'Peanuts', 'Tree Nuts', 'Milk', 'Eggs', 'Wheat', 
    'Soy', 'Fish', 'Shellfish', 'Sesame'
  ];

  // Simulate fetching user data
  useEffect(() => {
    // In a real app, you would fetch user data from your API/service
    const fetchUserData = async () => {
      try {
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // For now, we're using mock data that's already in state
        setIsLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Enable editing mode
  const handleEdit = () => {
    setFormData({...userData});
    setIsEditing(true);
    setSaveSuccess(false);
  };

  // Cancel editing and reset form data
  const handleCancel = () => {
    setIsEditing(false);
    setFormData({...userData});
  };

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle preference changes (checkboxes)
  const handlePreferenceChange = (e, type) => {
    const { value, checked } = e.target;
    
    if (checked) {
      setFormData({
        ...formData,
        [type]: [...formData[type], value]
      });
    } else {
      setFormData({
        ...formData,
        [type]: formData[type].filter(item => item !== value)
      });
    }
  };

  // Save user profile changes
  const handleSave = async () => {
    try {
      // Here you would call your API to update the user profile
      // For now, we'll simulate a successful update
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Update local user data state
      setUserData({...formData});
      setIsEditing(false);
      setSaveSuccess(true);
      
      // Hide success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      // Handle error (show error message, etc.)
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth); // Sign the user out using Firebase Auth
      console.log('User logged out successfully');
      navigate('/login'); // Redirect to login page after successful logout
    } catch (error) {
      console.error('Error logging out:', error);
      // Optionally: Show an error message to the user
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <div className={styles.loading}>Loading profile...</div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <div className={styles.profileHeader}>
          <h1 className={styles.title}>My Account</h1>
          {!isEditing ? (
            <button 
              className={styles.editButton} 
              onClick={handleEdit}
            >
              Edit Profile
            </button>
          ) : (
            <div className={styles.editActions}>
              <button 
                className={styles.cancelButton} 
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button 
                className={styles.saveButton} 
                onClick={handleSave}
              >
                Save Changes
              </button>
            </div>
          )}
        </div>

        {saveSuccess && (
          <div className={styles.successMessage}>
            Profile updated successfully!
          </div>
        )}

        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>Personal Information</h2>
          <div className={styles.profileInfo}>
            {isEditing ? (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>Full Name</label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.label}>Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={styles.input}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Name:</span>
                  <span className={styles.infoValue}>{userData.name}</span>
                </div>
                <div className={styles.infoItem}>
                  <span className={styles.infoLabel}>Email:</span>
                  <span className={styles.infoValue}>{userData.email}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>Dietary Preferences</h2>
          <div className={styles.preferencesSection}>
            {isEditing ? (
              <div className={styles.checkboxGrid}>
                {dietaryOptions.map(option => (
                  <label key={option} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="dietaryPreferences"
                      value={option}
                      checked={formData.dietaryPreferences.includes(option)}
                      onChange={(e) => handlePreferenceChange(e, 'dietaryPreferences')}
                      className={styles.checkbox}
                    />
                    {option}
                  </label>
                ))}
              </div>
            ) : (
              <div className={styles.tagContainer}>
                {userData.dietaryPreferences.map(pref => (
                  <span key={pref} className={styles.tag}>{pref}</span>
                ))}
                {userData.dietaryPreferences.length === 0 && 
                  <span className={styles.emptyState}>No dietary preferences selected</span>
                }
              </div>
            )}
          </div>
        </div>

        <div className={styles.profileSection}>
          <h2 className={styles.sectionTitle}>Allergies</h2>
          <div className={styles.allergiesSection}>
            {isEditing ? (
              <div className={styles.checkboxGrid}>
                {commonAllergies.map(allergy => (
                  <label key={allergy} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      name="allergies"
                      value={allergy}
                      checked={formData.allergies.includes(allergy)}
                      onChange={(e) => handlePreferenceChange(e, 'allergies')}
                      className={styles.checkbox}
                    />
                    {allergy}
                  </label>
                ))}
              </div>
            ) : (
              <div className={styles.tagContainer}>
                {userData.allergies.map(allergy => (
                  <span key={allergy} className={styles.tag}>{allergy}</span>
                ))}
                {userData.allergies.length === 0 && 
                  <span className={styles.emptyState}>No allergies selected</span>
                }
              </div>
            )}
          </div>
        </div>

        <button 
          className={styles.logoutButton}
          onClick={handleLogout}
        >
          Logout
        </button>
      </main>
      <BottomNav />
    </div>
  );
};

export default Account;
