import React, { useState } from 'react';
import styles from '../ProfilePage.module.css';

/**
 * UserInfoSection Component
 * 
 * Displays and manages a user's personal information including name,
 * email, and profile image.
 * 
 * @param {Object} userData - The user's personal information
 * @param {Function} onUpdate - Function to call when user data is updated
 */
const UserInfoSection = ({ userData, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: userData.name,
    email: userData.email,
    profileImage: userData.profileImage
  });
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };
  
  const handleSave = () => {
    // Basic validation
    if (!formData.name.trim()) {
      alert('Name cannot be empty');
      return;
    }
    
    if (!formData.email.includes('@') || !formData.email.includes('.')) {
      alert('Please enter a valid email address');
      return;
    }
    
    onUpdate(formData);
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setFormData({
      name: userData.name,
      email: userData.email,
      profileImage: userData.profileImage
    });
    setIsEditing(false);
  };

  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeader}>
        <h2>Personal Information</h2>
        {!isEditing ? (
          <button 
            className={styles.editButton}
            onClick={() => setIsEditing(true)}
          >
            Edit
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
              Save
            </button>
          </div>
        )}
      </div>

      <div className={styles.sectionContent}>
        <div className={styles.userInfoContainer}>
          <div className={styles.profileImageContainer}>
            {userData.profileImage ? (
              <img 
                src={userData.profileImage} 
                alt={`${userData.name}'s profile`} 
                className={styles.profileImage}
              />
            ) : (
              <div className={styles.profileImagePlaceholder}>
                {userData.name.charAt(0).toUpperCase()}
              </div>
            )}
            {isEditing && (
              <button className={styles.changeImageButton}>
                Change Image
              </button>
            )}
          </div>
          
          <div className={styles.userDetails}>
            {!isEditing ? (
              // View mode
              <>
                <h3>{userData.name}</h3>
                <p>{userData.email}</p>
              </>
            ) : (
              // Edit mode
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.inputLabel}>Name</label>
                  <input
                    id="name"
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={styles.textInput}
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="email" className={styles.inputLabel}>Email</label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={styles.textInput}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default UserInfoSection;