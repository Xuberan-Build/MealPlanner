import React from 'react';
import { MEAL_TYPES, DAYS_OF_WEEK_ABBREVIATED } from '../../../constants/mealPlanner';
import styles from './MealProgressCalendar.module.css';

const MealProgressCalendar = ({ 
  mealPlan = {}, 
  currentDay = '', 
  onDayClick = () => {}, 
  className = '' 
}) => {
  // Get the days of the week
  const daysOfWeek = DAYS_OF_WEEK_ABBREVIATED;

  // Calculate meal completion status for a day
  const getMealCompletionStatus = (dayKey) => {
    const dayMeals = mealPlan[dayKey];
    
    if (!dayMeals) {
      return { status: 'empty', count: 0 };
    }

    // Count how many meals are planned
    const mealTypes = MEAL_TYPES;
    const plannedMeals = mealTypes.filter(mealType => {
      const meal = dayMeals[mealType];
      return meal && (meal.recipe || meal.name);
    });

    const count = plannedMeals.length;

    if (count === 0) {
      return { status: 'empty', count: 0 };
    } else if (count === MEAL_TYPES.length) {
      return { status: 'complete', count: MEAL_TYPES.length };
    } else {
      return { status: 'partial', count };
    }
  };

  // Get today's date for highlighting current day
  const getTodayKey = () => {
  const today = new Date();
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return dayNames[today.getDay()];
};

  const todayKey = getTodayKey();

  return (
    <div className={`${styles.progressCalendar} ${className}`}>
      <div className={styles.calendarHeader}>
        <h3 className={styles.title}>Weekly Progress</h3>
      </div>
      
      <div className={styles.daysContainer}>
        {daysOfWeek.map((day) => {
          const completion = getMealCompletionStatus(day.key);
          const isToday = day.key === todayKey;
          const isCurrentDay = day.key === currentDay;
          
          return (
            <div
              key={day.key}
              className={`
                ${styles.dayCard}
                ${styles[completion.status]}
                ${isToday ? styles.today : ''}
                ${isCurrentDay ? styles.currentDay : ''}
              `}
              onClick={() => onDayClick(day.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onDayClick(day.key);
                }
              }}
            >
              <div className={styles.dayLabel}>
                {day.label}
              </div>
              
              <div className={styles.progressIndicator}>
                <div className={`${styles.progressCircle} ${styles[completion.status]}`}>
                  <span className={styles.mealCount}>
                    {completion.count}/{MEAL_TYPES.length}
                  </span>
                </div>
              </div>
              
              <div className={styles.statusText}>
                {completion.status === 'complete' && 'Complete'}
                {completion.status === 'partial' && `${completion.count} meals`}
                {completion.status === 'empty' && 'Empty'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MealProgressCalendar;