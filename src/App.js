import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { auth } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { updateLastLogin } from './services/userService';
import { RecipeProvider } from './features/recipeBook/context/RecipeContext';
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage';
import ProfilePage from './features/profile/ProfilePage';
import Registration from './features/auth/Registration';
import Login from './features/auth/Login';
import ForgotPassword from './features/auth/ForgotPassword';
import Account from './features/auth/Account';
import Welcome from './features/auth/welcome/Welcome';
import SharedRecipeView from './pages/SharedRecipeView';
import CleanupDietTypes from './features/utils/CleanupDietTypes';

// Protected Route component - now receives auth state as props
const ProtectedRoute = ({ children, isAuthenticated, authChecked }) => {
  if (!authChecked) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  // Single auth state listener at the App level
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth State Changed:', user ? `User logged in: ${user.uid}` : 'User logged out');
      
      setUser(user);
      setIsAuthenticated(!!user);
      setAuthChecked(true);
      
      // Update last login time when user is authenticated
      if (user) {
        try {
          await updateLastLogin(user.uid);
        } catch (error) {
          console.error('Failed to update last login:', error);
          // Non-fatal error, don't prevent login
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Show loading screen while checking authentication
  if (!authChecked) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <RecipeProvider>
      <Router>
        <Routes>
          {/* Public authentication routes */}
          <Route
            path="/login"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Login />
            }
          />
          <Route
            path="/register"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Registration />
            }
          />
          <Route
            path="/forgot-password"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <ForgotPassword />
            }
          />
          <Route
            path="/welcome"
            element={
              isAuthenticated ? <Navigate to="/" replace /> : <Welcome />
            }
          />

          {/* Public shared recipe view */}
          <Route
            path="/shared/:linkId"
            element={<SharedRecipeView />}
          />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipe-book"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <RecipeBook />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meal-planner"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <MealPlannerPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/shopping-list"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <ShoppingListPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <Account />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cleanup-diet-types"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <CleanupDietTypes />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </RecipeProvider>
  );
}

export default App;