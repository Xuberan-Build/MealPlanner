import React from 'react';
import { useNavigate } from 'react-router-dom';
import './FeatureCard.css';

const FeatureCard = ({ title, description, path }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(path);
  };

  return (
    <div className="feature-card" onClick={handleClick}>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
};

export default FeatureCard;
