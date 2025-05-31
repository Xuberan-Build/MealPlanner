// src/features/mealPlanner/MealPlannerPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import styles from './MealPlanner.module.css';
import WeeklyCalendar from './components/WeeklyCalendar';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import SaveMealPlanModal from './components/SaveMealPlanModal';
import SavedMealPlans from './components/SavedMealPlans';
import { getRecipes } from '../../services/recipeService';
import {
  saveMealPlanToFirestore,
  loadMealPlansFromFirestore,
  deleteMealPlanFromFirestore,
} from '../../services/mealPlanService';

const MealPlannerPage = () => {
  const navigate = useNavigate();

  // State declarations
  const [mealPlan, setMealPlan] = useState({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState([]);
  const [selectedMealSlot, setSelectedMealSlot] = useState({ day: '', meal: '' });
  const [availableRecipes, setAvailableRecipes] = useState([]);

  // Fetch available recipes when the component mounts
  useEffect(() => {
    const fetchRecipes = async () => {
      try {
        const recipes = await getRecipes();
        setAvailableRecipes(recipes);
      } catch (error) {
        console.error('Error fetching recipes:', error);
      }
    };
    fetchRecipes();
  }, []);

  // Fetch saved meal plans when the component mounts
  useEffect(() => {
    const fetchSavedPlans = async () => {
      try {
        const savedPlans = await loadMealPlansFromFirestore();
        setSavedMealPlans(savedPlans);
      } catch (error) {
        console.error('Failed to load meal plans:', error);
      }
    };
    fetchSavedPlans();
  }, []);

  // Handle meal slot click
const handleMealSlotClick = (day, meal, existingMealData = null) => {
  setSelectedMealSlot({ 
    day, 
    meal, 
    existingMeal: existingMealData,
    isEditing: !!existingMealData 
  });
  setIsModalOpen(true);
};

  // Update the current meal plan with the loaded one
  const onLoadMealPlan = (selectedMealPlan) => {
    setMealPlan(selectedMealPlan);
  };

  const handleRecipeSelect = useCallback((recipeWithServings, selectedDays, resetModalState) => {
    const updatedMealPlan = { ...mealPlan };
    selectedDays.forEach((day) => {
      updatedMealPlan[day] = {
        ...updatedMealPlan[day],
        [selectedMealSlot.meal]: {
          recipe: recipeWithServings,
          servings: recipeWithServings.selectedServings
        },
      };
    });
    setMealPlan(updatedMealPlan);

    if (typeof resetModalState === 'function') {
      resetModalState(); // Reset the modal to Step 1
    }
    // Don't close the modal here — let user continue adding
  }, [mealPlan, selectedMealSlot]);

  // Handle saving the current meal plan to Firestore
  const handleSaveMealPlan = async (planName) => {
    try {
      await saveMealPlanToFirestore(planName, mealPlan);
      const updatedPlans = await loadMealPlansFromFirestore();
      setSavedMealPlans(updatedPlans);
    } catch (error) {
      console.error('Failed to save meal plan:', error);
    }
  };

  // Handle deleting a meal plan
  const handleDeleteMealPlan = async (planId) => {
    try {
      // Remove the plan from the local state
      setSavedMealPlans(prevPlans => 
        prevPlans.filter(plan => plan.id !== planId)
      );
      
      console.log(`Plan ${planId} removed from UI`);
    } catch (error) {
      console.error('Error updating UI after deletion:', error);
    }
  };

  // Handle generating the shopping list
  const handleGenerateShoppingListClick = () => {
    navigate('/shopping-list', {
      state: { mealPlan }
    });
  };

  return (
    <div className={styles['meal-planner-page']}>
      <Header />
      <div className={styles.spacerLarge}></div>
      <div className="h-20"></div> {/* Spacer after header */}
      <main className={styles['meal-planner-content']}>
        <div className={styles.mealPlannerContainer}>
          <div className={styles.header}>
            <h1 className={styles.headerTitle}>Meal Planner</h1>
            <p className={styles.headerSubtitle}>This is where you will plan your meals for the week.</p>
          </div>

          {/* Weekly Calendar showing the meal plan */}
          <WeeklyCalendar mealPlan={mealPlan} onMealSlotClick={handleMealSlotClick} />

          <div className="h-8"></div> {/* Spacer before action buttons */}
          <div className={styles.actionButtons}>
            <button
              className={styles.primaryButton}
              onClick={() => setIsSaveModalOpen(true)}
            >
              Save Meal Plan
            </button>
            <button
              className={styles.secondaryButton}
              onClick={handleGenerateShoppingListClick}
            >
              Generate Shopping List
            </button>
          </div>

        <div className="h-8"></div> {/* Spacer before saved meal plans */}
          <SavedMealPlans
            savedMealPlans={savedMealPlans}
            onLoadMealPlan={onLoadMealPlan}
            onDeleteMealPlan={handleDeleteMealPlan}
          />
        </div>
        <div className={styles.spacerLarge}></div>

        {/* Modals */}
        <RecipeSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRecipeSelect={handleRecipeSelect}
          mealType={selectedMealSlot.meal}
          availableRecipes={availableRecipes}
          selectedMealSlot={selectedMealSlot} 
        />

        <SaveMealPlanModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          mealPlan={mealPlan}
          onSaveMealPlan={handleSaveMealPlan}
        />
      </main>
      <BottomNav />
    </div>
  );
};

export default MealPlannerPage;
