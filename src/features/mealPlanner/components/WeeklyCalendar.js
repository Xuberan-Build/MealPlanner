// WeeklyCalendar.js - Clean Minimal Design
import React, { useState, useEffect } from 'react';
import { PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import './WeeklyCalendar.css';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const WeeklyCalendar = ({ mealPlan, onMealSlotClick }) => {
  const [currentDayIndex, setCurrentDayIndex] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  // Check if mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const getMealData = (day, meal) => {
    const mealData = mealPlan[day]?.[meal];
    
    // Handle both old format (direct recipe) and new format ({ recipe, servings })
    if (!mealData) return null;
    
    // New format: { recipe: {...}, servings: number }
    if (mealData.recipe && typeof mealData.servings !== 'undefined') {
      return {
        title: mealData.recipe.title,
        servings: mealData.servings
      };
    }
    
    // Old format: direct recipe object (for backward compatibility)
    if (mealData.title) {
      return {
        title: mealData.title,
        servings: mealData.servings || mealData.selectedServings || null
      };
    }
    
    return null;
  };

  const goToPreviousDay = () => {
    setCurrentDayIndex(prev => prev > 0 ? prev - 1 : daysOfWeek.length - 1);
  };

  const goToNextDay = () => {
    setCurrentDayIndex(prev => prev < daysOfWeek.length - 1 ? prev + 1 : 0);
  };

  // Mobile Layout
  if (isMobile) {
    const currentDay = daysOfWeek[currentDayIndex];
    
    return (
      <div className="weekly-calendar-container mobile">
        {/* Clean Mobile Day Navigation */}
        <div className="mobile-day-header">
          <button className="day-nav-button" onClick={goToPreviousDay}>
            <ChevronLeft className="nav-icon" />
          </button>
          
          <div className="current-day-display">
            <h2 className="day-title">{currentDay}</h2>
            <div className="day-dots">
              {daysOfWeek.map((_, index) => (
                <div 
                  key={index}
                  className={`day-dot ${index === currentDayIndex ? 'active' : ''}`}
                  onClick={() => setCurrentDayIndex(index)}
                />
              ))}
            </div>
          </div>
          
          <button className="day-nav-button" onClick={goToNextDay}>
            <ChevronRight className="nav-icon" />
          </button>
        </div>

        {/* Clean Mobile Meal Grid */}
        <div className="mobile-meals-grid">
          {meals.map((meal) => {
            const mealData = getMealData(currentDay, meal);
            
            return (
              <div 
                key={meal}
                className="mobile-meal-card"
                onClick={() => onMealSlotClick(currentDay, meal, mealData)}
              >
                <div className="meal-card-header">
                  <h3 className="meal-type-title">{meal}</h3>
                </div>
                
                <div className="meal-card-content">
                  {mealData ? (
                    <div className="meal-info">
                      <div className="meal-title">{mealData.title}</div>
                      {mealData.servings && (
                        <div className="meal-servings">
                          {mealData.servings} serving{mealData.servings !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="empty-meal">
                      <PlusCircle className="plus-icon" />
                      <span className="empty-text">Add meal</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bottom Spacer for Navigation */}
        <div className="mobile-bottom-spacer"></div>
      </div>
    );
  }

  // Desktop Layout (unchanged functionality)
  return (
    <div className="weekly-calendar-container desktop">
      <table className="calendar-table">
        <thead>
          <tr>
            <th className="corner-header">Meals</th>
            {daysOfWeek.map((day) => (
              <th key={day} className="day-header">
                <span className="day-name">{day}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meals.map((meal) => (
            <tr key={meal}>
              <td className="meal-type">
                <span className="meal-label">{meal}</span>
              </td>
              {daysOfWeek.map((day) => {
                const mealData = getMealData(day, meal);
                
                return (
                  <td
                    key={day}
                    className="meal-slot"
                    onClick={() => onMealSlotClick(day, meal, mealData)}
                  >
                    <div className="meal-content">
                      {mealData ? (
                        <div className="meal-info">
                          <span className="meal-title">{mealData.title}</span>
                          {mealData.servings && (
                            <span className="meal-servings">
                              {mealData.servings} serving{mealData.servings !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="empty-meal">
                          <PlusCircle className="plus-icon" />
                          <span className="empty-text">Add meal</span>
                        </div>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyCalendar;