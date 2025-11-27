import React, { useState, useEffect } from 'react';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import UserInfoSection from './components/UserInfoSection';
import DietaryPreferencesSection from './components/DietaryPreferencesSection';
import ReferralSection from './components/ReferralSection';
import InviteFriendsModal from '../../components/InviteFriendsModal';
import { auth } from '../../firebase';
import { getUserProfile, saveUserProfile } from '../../services/profileService';
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
  const [showInviteModal, setShowInviteModal] = useState(false);

  // Fetch user data when component mounts
  useEffect(() => {
  const fetchUserData = async () => {
    try {
      setIsLoading(true);

      const user = auth.currentUser;
      if (!user) {
        setError('User not authenticated.');
        setIsLoading(false);
        return;
      }

      const profile = await getUserProfile(user.uid);

      if (profile) {
        setUserData(profile);
      } else {
        // Optional: seed default data if none exists
        const defaultData = {
          id: user.uid,
          name: user.displayName || '',
          email: user.email || '',
          profileImage: '',
          dietaryPreferences: {
            restrictions: [],
            cuisinePreferences: [],
            calorieGoal: 2000,
            macros: { protein: 30, carbs: 40, fat: 30 },
          }
        };
        await saveUserProfile(user.uid, defaultData);
        setUserData(defaultData);
      }

    } catch (error) {
      console.error('Error fetching user data:', error);
      setError('Failed to load profile data. Please try again later.');
    } finally {
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
          
          {userData && (
  <>
    {userData && (
  <>
    <UserInfoSection 
      userData={userData} 
      onUpdate={handleUserInfoUpdate} 
    />

    {userData.dietaryPreferences && (
      <DietaryPreferencesSection 
        dietaryData={userData.dietaryPreferences}
        onUpdate={handleDietaryUpdate}
      />
    )}
  </>
)}

      {userData.dietaryPreferences && (
        <DietaryPreferencesSection 
          dietaryData={userData.dietaryPreferences}
          onUpdate={handleDietaryUpdate}
        />
      )}
    </>
  )}


          <ReferralSection onInviteFriends={() => setShowInviteModal(true)} />
        </main>
        <BottomNav />

        <InviteFriendsModal
          isOpen={showInviteModal}
          onClose={() => setShowInviteModal(false)}
        />
      </div>
    );
  };
  
  export default ProfilePage;