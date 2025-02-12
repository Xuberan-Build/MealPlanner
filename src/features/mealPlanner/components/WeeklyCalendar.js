// WeeklyCalendar.js
import React from 'react';
import { PlusCircle } from 'lucide-react';
import './WeeklyCalendar.css';

const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const meals = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

const WeeklyCalendar = ({ mealPlan, onMealSlotClick }) => {
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
              {daysOfWeek.map((day) => (
                <td
                  key={day}
                  className="meal-slot"
                  onClick={() => onMealSlotClick(day, meal)}
                >
                  <div className="meal-content">
                    {mealPlan[day]?.[meal] ? (
                      <div className="meal-info">
                        <span className="meal-title">{mealPlan[day][meal].title}</span>
                      </div>
                    ) : (
                      <div className="empty-meal">
                        <PlusCircle className="plus-icon" />
                        <span className="empty-text">Add meal</span>
                      </div>
                    )}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default WeeklyCalendar;
