import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { updateLastLogin } from '../services/userService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      console.log('Auth State Changed:', user ? `User logged in: ${user.uid}` : 'User logged out');

      setUser(user);
      setIsAuthenticated(!!user);
      setAuthChecked(true);
      setLoading(false);

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

  const value = {
    user,
    isAuthenticated,
    authChecked,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
