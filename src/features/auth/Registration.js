import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styles from './Registration.module.css';
import Header from '../../components/layout/Header';
import { auth } from '../../firebase'; // Import Firebase auth
import { createUserWithEmailAndPassword, setPersistence, browserLocalPersistence } from 'firebase/auth'; // Import Firebase auth function
import { createUserProfile } from '../../services/userService';
import { validateReferralCode } from '../../services/referralService';

const Registration = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    dietaryPreferences: []
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [referralCode, setReferralCode] = useState(null);
  const [referrerName, setReferrerName] = useState(null);
  const [redirectPath, setRedirectPath] = useState(null);

  // Check for referral code and redirect path in URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    const redirect = searchParams.get('redirect');

    if (redirect) {
      setRedirectPath(redirect);
    }

    if (ref) {
      validateReferralCode(ref).then(result => {
        if (result.valid) {
          setReferralCode(ref);
          setReferrerName(result.referrerName);
        }
      });
    }
  }, [searchParams]);

  // Dietary options
  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Keto', 'Paleo', 
    'Low-Carb', 'Gluten-Free', 'Dairy-Free'
  ];

  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
    
    // Clear the error for this field when the user types
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: null
      });
    }
  };

  // Handle dietary preference changes
  const handleDietaryChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setFormData({
        ...formData,
        dietaryPreferences: [...formData.dietaryPreferences, value]
      });
    } else {
      setFormData({
        ...formData,
        dietaryPreferences: formData.dietaryPreferences.filter(pref => pref !== value)
      });
    }
  };

  // Validate the form
  const validateForm = () => {
    const newErrors = {};
    
    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // Validate email
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    // Validate password
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    // Validate password confirmation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      // Set persistence to keep user logged in across browser sessions
      await setPersistence(auth, browserLocalPersistence);

      // Create user profile (includes metrics, referral, credits initialization)
      await createUserProfile(user.uid, {
        name: formData.name,
        email: formData.email,
        dietaryPreferences: {
          restrictions: formData.dietaryPreferences,
          cuisinePreferences: [],
          calorieGoal: 2000,
          macros: { protein: 30, carbs: 40, fat: 30 }
        }
      }, referralCode);

      console.log('User registered successfully and profile created:', user.uid);

      // Redirect to specified path or welcome screen
      if (redirectPath) {
        navigate(redirectPath);
      } else {
        navigate('/welcome');
      }

    } catch (error) {
      console.error('Registration error:', error.code, error.message);
      let errorMessage = 'Registration failed. Please try again.';
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already registered. Please login or use a different email.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password (at least 6 characters).';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      // Add more specific error handling as needed
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>Create Your Account</h1>
        <p className={styles.subtitle}>Join our community to create and share recipes</p>

        {referrerName && (
          <div className={styles.referralBanner}>
            🎉 You were referred by <strong>{referrerName}</strong>!
          </div>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          {/* Name Field */}
          <div className={styles.formGroup}>
            <label htmlFor="name" className={styles.label}>Full Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={errors.name ? styles.inputError : styles.input}
              placeholder="Enter your full name"
            />
            {errors.name && <p className={styles.errorText}>{errors.name}</p>}
          </div>
          
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
              placeholder="Create a password"
            />
            {errors.password && <p className={styles.errorText}>{errors.password}</p>}
          </div>
          
          {/* Confirm Password Field */}
          <div className={styles.formGroup}>
            <label htmlFor="confirmPassword" className={styles.label}>Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? styles.inputError : styles.input}
              placeholder="Confirm your password"
            />
            {errors.confirmPassword && <p className={styles.errorText}>{errors.confirmPassword}</p>}
          </div>
          
          {/* Dietary Preferences */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Dietary Preferences (Optional)</label>
            <div className={styles.checkboxGrid}>
              {dietaryOptions.map(option => (
                <label key={option} className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    name="dietaryPreferences"
                    value={option}
                    checked={formData.dietaryPreferences.includes(option)}
                    onChange={handleDietaryChange}
                    className={styles.checkbox}
                  />
                  {option}
                </label>
              ))}
            </div>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating Account...' : 'Create Account'}
          </button>
          
          {errors.submit && <p className={styles.errorText}>{errors.submit}</p>}
          
          {/* Login Link */}
          <p className={styles.loginLink}>
            Already have an account? <a href="/login">Login here</a>
          </p>
        </form>
      </main>
    </div>
  );
};

export default Registration;