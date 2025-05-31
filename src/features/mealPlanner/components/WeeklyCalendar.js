// WeeklyCalendar.js
import React from 'react';
import { PlusCircle } from 'lucide-react';
import './WeeklyCalendar.css';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const WeeklyCalendar = ({ mealPlan, onMealSlotClick }) => {
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

  return (
    <div className="weekly-calendar-container">
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
