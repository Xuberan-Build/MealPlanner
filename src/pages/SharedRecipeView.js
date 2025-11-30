// src/pages/SharedRecipeView.js

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Clock, Users, Heart, ChefHat, BookmarkPlus, Check } from 'lucide-react';
// import { trackShareLinkView, savePublicRecipe, markRecipeAsMade } from '../services/recipeSharingService';
import { auth } from '../firebase';
import './SharedRecipeView.css';

export default function SharedRecipeView() {
  const { linkId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState(null);
  const [author, setAuthor] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [marked, setMarked] = useState(false);

  const isLoggedIn = auth.currentUser !== null;

  useEffect(() => {
    loadSharedRecipe();
  }, [linkId]);

  // Check if user just logged in and has pending recipe save
  useEffect(() => {
    async function checkPendingSave() {
      if (!isLoggedIn || !recipe) return;

      const pendingSave = sessionStorage.getItem('pendingRecipeSave');
      if (pendingSave) {
        try {
          const { recipeId } = JSON.parse(pendingSave);

          // Auto-save the recipe
          if (recipeId === recipe.id) {
            console.log('Auto-saving recipe after signup...');
            // await savePublicRecipe(recipeId);
            console.warn('Public recipe sharing not yet implemented');
            setSaved(true);

            // Clear the pending save
            sessionStorage.removeItem('pendingRecipeSave');

            // Show success message and redirect
            setTimeout(() => {
              navigate('/recipe-book');
            }, 2000);
          }
        } catch (error) {
          console.error('Error auto-saving recipe:', error);
          sessionStorage.removeItem('pendingRecipeSave');
        }
      }
    }

    checkPendingSave();
  }, [isLoggedIn, recipe, navigate]);

  async function loadSharedRecipe() {
    setLoading(true);
    setError(null);

    try {
      // const result = await trackShareLinkView(linkId);
      console.warn('Share link tracking not yet implemented');
      const result = { recipe: null, author: null };

      if (!result || !result.resourceData) {
        throw new Error('Recipe not found or no longer available');
      }

      const { resourceData } = result;
      setRecipe(resourceData.recipeData);
      setAuthor({
        name: resourceData.authorName,
        image: resourceData.authorImage
      });

    } catch (err) {
      console.error('Error loading shared recipe:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveRecipe() {
    if (!isLoggedIn) {
      // Store intent to save recipe after signup
      sessionStorage.setItem('pendingRecipeSave', JSON.stringify({
        linkId,
        recipeId: recipe.id,
        recipeTitle: recipe.title
      }));

      // Redirect to signup with return path
      navigate(`/signup?redirect=${encodeURIComponent(`/shared/${linkId}`)}&action=save`);
      return;
    }

    setSaving(true);
    try {
      // await savePublicRecipe(recipe.id);
      console.warn('Public recipe sharing not yet implemented');
      setSaved(true);

      // Clear any pending save intent
      sessionStorage.removeItem('pendingRecipeSave');

      setTimeout(() => {
        navigate('/recipe-book');
      }, 1500);
    } catch (err) {
      console.error('Error saving recipe:', err);
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMadeThis() {
    if (!isLoggedIn) {
      navigate(`/signup?redirect=/shared/${linkId}`);
      return;
    }

    try {
      // await markRecipeAsMade(recipe.id);
      console.warn('Recipe made tracking not yet implemented');
      setMarked(true);
    } catch (err) {
      console.error('Error marking recipe:', err);
    }
  }

  if (loading) {
    return (
      <div className="shared-recipe-container">
        <div className="loading-container">
          <div className="spinner-large"></div>
          <p>Loading recipe...</p>
        </div>
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="shared-recipe-container">
        <div className="error-container">
          <h2>Recipe Not Found</h2>
          <p>{error || 'This recipe may have been removed or is no longer available.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-recipe-container">
      <div className="shared-recipe-header">
        <div className="recipe-hero">
          <h1>{recipe.title}</h1>
          {recipe.description && <p className="recipe-description">{recipe.description}</p>}

          <div className="recipe-meta">
            {recipe.prepTime && (
              <div className="meta-item">
                <Clock size={18} />
                <span>{recipe.prepTime} min</span>
              </div>
            )}
            {recipe.servings && (
              <div className="meta-item">
                <Users size={18} />
                <span>{recipe.servings} servings</span>
              </div>
            )}
            {recipe.difficulty && (
              <div className="meta-item">
                <ChefHat size={18} />
                <span>{recipe.difficulty}</span>
              </div>
            )}
          </div>

          <div className="author-info">
            <div className="author-avatar">
              {author.image ? (
                <img src={author.image} alt={author.name} />
              ) : (
                <div className="avatar-placeholder">
                  {author.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <span className="author-label">Recipe by</span>
              <span className="author-name">{author.name}</span>
            </div>
          </div>
        </div>

        <div className="action-buttons">
          <button
            onClick={handleSaveRecipe}
            disabled={saving || saved}
            className={`btn-save ${saved ? 'saved' : ''}`}
          >
            {saved ? (
              <>
                <Check size={20} />
                <span>Saved!</span>
              </>
            ) : (
              <>
                <BookmarkPlus size={20} />
                <span>{saving ? 'Saving...' : 'Save Recipe'}</span>
              </>
            )}
          </button>

          <button
            onClick={handleMadeThis}
            disabled={marked}
            className={`btn-secondary ${marked ? 'marked' : ''}`}
          >
            {marked ? (
              <>
                <Check size={20} />
                <span>Marked!</span>
              </>
            ) : (
              <>
                <Heart size={20} />
                <span>I Made This</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="recipe-content">
        <div className="ingredients-section">
          <h2>Ingredients</h2>
          {recipe.ingredients && recipe.ingredients.length > 0 ? (
            <ul className="ingredients-list">
              {recipe.ingredients.map((ingredient, index) => (
                <li key={index}>
                  {ingredient.amount} {ingredient.unit} {ingredient.ingredientId}
                </li>
              ))}
            </ul>
          ) : (
            <p>No ingredients listed</p>
          )}
        </div>

        <div className="instructions-section">
          <h2>Instructions</h2>
          {recipe.instructions ? (
            <div className="instructions-content">
              {recipe.instructions.split('\n').map((step, index) => (
                <p key={index} className="instruction-step">
                  {step}
                </p>
              ))}
            </div>
          ) : (
            <p>No instructions provided</p>
          )}
        </div>

        {recipe.dietType && (
          <div className="diet-tags">
            <span className="diet-tag">{recipe.dietType}</span>
          </div>
        )}
      </div>

      {!isLoggedIn && (
        <div className="signup-cta">
          <h3>Want to save this recipe?</h3>
          <p>Sign up for free to save recipes, create meal plans, and more!</p>
          <button
            onClick={() => navigate('/signup')}
            className="btn-primary-large"
          >
            Sign Up Free
          </button>
        </div>
      )}
    </div>
  );
}
