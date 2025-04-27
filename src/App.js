import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useNavigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage';
import Registration from './features/auth/Registration';
import Login from './features/auth/Login';
import ForgotPassword from './features/auth/ForgotPassword';
import Account from './features/auth/Account';
import Welcome from './features/auth/welcome/Welcome';

// Protected Route component
const ProtectedRoute = ({ children }) => {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setIsAuthenticated(!!user);
      setAuthChecked(true);
      
      if (!user) {
        navigate('/login');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  if (!authChecked) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : null;
};

function App() {
  const [loading, setLoading] = useState(true);

  // Check authentication state at the app level
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log('Auth State Changed:', user ? `User logged in: ${user.uid}` : 'User logged out');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {/* Public authentication routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/welcome" element={<Welcome />} />
        
        {/* Protected routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/recipe-book" 
          element={
            <ProtectedRoute>
              <RecipeBook />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/meal-planner" 
          element={
            <ProtectedRoute>
              <MealPlannerPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/shopping-list" 
          element={
            <ProtectedRoute>
              <ShoppingListPage />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/account" 
          element={
            <ProtectedRoute>
              <Account />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Router>
  );
}

export default App;