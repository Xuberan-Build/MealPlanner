import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ForgotPassword.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import { auth } from '../../firebase'; // Import Firebase auth
import { sendPasswordResetEmail } from 'firebase/auth'; // Import Firebase auth function
const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Handle email input change
  const handleChange = (e) => {
    setEmail(e.target.value);
    setError('');
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Send password reset email using Firebase Auth
      await sendPasswordResetEmail(auth, email);
      
      console.log('Password reset email sent successfully to:', email);
      setSuccess(true); // Show the success message card
      
    } catch (error) {
      console.error('Error sending password reset email:', error.code, error.message);
      let errorMessage = 'Failed to send password reset email. Please try again.';
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Please enter a valid email address.';
      }
      // Add more specific error handling as needed
      setError(errorMessage);
    } finally {
      setIsSubmitting(false); // Ensure this runs even if there's an error
    }
  };

  return (
    <div className={styles.container}>
      <Header />
      <main className={styles.main}>
        <h1 className={styles.title}>Reset Your Password</h1>
        <p className={styles.subtitle}>
          Enter your email address and we'll send you a link to reset your password.
        </p>
        
        {success ? (
          <div className={styles.successCard}>
            <h2 className={styles.successTitle}>Check Your Email</h2>
            <p className={styles.successMessage}>
              We've sent a password reset link to <strong>{email}</strong>. 
              Please check your inbox and follow the instructions to reset your password.
            </p>
            <p className={styles.successNote}>
              If you don't see the email, please check your spam folder.
            </p>
            <button 
              onClick={() => navigate('/login')} 
              className={styles.returnButton}
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="email" className={styles.label}>Email Address</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={handleChange}
                className={error ? styles.inputError : styles.input}
                placeholder="Enter your email address"
                disabled={isSubmitting}
              />
              {error && <p className={styles.errorText}>{error}</p>}
            </div>
            
            <button
              type="submit"
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Sending...' : 'Send Reset Link'}
            </button>
            
            <button
              type="button"
              onClick={() => navigate('/login')}
              className={styles.cancelButton}
            >
              Back to Login
            </button>
          </form>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default ForgotPassword;
