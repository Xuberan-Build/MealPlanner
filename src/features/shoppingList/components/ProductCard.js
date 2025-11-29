/**
 * ProductCard
 *
 * Displays a product with match score, nutritional info, and selection state
 */

import React, { useState } from 'react';
import styles from './ProductCard.module.css';
import { Check, ChevronDown, ChevronUp, Award, DollarSign } from 'lucide-react';
import { calculateProductCoverage, formatPrice } from '../../../utils/productUtils';

const ProductCard = ({
  product,
  matchScore = 0,
  matchReason = '',
  confidence = 'medium',
  isSelected = false,
  onClick,
  ingredient = null,
  showDetails = false
}) => {
  const [expanded, setExpanded] = useState(showDetails);

  // Calculate how much this product covers the ingredient need
  const coverage = ingredient
    ? calculateProductCoverage(ingredient, product)
    : null;

  // Get confidence badge color
  const getConfidenceColor = () => {
    switch (confidence) {
      case 'high': return '#5cb85c';
      case 'medium': return '#f0ad4e';
      case 'low': return '#d9534f';
      default: return '#999';
    }
  };

  // Format match score as percentage
  const matchPercentage = Math.round(matchScore * 100);

  // Get nutrition grade color
  const getNutritionGradeColor = (grade) => {
    const gradeMap = {
      'a': '#5cb85c',
      'b': '#92c353',
      'c': '#f0ad4e',
      'd': '#f89406',
      'e': '#d9534f'
    };
    return gradeMap[grade?.toLowerCase()] || '#999';
  };

  return (
    <div
      className={`${styles.productCard} ${isSelected ? styles.selected : ''}`}
      onClick={onClick}
    >
      {/* Selection Indicator */}
      {isSelected && (
        <div className={styles.selectedIndicator}>
          <Check size={20} />
        </div>
      )}

      <div className={styles.cardContent}>
        {/* Product Image */}
        <div className={styles.imageContainer}>
          {product.imageSmallUrl || product.imageThumbnailUrl ? (
            <img
              src={product.imageSmallUrl || product.imageThumbnailUrl}
              alt={product.productName}
              className={styles.productImage}
              loading="lazy"
            />
          ) : (
            <div className={styles.placeholderImage}>
              <span>📦</span>
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className={styles.productInfo}>
          {/* Top Row: Brand & Match Score */}
          <div className={styles.topRow}>
            {product.brand && (
              <span className={styles.brand}>{product.brand}</span>
            )}
            {matchScore > 0 && (
              <div className={styles.matchBadge} style={{ borderColor: getConfidenceColor() }}>
                <span className={styles.matchScore}>{matchPercentage}%</span>
                <span className={styles.matchLabel}>match</span>
              </div>
            )}
          </div>

          {/* Product Name */}
          <h3 className={styles.productName}>{product.productName}</h3>

          {/* Quick Info */}
          <div className={styles.quickInfo}>
            {product.quantity && (
              <span className={styles.quantity}>{product.quantity}</span>
            )}

            {product.nutritionGrade && (
              <div
                className={styles.nutritionGrade}
                style={{ backgroundColor: getNutritionGradeColor(product.nutritionGrade) }}
              >
                {product.nutritionGrade.toUpperCase()}
              </div>
            )}

            {product.isOrganic && (
              <span className={styles.badge}>🌱 Organic</span>
            )}
            {product.isVegan && (
              <span className={styles.badge}>🌿 Vegan</span>
            )}
          </div>

          {/* Match Reason */}
          {matchReason && (
            <div className={styles.matchReason}>
              <Award size={14} />
              <span>{matchReason}</span>
            </div>
          )}

          {/* Coverage Info */}
          {coverage && coverage.comparable && (
            <div className={styles.coverage}>
              <span className={styles.coverageMessage}>{coverage.message}</span>
            </div>
          )}

          {/* Price */}
          {product.price && (
            <div className={styles.priceRow}>
              <DollarSign size={16} />
              <span className={styles.price}>{formatPrice(product.price)}</span>
            </div>
          )}

          {/* Expand/Collapse Toggle */}
          <button
            className={styles.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
          >
            {expanded ? 'Less info' : 'More info'}
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className={styles.expandedDetails}>
          {/* Ingredients */}
          {product.ingredientsText && (
            <div className={styles.detailSection}>
              <h4>Ingredients</h4>
              <p className={styles.ingredientsText}>{product.ingredientsText}</p>
            </div>
          )}

          {/* Nutrition Info */}
          {product.nutriments && Object.keys(product.nutriments).length > 0 && (
            <div className={styles.detailSection}>
              <h4>Nutrition (per serving)</h4>
              <div className={styles.nutritionGrid}>
                {product.nutriments.energyKcal > 0 && (
                  <div className={styles.nutrientItem}>
                    <span className={styles.nutrientLabel}>Calories</span>
                    <span className={styles.nutrientValue}>{Math.round(product.nutriments.energyKcal)}</span>
                  </div>
                )}
                {product.nutriments.proteins > 0 && (
                  <div className={styles.nutrientItem}>
                    <span className={styles.nutrientLabel}>Protein</span>
                    <span className={styles.nutrientValue}>{product.nutriments.proteins}g</span>
                  </div>
                )}
                {product.nutriments.carbohydrates > 0 && (
                  <div className={styles.nutrientItem}>
                    <span className={styles.nutrientLabel}>Carbs</span>
                    <span className={styles.nutrientValue}>{product.nutriments.carbohydrates}g</span>
                  </div>
                )}
                {product.nutriments.fat > 0 && (
                  <div className={styles.nutrientItem}>
                    <span className={styles.nutrientLabel}>Fat</span>
                    <span className={styles.nutrientValue}>{product.nutriments.fat}g</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Labels & Certifications */}
          {product.labels && product.labels.length > 0 && (
            <div className={styles.detailSection}>
              <h4>Labels & Certifications</h4>
              <div className={styles.labelsList}>
                {product.labels.slice(0, 5).map((label, index) => (
                  <span key={index} className={styles.labelChip}>{label}</span>
                ))}
              </div>
            </div>
          )}

          {/* Allergens */}
          {product.allergens && (
            <div className={styles.detailSection}>
              <h4>Allergens</h4>
              <p className={styles.allergensText}>{product.allergens}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProductCard;
