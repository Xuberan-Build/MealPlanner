// src/features/mealPlanner/MealPlannerPage.js
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import styles from './MealPlanner.module.css';
import WeeklyCalendar from './components/WeeklyCalendar';
import MealProgressCalendar from './components/MealProgressCalendar';
import RecipeSelectionModal from './components/RecipeSelectionModal';
import SaveMealPlanModal from './components/SaveMealPlanModal';
import SavedMealPlans from './components/SavedMealPlans';
import { getRecipes, addRecipe } from '../../services/recipeService';
import {
  saveMealPlanToFirestore,
  loadMealPlansFromFirestore,
  updateMealPlanInFirestore,
} from '../../services/mealPlanService';
import {
  removeSlot,
  assignRecipe,
  isPlanEmpty,
  plansEqual,
  clearWorkingSession,
  newWorkingPlanId,
  shoppingListPlanKeys,
} from './mealPlanModel';
import { getWorkingSession, setWorkingSession } from './workingPlanStore';

const storage = typeof window !== 'undefined' ? window.localStorage : null;

const MealPlannerPage = () => {
  const navigate = useNavigate();

  // The working plan and, when editing, which saved plan it belongs to and what it
  // looked like when loaded. All three survive a refresh (see mealPlanModel).
  const [initialSession] = useState(getWorkingSession);
  const [mealPlan, setMealPlan] = useState(initialSession.plan);
  const [currentEditingPlan, setCurrentEditingPlan] = useState(initialSession.editingPlan);
  const [originalMealPlan, setOriginalMealPlan] = useState(initialSession.originalPlan);
  // Identifies "this plan" for its shopping list. Kept when the plan is saved (so a list
  // generated before saving is still found), replaced whenever a different plan is opened.
  const [workingId, setWorkingId] = useState(initialSession.workingId);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [savedMealPlans, setSavedMealPlans] = useState([]);
  const [selectedMealSlot, setSelectedMealSlot] = useState({ day: '', meal: '' });
  const [availableRecipes, setAvailableRecipes] = useState([]);
  const [currentDay, setCurrentDay] = useState('Monday');
  const [isSavedPlansOpen, setIsSavedPlansOpen] = useState(false);

  const planIsEmpty = isPlanEmpty(mealPlan);
  // Derived, never hand-maintained: editing => differs from the saved version;
  // not editing => anything in the plan has not been saved yet.
  const hasUnsavedChanges = useMemo(
    () => (currentEditingPlan ? !plansEqual(mealPlan, originalMealPlan) : !planIsEmpty),
    [currentEditingPlan, mealPlan, originalMealPlan, planIsEmpty]
  );

  // Through the shared store, so the Recipe Book sees planner changes immediately.
  useEffect(() => {
    setWorkingSession({
      plan: mealPlan,
      editingPlan: currentEditingPlan,
      originalPlan: originalMealPlan,
      workingId,
    });
  }, [mealPlan, currentEditingPlan, originalMealPlan, workingId]);

  useEffect(() => {
    getRecipes()
      .then(setAvailableRecipes)
      .catch((error) => console.error('Error fetching recipes:', error));
  }, []);

  const refreshSavedPlans = useCallback(async () => {
    try {
      setSavedMealPlans(await loadMealPlansFromFirestore());
    } catch (error) {
      console.error('Failed to load meal plans:', error);
    }
  }, []);

  useEffect(() => {
    refreshSavedPlans();
  }, [refreshSavedPlans]);

  /** Links the working plan to a saved plan; `snapshot` is its saved contents. */
  const linkToSavedPlan = (plan, snapshot) => {
    setCurrentEditingPlan(plan ? { id: plan.id, name: plan.name } : null);
    setOriginalMealPlan(plan ? snapshot : null);
  };

  /** Puts a different plan in the planner (its shopping list must not be confused with this one's). */
  const switchToPlan = (plan, savedPlan = null) => {
    setMealPlan(plan);
    linkToSavedPlan(savedPlan, savedPlan ? plan : null);
    setWorkingId(newWorkingPlanId());
  };

  const handleMealSlotClick = (day, meal, existingMealData = null) => {
    setSelectedMealSlot({
      day,
      meal,
      existingMeal: existingMealData,
      isEditing: !!existingMealData,
    });
    setIsModalOpen(true);
  };

  const confirmDiscard = (message) => !hasUnsavedChanges || window.confirm(message);

  // "Load" starts a new, unsaved plan from a saved one (the saved plan is untouched).
  const onLoadMealPlan = (selectedPlan) => {
    if (!confirmDiscard('You have unsaved changes. Loading a plan will discard them. Continue?')) return;
    switchToPlan(selectedPlan);
  };

  const handleEditMealPlan = (plan) => {
    if (
      currentEditingPlan?.id !== plan.id &&
      !confirmDiscard('You have unsaved changes. Editing a different plan will discard them. Continue?')
    ) {
      return;
    }
    if (currentEditingPlan?.id === plan.id) return; // already open
    switchToPlan(plan.plan, plan);
  };

  const handleRecipeSelect = useCallback(
    (recipeWithServings, selectedDays, resetModalState) => {
      setMealPlan((prev) =>
        assignRecipe(prev, {
          recipe: recipeWithServings,
          servings: recipeWithServings.selectedServings,
          days: selectedDays,
          meal: selectedMealSlot.meal,
        })
      );
      if (typeof resetModalState === 'function') resetModalState();
    },
    [selectedMealSlot.meal]
  );

  const handleRemoveMeal = useCallback((day, meal) => {
    setMealPlan((prev) => removeSlot(prev, day, meal));
  }, []);

  // "Save to Your plates": stored as a recipe (kind: 'plate') so it is reusable everywhere.
  const handleSaveFavoritePlate = useCallback(async (plateRecipe) => {
    try {
      const id = await addRecipe(plateRecipe);
      setAvailableRecipes((prev) => [...prev, { ...plateRecipe, id }]);
    } catch (error) {
      console.error('Saving the plate to Your plates failed:', error);
      alert('Could not save this plate to Your plates. It is still in your meal plan.');
    }
  }, []);

  // Update the saved plan in place and stay linked to it.
  const handleQuickUpdate = async () => {
    if (!currentEditingPlan) return;
    try {
      await updateMealPlanInFirestore(currentEditingPlan.id, currentEditingPlan.name, mealPlan);
      setOriginalMealPlan(mealPlan);
      await refreshSavedPlans();
    } catch (error) {
      console.error('Failed to update meal plan:', error);
      alert('Failed to update meal plan. Please try again.');
    }
  };

  // The save dialog always creates a NEW plan ("Save Meal Plan" or "Save as Copy"),
  // then links the working plan to it so later edits update it instead of duplicating.
  const handleSaveMealPlan = async (planName) => {
    try {
      const id = await saveMealPlanToFirestore(planName, mealPlan);
      linkToSavedPlan({ id, name: planName }, mealPlan);
      await refreshSavedPlans();
    } catch (error) {
      console.error('Failed to save meal plan:', error);
      alert('Failed to save meal plan. Please try again.');
    }
  };

  // SavedMealPlans deletes from Firestore itself; keep the meals but unlink them.
  const handleDeleteMealPlan = (planId) => {
    if (currentEditingPlan?.id === planId) linkToSavedPlan(null);
    setSavedMealPlans((prev) => prev.filter((plan) => plan.id !== planId));
  };

  const handleCancelEdit = () => {
    if (!confirmDiscard('You have unsaved changes. Are you sure you want to cancel?')) return;
    switchToPlan(originalMealPlan || {});
  };

  const handleGenerateShoppingListClick = () => {
    navigate('/shopping-list', {
      state: {
        mealPlan,
        planKeys: shoppingListPlanKeys({ editingPlan: currentEditingPlan, workingId }),
        planName: currentEditingPlan?.name || null,
      },
    });
  };

  const resetToEmptyPlan = () => {
    clearWorkingSession(storage);
    switchToPlan({});
  };

  const handleClearMealPlan = () => {
    if (planIsEmpty) return;
    const message = currentEditingPlan
      ? `Clear "${currentEditingPlan.name}" from the planner? This starts a fresh plan. The saved plan will not be deleted.`
      : 'Clear your entire meal plan? This cannot be undone.';
    if (window.confirm(message)) resetToEmptyPlan();
  };

  const handleStartNewPlan = () => {
    if (!planIsEmpty) {
      const message = currentEditingPlan
        ? `Start a new plan? Unsaved changes to "${currentEditingPlan.name}" will be lost. The saved plan will not be affected.`
        : 'Start a new plan? Your current unsaved plan will be cleared.';
      if (!window.confirm(message)) return;
    }
    resetToEmptyPlan();
  };

  const subtitle = (() => {
    if (currentEditingPlan) {
      return hasUnsavedChanges
        ? `You have unsaved changes to "${currentEditingPlan.name}".`
        : `All changes to "${currentEditingPlan.name}" are saved.`;
    }
    return planIsEmpty
      ? 'This is where you will plan your meals for the week.'
      : "You have an unsaved meal plan in progress. Don't forget to save it!";
  })();

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
                <p className={styles.headerSubtitle}>{subtitle}</p>
              </div>
              {!planIsEmpty && (
                <button
                  className={styles.clearButton}
                  onClick={handleClearMealPlan}
                  title="Clear entire meal plan"
                >
                  {currentEditingPlan ? 'Clear & Exit Edit' : 'Clear Plan'}
                </button>
              )}
            </div>
          </div>

          <MealProgressCalendar
            mealPlan={mealPlan}
            currentDay={currentDay}
            onDayClick={setCurrentDay}
          />

          <WeeklyCalendar
            mealPlan={mealPlan}
            onMealSlotClick={handleMealSlotClick}
            currentDay={currentDay}
            onDayChange={setCurrentDay}
          />
          <div className="h-8"></div> {/* Spacer before action buttons */}

          <div className={styles.actionButtons}>
            {currentEditingPlan ? (
              <>
                <button
                  className={styles.primaryButton}
                  onClick={handleQuickUpdate}
                  disabled={!hasUnsavedChanges}
                >
                  {hasUnsavedChanges ? `Update "${currentEditingPlan.name}"` : 'All Changes Saved'}
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={handleGenerateShoppingListClick}
                  disabled={planIsEmpty}
                >
                  Generate Shopping List
                </button>
                <button className={styles.secondaryButton} onClick={() => setIsSaveModalOpen(true)}>
                  Save as Copy
                </button>
                <button className={styles.secondaryButton} onClick={handleStartNewPlan}>
                  Start New Plan
                </button>
                <button className={styles.cancelButton} onClick={handleCancelEdit}>
                  {hasUnsavedChanges ? 'Discard Changes' : 'Close Plan'}
                </button>
              </>
            ) : (
              <>
                <button
                  className={styles.primaryButton}
                  onClick={() => setIsSaveModalOpen(true)}
                  disabled={planIsEmpty}
                >
                  Save Meal Plan
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={handleGenerateShoppingListClick}
                  disabled={planIsEmpty}
                >
                  Generate Shopping List
                </button>
                <button
                  className={styles.secondaryButton}
                  onClick={() => setIsSavedPlansOpen(!isSavedPlansOpen)}
                >
                  Saved Plans {savedMealPlans?.length > 0 && `(${savedMealPlans.length})`}
                </button>
                <button className={styles.secondaryButton} onClick={handleStartNewPlan}>
                  Start New Plan
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

        <RecipeSelectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onRecipeSelect={handleRecipeSelect}
          onRemoveMeal={handleRemoveMeal}
          onSaveFavoritePlate={handleSaveFavoritePlate}
          mealPlan={mealPlan}
          mealType={selectedMealSlot.meal}
          availableRecipes={availableRecipes}
          selectedMealSlot={selectedMealSlot}
        />

        <SaveMealPlanModal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          onSaveMealPlan={handleSaveMealPlan}
          suggestedName={currentEditingPlan ? `${currentEditingPlan.name} (copy)` : ''}
        />
      </main>
      <BottomNav />
    </div>
  );
};

export default MealPlannerPage;
