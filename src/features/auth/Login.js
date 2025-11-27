import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Login.module.css';
import Header from '../../components/layout/Header';
import { auth } from '../../firebase'; // Import Firebase auth
import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence, // Remember user across browser sessions
  browserSessionPersistence // Remember user only for the current session
} from 'firebase/auth'; // Import Firebase auth functions

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectPath, setRedirectPath] = useState(null);

  // Check for redirect path in URL
  useEffect(() => {
    const redirect = searchParams.get('redirect');
    if (redirect) {
      setRedirectPath(redirect);
    }
  }, [searchParams]);

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
    
    // Clear the error for this field when the user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    return newErrors;
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate the form
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Set persistence based on "Remember me" checkbox
      // browserLocalPersistence = remember across sessions
      // browserSessionPersistence = remember only for this session
      await setPersistence(auth, formData.rememberMe ? browserLocalPersistence : browserSessionPersistence);
      
      // Sign in the user with email and password
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      console.log('User logged in successfully:', userCredential.user.uid);

      // Redirect to specified path or home page after successful login
      if (redirectPath) {
        navigate(redirectPath);
      } else {
        navigate('/');
      }
      
    } catch (error) {
      console.error('Login error:', error.code, error.message);
      let errorMessage = 'Login failed. Please check your credentials and try again.';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
         errorMessage = 'Invalid email or password. Please try again.';
      } else if (error.code === 'auth/invalid-email') {
         errorMessage = 'Please enter a valid email address.';
      } else if (error.code === 'auth/too-many-requests') {
         errorMessage = 'Access temporarily disabled due to too many failed login attempts. Please reset your password or try again later.';
      }
      // Add more specific error handling as needed
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle forgot password
  const handleForgotPassword = () => {
    navigate('/forgot-password');
  };

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>Welcome</h1>
        <p className={styles.subtitle}>Log in to your account</p>
        
        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Email Field */}
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>Email Address</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? styles.inputError : styles.input}
              placeholder="Enter your email"
            />
            {errors.email && <p className={styles.errorText}>{errors.email}</p>}
          </div>
          
          {/* Password Field */}
          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={errors.password ? styles.inputError : styles.input}
              placeholder="Enter your password"
            />
            {errors.password && <p className={styles.errorText}>{errors.password}</p>}
          </div>
          
          {/* Remember Me & Forgot Password */}
          <div className={styles.formOptions}>
            <label className={styles.rememberMe}>
              <input
                type="checkbox"
                name="rememberMe"
                checked={formData.rememberMe}
                onChange={handleChange}
                className={styles.checkbox}
              />
              Remember me
            </label>
            <button 
              type="button" 
              className={styles.forgotPassword}
              onClick={handleForgotPassword}
            >
              Forgot Password?
            </button>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Logging in...' : 'Log In'}
          </button>
          
          {errors.submit && <p className={styles.errorText}>{errors.submit}</p>}
          
          {/* Register Link */}
          <p className={styles.registerLink}>
            Don't have an account? <a href="/register">Sign up here</a>
          </p>
        </form>
      </main>
    </div>
  );
};

export default Login;
