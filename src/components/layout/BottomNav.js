import React from 'react';
import { Link } from 'react-router-dom';
import './BottomNav.css'; // Keep the neumorphic styling

function BottomNav() {
  return (
    <nav className="bottom-nav">
      <Link to="/recipe-book" className="nav-circle">
        <div className="icon">R</div> {/* Simple text "R" for Recipe Book */}
      </Link>
      <Link to="/meal-planner" className="nav-circle">
        <div className="icon">M</div> {/* Simple text "M" for Meal Planner */}
      </Link>
      <Link to="/" className="nav-circle large-circle">
        <div className="icon">+</div> {/* Central Prominent Button with "+" */}
      </Link>
      <Link to="/shopping-list" className="nav-circle">
        <div className="icon">S</div> {/* Simple text "S" for Shopping List */}
      </Link>
      <Link to="/profile" className="nav-circle">
        <div className="icon">P</div> {/* Simple text "P" for Profile */}
      </Link>
    </nav>
  );
}

export default BottomNav;
