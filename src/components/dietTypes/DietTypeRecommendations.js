import React from 'react';
import { Lightbulb, X, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import './DietTypeRecommendations.css';

/**
 * DietTypeRecommendations - Display AI-based diet type suggestions
 * Features:
 * - Show recommendations with confidence levels
 * - Display reasoning for each suggestion
 * - One-click apply
 * - Dismiss individual or all suggestions
 * - Beautiful, intuitive UX
 */
const DietTypeRecommendations = ({
  recommendations = [],
  onApply,
  onDismiss,
  onDismissAll,
  className = ''
}) => {
  if (!recommendations || recommendations.length === 0) {
    return null;
  }

  // Group by confidence
  const highConfidence = recommendations.filter(r => r.confidence === 'high');
  const mediumConfidence = recommendations.filter(r => r.confidence === 'medium');
  const lowConfidence = recommendations.filter(r => r.confidence === 'low');

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  };

  const getConfidenceIcon = (confidence) => {
    switch (confidence) {
      case 'high':
        return <CheckCircle size={16} />;
      case 'medium':
        return <Lightbulb size={16} />;
      case 'low':
        return <AlertCircle size={16} />;
      default:
        return <Lightbulb size={16} />;
    }
  };

  const getConfidenceLabel = (confidence) => {
    switch (confidence) {
      case 'high':
        return 'High Confidence';
      case 'medium':
        return 'Medium Confidence';
      case 'low':
        return 'Suggested';
      default:
        return 'Suggested';
    }
  };

  const renderRecommendation = (rec, index) => {
    const confidenceClass = getConfidenceColor(rec.confidence);

    return (
      <div key={index} className={`recommendation-item ${confidenceClass}`}>
        <div className="recommendation-header">
          <div className="recommendation-title">
            <div className={`confidence-badge ${confidenceClass}`}>
              {getConfidenceIcon(rec.confidence)}
              <span>{rec.dietType}</span>
            </div>
            <span className="confidence-label">{getConfidenceLabel(rec.confidence)}</span>
          </div>
          <div className="recommendation-actions">
            <button
              type="button"
              className="apply-button"
              onClick={() => onApply(rec.dietType)}
              title="Add this diet type"
            >
              <Plus size={16} />
              Add
            </button>
            <button
              type="button"
              className="dismiss-button"
              onClick={() => onDismiss(index)}
              title="Dismiss suggestion"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {rec.reason && (
          <p className="recommendation-reason">{rec.reason}</p>
        )}
      </div>
    );
  };

  return (
    <div className={`diet-type-recommendations ${className}`}>
      <div className="recommendations-header">
        <div className="header-title">
          <Lightbulb size={20} />
          <h3>Suggested Diet Types</h3>
          <span className="suggestion-count">{recommendations.length}</span>
        </div>
        {recommendations.length > 1 && (
          <button
            type="button"
            className="dismiss-all-button"
            onClick={onDismissAll}
          >
            Dismiss All
          </button>
        )}
      </div>

      <div className="recommendations-list">
        {/* High Confidence */}
        {highConfidence.length > 0 && (
          <div className="confidence-group">
            {highConfidence.map((rec, index) => renderRecommendation(rec, index))}
          </div>
        )}

        {/* Medium Confidence */}
        {mediumConfidence.length > 0 && (
          <div className="confidence-group">
            {mediumConfidence.map((rec, index) =>
              renderRecommendation(rec, index + highConfidence.length)
            )}
          </div>
        )}

        {/* Low Confidence */}
        {lowConfidence.length > 0 && (
          <div className="confidence-group">
            {lowConfidence.map((rec, index) =>
              renderRecommendation(rec, index + highConfidence.length + mediumConfidence.length)
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DietTypeRecommendations;
