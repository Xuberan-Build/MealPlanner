import React, { useState, useEffect } from 'react'; // Import useState and useEffect
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom'; // Import Navigate for potential redirects
import { auth } from './firebase'; // Import Firebase auth
import { onAuthStateChanged } from 'firebase/auth'; // Import auth state listener
import Home from './pages/Home';
import RecipeBook from './features/recipeBook/RecipeBook';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';
import ShoppingListPage from './features/shoppingList/ShoppingListPage';
import Registration from './features/auth/Registration';
import Login from './features/auth/Login';
import ForgotPassword from './features/auth/ForgotPassword';
import Account from './features/auth/Account';
import Welcome from './features/auth/welcome/Welcome';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true); // Add loading state

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user); // Set user to null if logged out, user object if logged in
      setLoading(false); // Set loading to false once auth state is determined
      console.log('Auth State Changed:', user ? `User logged in: ${user.uid}` : 'User logged out');
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Show loading indicator while checking auth status
  if (loading) {
    return <div>Loading...</div>; // Or a more sophisticated loading spinner
  }

  // TODO: Implement Protected Routes based on currentUser
  // Example: Wrap routes like /account, /meal-planner etc. in a component
  // that checks if currentUser exists, otherwise redirects to /login.

  return (
    <Router>
      {/* Pass currentUser down via Context or props if needed by components */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/recipe-book" element={<RecipeBook />} />
        <Route path="/meal-planner" element={<MealPlannerPage />} />
        <Route path="/shopping-list" element={<ShoppingListPage />} />
        
        {/* Authentication Routes */}
        <Route path="/register" element={<Registration />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/account" element={<Account />} />
        <Route path="/welcome" element={<Welcome />} />
      </Routes>
    </Router>
  );
}

export default App;
