import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage';
import ProfilePage from './features/profile/ProfilePage';
import OcrTester from './components/OcrTester';
import Layout from './components/layout/Layout';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe-book" element={<RecipeBook />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/ocr-test" element={<OcrTester />} />
      </Routes>
    </Router>
  );
}

export default App;
