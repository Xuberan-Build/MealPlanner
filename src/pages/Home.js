// src/pages/Home.jsx
import React from 'react';
import Header from '../components/layout/Header';
import BottomNav from '../components/layout/BottomNav';
import FeatureCard from '../features/home/FeatureCard';
import './Home.css';

const Home = () => {
  return (
    <div className="home-container">
      <Header />
      <div className="home-grid">
        <FeatureCard
          title="Recipe Book"
          description="Explore Recipes"
          path="/recipe-book"
        />
        <FeatureCard
          title="Meal Planner"
          description="Plan Your Meals"
          path="/meal-planner"
        />
        <FeatureCard
          title="Shopping List"
          description="Create a Shopping List"
          path="/shopping-list"
        />
        <FeatureCard
          title="Profile"
          description="View Profile"
          path="/profile"
        />
      </div>
      <BottomNav />
    </div>
  );
};

export default Home;
