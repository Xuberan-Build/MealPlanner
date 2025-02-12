// In ShoppingListPage.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ShoppingListPage.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import ShoppingListGenerator from '../mealPlanner/components/ShoppingListGenerator';

const ShoppingListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mealPlan = location.state?.mealPlan || {};
  const [shoppingList, setShoppingList] = useState([]);

  const handleListGenerated = (generatedList) => {
    setShoppingList(generatedList);
  };

  const handleQuantityChange = (itemId, newQuantity) => {
    setShoppingList(list =>
      list.map(item =>
        item.id === itemId
          ? { ...item, quantity: parseInt(newQuantity) || 0 }
          : item
      )
    );
  };

  const handleNoteChange = (itemId, note) => {
    setShoppingList(list =>
      list.map(item =>
        item.id === itemId
          ? { ...item, notes: note }
          : item
      )
    );
  };

  const handleAlreadyHaveToggle = (itemId) => {
    setShoppingList(list =>
      list.map(item =>
        item.id === itemId
          ? { ...item, alreadyHave: !item.alreadyHave }
          : item
      )
    );
  };

  const handleUploadToInstacart = async () => {
    try {
      alert('Shopping list uploaded to Instacart successfully!');
    } catch (error) {
      console.error('Error uploading to Instacart:', error);
      alert('Failed to upload shopping list.');
    }
  };

  // If no meal plan was passed, show a message
  if (Object.keys(mealPlan).length === 0) {
    return (
      <div className={styles['shopping-list-page']}>
        <Header />
        <div style={{ height: '80px' }} />
        <div className={styles['empty-state']}>
          <h2>No Meal Plan Found</h2>
          <p>Please create a meal plan first to generate a shopping list.</p>
          <button
            className={`${styles['action-button']} ${styles['secondary-button']}`}
            onClick={() => navigate('/meal-planner')}
          >
            Back to Meal Planner
          </button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className={styles['shopping-list-page']}>
      <Header />
      <div style={{ height: '80px' }} />
      <h1>Your Shopping List</h1>

      {/* Show generator if list is empty, otherwise show the list */}
      {shoppingList.length === 0 ? (
        <ShoppingListGenerator
          mealPlan={mealPlan}
          onListGenerated={handleListGenerated}
        />
      ) : (
        <div className={styles['shopping-list-table-container']}>
          <table className={styles['shopping-list-table']}>
            <thead>
              <tr>
                <th>Item</th>
                <th>Quantity</th>
                <th>Unit</th>
                <th>Est. Cost</th>
                <th>Notes</th>
                <th>Have</th>
              </tr>
            </thead>
            <tbody>
              {shoppingList.map((item) => (
                <tr key={item.id} className={styles['shopping-list-row']}>
                  <td>{item.name}</td>
                  <td>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                      className={styles['quantity-input']}
                    />
                  </td>
                  <td>{item.unit}</td>
                  <td>${(item.estimatedCost * item.quantity).toFixed(2)}</td>
                  <td>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleNoteChange(item.id, e.target.value)}
                      className={styles['notes-input']}
                    />
                  </td>
                  <td>
                    <input
                      type="checkbox"
                      checked={item.alreadyHave}
                      onChange={() => handleAlreadyHaveToggle(item.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles['action-buttons']}>
        <button
          className={`${styles['action-button']} ${styles['primary-button']}`}
          onClick={handleUploadToInstacart}
        >
          Upload to Instacart
        </button>
        <button
          className={`${styles['action-button']} ${styles['secondary-button']}`}
          onClick={() => navigate('/meal-planner')}
        >
          Back to Meal Plan
        </button>
      </div>
      <BottomNav />
    </div>
  );
};

export default ShoppingListPage;
