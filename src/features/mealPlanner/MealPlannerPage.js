// src/features/mealPlanner/MealPlannerPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import styles from './MealPlanner.module.css';
import WeeklyCalendar from './components/WeeklyCalendar';
import MealProgressCalendar from './components/MealProgressCalendar';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import SaveMealPlanModal from './components/SaveMealPlanModal';
import SavedMealPlans from './components/SavedMealPlans';
import { getRecipes } from '../../services/recipeService';
import {
  saveMealPlanToFirestore,
  loadMealPlansFromFirestore,
  deleteMealPlanFromFirestore,
  updateMealPlanInFirestore, // New function we'll need to add
} from '../../services/mealPlanService';

const MealPlannerPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // State declarations
  const [mealPlan, setMealPlan] = useState(() => {
    // Load from localStorage on initial mount
    try {
      const savedWorkingPlan = localStorage.getItem('workingMealPlan');
      return savedWorkingPlan ? JSON.parse(savedWorkingPlan) : {};
    } catch (error) {
      console.error('Error loading working meal plan from localStorage:', error);
      return {};
    }
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState([]);
  const [selectedMealSlot, setSelectedMealSlot] = useState({ day: '', meal: '' });
  const [availableRecipes, setAvailableRecipes] = useState([]);
  const [currentDay, setCurrentDay] = useState('Monday');
  const [currentEditingPlan, setCurrentEditingPlan] = useState(null);
  const [originalMealPlan, setOriginalMealPlan] = useState(null); // Store original plan for cancel
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSavedPlansOpen, setIsSavedPlansOpen] = useState(false);

  // Auto-save working meal plan to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('workingMealPlan', JSON.stringify(mealPlan));
    } catch (error) {
      console.error('Error saving working meal plan to localStorage:', error);
    }
  }, [mealPlan]);

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

  // Handle pre-selected recipe from Recipe Book
  useEffect(() => {
    const preSelectedRecipe = location.state?.preSelectedRecipe;

    if (preSelectedRecipe) {
      const { recipe, day, mealType, servings } = preSelectedRecipe;

      // Automatically add the recipe to the specified day and meal type
      setMealPlan(prevPlan => {
        const newPlan = { ...prevPlan };

        if (!newPlan[day]) {
          newPlan[day] = {};
        }

        newPlan[day][mealType] = {
          recipe,
          servings
        };

        return newPlan;
      });

      setHasUnsavedChanges(true);
      setCurrentDay(day);

      // Clear the navigation state to prevent re-adding on refresh
      navigate(location.pathname, { replace: true, state: {} });

      console.log(`Added ${recipe.title} to ${day} ${mealType}`);
    }
  }, [location, navigate]);

  // Handle meal slot click
  const handleMealSlotClick = (day, meal, existingMealData = null) => {
    console.log('Current mealPlan data:', mealPlan);
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
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Loading a plan will discard them. Continue?')) {
        return;
      }
    }
    setMealPlan(selectedMealPlan);
    setCurrentEditingPlan(null);
    setOriginalMealPlan(null);
    setHasUnsavedChanges(false);
  };

  // Handle editing a meal plan
  const handleEditMealPlan = (plan) => {
    if (hasUnsavedChanges && currentEditingPlan?.id !== plan.id) {
      if (!window.confirm('You have unsaved changes. Editing a different plan will discard them. Continue?')) {
        return;
      }
    }
    setCurrentEditingPlan(plan);
    setOriginalMealPlan(JSON.parse(JSON.stringify(plan.plan))); // Deep copy for restore
    setMealPlan(plan.plan);
    setHasUnsavedChanges(false);
    console.log('Editing plan:', plan.name);
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
    setHasUnsavedChanges(true); // Mark as having unsaved changes

    if (typeof resetModalState === 'function') {
      resetModalState();
    }
  }, [mealPlan, selectedMealSlot]);

  // Handle quick update (one-click) for editing existing plans
  const handleQuickUpdate = async () => {
    if (!currentEditingPlan) return;

    try {
      await updateMealPlanInFirestore(
        currentEditingPlan.id,
        currentEditingPlan.name,
        mealPlan
      );

      const updatedPlans = await loadMealPlansFromFirestore();
      setSavedMealPlans(updatedPlans);
      setCurrentEditingPlan(null);
      setOriginalMealPlan(null);
      setHasUnsavedChanges(false);

      // Show success feedback
      alert(`"${currentEditingPlan.name}" updated successfully!`);
    } catch (error) {
      console.error('Failed to update meal plan:', error);
      alert('Failed to update meal plan. Please try again.');
    }
  };

  // Handle saving the current meal plan to Firestore
  const handleSaveMealPlan = async (planName) => {
    try {
      if (currentEditingPlan) {
        // Update existing plan (with potentially new name)
        await updateMealPlanInFirestore(currentEditingPlan.id, planName, mealPlan);
        setCurrentEditingPlan(null);
        setOriginalMealPlan(null);
      } else {
        // Save new plan
        await saveMealPlanToFirestore(planName, mealPlan);
      }

      const updatedPlans = await loadMealPlansFromFirestore();
      setSavedMealPlans(updatedPlans);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      alert('Failed to save meal plan. Please try again.');
    }
  };

  // Handle deleting a meal plan
  const handleDeleteMealPlan = async (planId) => {
    try {
      // If we're currently editing this plan, exit edit mode
      if (currentEditingPlan?.id === planId) {
        setCurrentEditingPlan(null);
        setMealPlan({}); // Clear the meal plan
      }
      
      // Remove the plan from the local state
      setSavedMealPlans(prevPlans => 
        prevPlans.filter(plan => plan.id !== planId)
      );
      
      console.log(`Plan ${planId} removed from UI`);
    } catch (error) {
      console.error('Error updating UI after deletion:', error);
    }
  };

  // Handle canceling edit mode
  const handleCancelEdit = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Are you sure you want to cancel?')) {
        return;
      }
    }

    // Restore original meal plan if we have it, otherwise clear
    if (originalMealPlan) {
      setMealPlan(originalMealPlan);
    } else {
      setMealPlan({});
    }

    setCurrentEditingPlan(null);
    setOriginalMealPlan(null);
    setHasUnsavedChanges(false);
  };

  // Handle generating the shopping list
  const handleGenerateShoppingListClick = () => {
    navigate('/shopping-list', {
      state: { mealPlan }
    });
  };

  // Handle clearing the meal plan
  const handleClearMealPlan = () => {
    if (Object.keys(mealPlan).length === 0) {
      alert('Meal plan is already empty.');
      return;
    }

    if (window.confirm('Are you sure you want to clear your entire meal plan? This action cannot be undone.')) {
      setMealPlan({});
      setCurrentEditingPlan(null);
      setOriginalMealPlan(null);
      setHasUnsavedChanges(false);
      localStorage.removeItem('workingMealPlan');
      console.log('Meal plan cleared');
    }
  };

  return (
    <div className={styles['meal-planner-page']}>
      <Header />
      <div className={styles.spacerLarge}></div>
      <div className="h-20"></div> {/* Spacer after header */}
      <main className={styles['meal-planner-content']}>
        <div className={styles.mealPlannerContainer}>
          <div className={styles.header}>
            <div className={styles.headerContent}>
              <div>
                <h1 className={styles.headerTitle}>
                  Meal Planner
                  {currentEditingPlan && (
                    <span className={styles.editingIndicator}>
                      - Editing "{currentEditingPlan.name}"
                    </span>
                  )}
                </h1>
                <p className={styles.headerSubtitle}>
                  {currentEditingPlan
                    ? `Make changes to your saved plan and save to update it.`
                    : Object.keys(mealPlan).length > 0
                    ? `You have an unsaved meal plan in progress. Don't forget to save it!`
                    : `This is where you will plan your meals for the week.`
                  }
                </p>
              </div>
              {!currentEditingPlan && Object.keys(mealPlan).length > 0 && (
                <button
                  className={styles.clearButton}
                  onClick={handleClearMealPlan}
                  title="Clear entire meal plan"
                >
                  Clear Plan
                </button>
              )}
            </div>
          </div>

          {/* Meal Progress Calendar */}
          {console.log('Debug mealPlan:', mealPlan)}
          <MealProgressCalendar 
            mealPlan={mealPlan}
            currentDay={currentDay}
            onDayClick={setCurrentDay}
          />

          {/* Weekly Calendar showing the meal plan */}
          <WeeklyCalendar
            mealPlan={mealPlan}
            onMealSlotClick={handleMealSlotClick}
            currentDay={currentDay}
            onDayChange={setCurrentDay}
          />
          <div className="h-8"></div> {/* Spacer before action buttons */}
          
          <div className={styles.actionButtons}>
            {currentEditingPlan ? (
              // Edit mode buttons
              <>
                <button
                  className={styles.primaryButton}
                  onClick={handleQuickUpdate}
                  disabled={!hasUnsavedChanges}
                >
                  {hasUnsavedChanges ? `Update "${currentEditingPlan.name}"` : 'No Changes'}
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsSaveModalOpen(true)}
                >
                  Save as Copy
                </button>
                <button
                  className={styles.cancelButton}
                  onClick={handleCancelEdit}
                >
                  Cancel Edit
                </button>
              </>
            ) : (
              // Normal mode buttons
              <>
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
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsSavedPlansOpen(!isSavedPlansOpen)}
                >
                  Saved Plans {savedMealPlans?.length > 0 && `(${savedMealPlans.length})`}
                </button>
              </>
            )}
          </div>

          <SavedMealPlans
            savedMealPlans={savedMealPlans}
            onLoadMealPlan={onLoadMealPlan}
            onDeleteMealPlan={handleDeleteMealPlan}
            onEditMealPlan={handleEditMealPlan}
            currentEditingPlan={currentEditingPlan}
            isOpen={isSavedPlansOpen}
            onToggle={() => setIsSavedPlansOpen(!isSavedPlansOpen)}
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
          isEditing={!!currentEditingPlan}
          existingPlanName={currentEditingPlan?.name || ''}
        />
      </main>
      <BottomNav />
    </div>
  );
};

export default MealPlannerPage;