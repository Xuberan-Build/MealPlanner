import React from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Welcome.module.css';
import Header from '../../../components/layout/Header';
import BottomNav from '../../../components/layout/BottomNav';

const Welcome = () => {
  const navigate = useNavigate();

  const handleCreateRecipe = () => {
    navigate('/recipe-book');
  };

  const handlePlanMeals = () => {
    navigate('/meal-planner');
  };

  const handleExplore = () => {
    navigate('/');
  };

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <div className={styles.welcomeCard}>
          <h1 className={styles.title}>Welcome to Meal Planner!</h1>
          <p className={styles.message}>
            Your account has been created successfully. You're all set to start planning nutritious and delicious meals that match your dietary preferences.
          </p>
          
          <h2 className={styles.subtitle}>What would you like to do first?</h2>
          
          <div className={styles.actionButtons}>
            <button 
              className={styles.actionButton}
              onClick={handleCreateRecipe}
            >
              Create Your First Recipe
            </button>
            
            <button 
              className={styles.actionButton}
              onClick={handlePlanMeals}
            >
              Plan Your Weekly Meals
            </button>
            
            <button 
              className={styles.secondaryButton}
              onClick={handleExplore}
            >
              Explore the App
            </button>
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Welcome;
