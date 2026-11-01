import React from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DietTypeProvider } from './contexts/DietTypeContext';
import { RecipeProvider } from './features/recipeBook/context/RecipeContext';
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage';
import PantryPage from './features/pantry/PantryPage';
import ProfilePage from './features/profile/ProfilePage';
import Registration from './features/auth/Registration';
import Login from './features/auth/Login';
import ForgotPassword from './features/auth/ForgotPassword';
import Account from './features/auth/Account';
import Welcome from './features/auth/welcome/Welcome';
import SharedRecipeView from './pages/SharedRecipeView';
import CleanupDietTypes from './features/utils/CleanupDietTypes';
import IngredientDictionaryPage from './features/admin/IngredientDictionaryPage';
import { useIngredientDictionary } from './hooks/useIngredientDictionary';

// Protected Route component - now receives auth state as props
const ProtectedRoute = ({ children, isAuthenticated, authChecked }) => {
  if (!authChecked) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppContent() {
  const { isAuthenticated, authChecked, loading } = useAuth();
  // Shared same-product names (e.g. old fashioned oats = rolled oats) for every list.
  useIngredientDictionary(isAuthenticated);

  // Show loading screen while checking authentication
  if (loading || !authChecked) {
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
    <DietTypeProvider>
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
            path="/pantry"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <PantryPage />
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
            path="/admin/ingredients"
            element={
              <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
                <IngredientDictionaryPage />
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
    </DietTypeProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;