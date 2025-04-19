import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import UserInfoSection from './components/UserInfoSection';
import DietaryPreferencesSection from './components/DietaryPreferencesSection';
import styles from './ProfilePage.module.css';

/**
 * ProfilePage Component
 * 
 * Main profile page that displays user information and dietary preferences.
 * Manages loading of user data and saving updates.
 */
const ProfilePage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  const [error, setError] = useState(null);

  // Fetch user data when component mounts
  useEffect(() => {
    // Simulate API call to fetch user data
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // In a real app, this would be an API call to your backend
        // For now, we'll use mock data
        const mockUserData = {
          id: "user123",
          name: "Jane Doe",
          email: "jane@example.com",
          profileImage: "",
          dietaryPreferences: {
            restrictions: ["Gluten-Free", "Dairy-Free"],
            cuisinePreferences: ["Mediterranean", "Asian", "Mexican"],
            calorieGoal: 2000,
            macros: {
                protein: 30, // percentage
                carbs: 40,
                fat: 30
              }
            }
          };
          
          // Set the user data in state
          setUserData(mockUserData);
          setIsLoading(false);
        } catch (error) {
          console.error('Error fetching user data:', error);
          setError('Failed to load profile data. Please try again later.');
          setIsLoading(false);
        }
      };
  
      fetchUserData();
    }, []);
  
    // Handle updates to user info section
    const handleUserInfoUpdate = (updatedUserInfo) => {
      // In a real app, this would save to your backend
      setUserData({
        ...userData,
        ...updatedUserInfo
      });
    };
  
    // Handle updates to dietary preferences section
    const handleDietaryUpdate = (updatedDietaryPreferences) => {
      // In a real app, this would save to your backend
      setUserData({
        ...userData,
        dietaryPreferences: updatedDietaryPreferences
      });
    };
  
    // Show loading state
    if (isLoading) {
      return (
        <div className={styles.container}>
          <Header />
          <main className={styles.main}>
            <div className={styles.loadingContainer}>
              <p>Loading profile...</p>
            </div>
          </main>
          <BottomNav />
        </div>
      );
    }
  
    // Show error state
    if (error) {
      return (
        <div className={styles.container}>
          <Header />
          <main className={styles.main}>
            <div className={styles.errorContainer}>
              <p>{error}</p>
              <button 
                className={styles.retryButton}
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          </main>
          <BottomNav />
        </div>
      );
    }
  
    return (
      <div className={styles.container}>
        <Header />
        <main className={styles.main}>
          <h1 className={styles.pageTitle}>My Profile</h1>
          
          <UserInfoSection 
            userData={userData} 
            onUpdate={handleUserInfoUpdate} 
          />
          
          <DietaryPreferencesSection 
            dietaryData={userData.dietaryPreferences}
            onUpdate={handleDietaryUpdate}
          />
        </main>
        <BottomNav />
      </div>
    );
  };
  
  export default ProfilePage;