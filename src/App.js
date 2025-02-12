import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage'; // Corrected import for ShoppingListPage
import Layout from './components/layout/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe-book" element={<RecipeBook />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} /> {/* Added shopping list route */}
      </Routes>
    </Router>
  );
}

export default App;
