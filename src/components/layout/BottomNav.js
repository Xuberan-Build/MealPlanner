import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Calendar, Plus, ShoppingCart, User } from 'lucide-react';
import './BottomNav.css';
import { trackFeatureUsage } from '../../services/userMetricsService';

function BottomNav() {
  const navigate = useNavigate();

  const handleAddRecipe = () => {
    navigate('/recipe-book?openForm=true');
  };

  const handleNavClick = (featureName) => {
    trackFeatureUsage(null, featureName);
  };

  return (
    <nav className="bottom-nav">
      <Link to="/recipe-book" className="nav-circle" onClick={() => handleNavClick('recipeBook')}>
        <BookOpen className="icon" size={24} strokeWidth={2} />
      </Link>
      <Link to="/meal-planner" className="nav-circle" onClick={() => handleNavClick('mealPlanner')}>
        <Calendar className="icon" size={24} strokeWidth={2} />
      </Link>
      <button onClick={handleAddRecipe} className="nav-circle large-circle" type="button">
        <Plus className="icon" size={32} strokeWidth={2.5} />
      </button>
      <Link to="/shopping-list" className="nav-circle" onClick={() => handleNavClick('shoppingList')}>
        <ShoppingCart className="icon" size={24} strokeWidth={2} />
      </Link>
      <Link to="/profile" className="nav-circle" onClick={() => handleNavClick('profile')}>
        <User className="icon" size={24} strokeWidth={2} />
      </Link>
    </nav>
  );
}

export default BottomNav;
