/**
 * SmartShoppingListItem
 *
 * Enhanced shopping list item with product matching integration
 * Shows product details when a specific product is selected
 * Allows switching between generic and specific product modes
 */

import React, { useState } from 'react';
import styles from './SmartShoppingListItem.module.css';
import ProductMatchModal from './ProductMatchModal';
import { Package, Edit3, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { formatPrice, calculateProductCoverage } from '../../../utils/productUtils';

const SmartShoppingListItem = ({
  item,
  onProductSelect,
  onQuantityChange,
  onNoteChange,
  onToggleHave,
  onClick
}) => {
  const [showProductModal, setShowProductModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [tempQuantity, setTempQuantity] = useState(item.quantity);
  const [tempNote, setTempNote] = useState(item.notes || '');
  const [showDetails, setShowDetails] = useState(false);

  // Determine if item has a selected product
  const hasProduct = item.productMatch?.selectedProduct;
  const selectedProduct = item.productMatch?.selectedProduct;

  const handleQuantitySubmit = () => {
    if (onQuantityChange) {
      onQuantityChange(item.id, tempQuantity);
    }
    setIsEditing(false);
  };

  const handleNoteSubmit = () => {
    if (onNoteChange) {
      onNoteChange(item.id, tempNote);
    }
    setIsEditing(false);
  };

  const handleProductSelection = (product) => {
    if (onProductSelect) {
      onProductSelect(item.id, product);
    }
  };

  const handleItemClick = (e) => {
    // Don't trigger if clicking on interactive elements
    if (e.target.closest('button') || e.target.closest('input')) {
      return;
    }

    if (onClick) {
      onClick(item);
    }
  };

  // Calculate coverage if we have a product
  const coverage = hasProduct && selectedProduct
    ? calculateProductCoverage(
        { quantity: item.quantity, unit: item.unit, ingredient: item.name },
        selectedProduct
      )
    : null;

  return (
    <>
      <div
        className={`${styles.smartItem} ${item.alreadyHave ? styles.alreadyHave : ''} ${hasProduct ? styles.hasProduct : ''}`}
        onClick={handleItemClick}
      >
        {/* Main Content */}
        <div className={styles.itemHeader}>
          {/* Left: Product Image or Icon */}
          <div className={styles.itemIcon}>
            {hasProduct && selectedProduct?.imageSmallUrl ? (
              <img
                src={selectedProduct.imageSmallUrl}
                alt={selectedProduct.productName}
                className={styles.productImage}
              />
            ) : (
              <div className={styles.placeholderIcon}>
                <Package size={24} />
              </div>
            )}
          </div>

          {/* Center: Item Info */}
          <div className={styles.itemInfo}>
            {/* Product Name or Generic Name */}
            <h3 className={styles.itemName}>
              {hasProduct ? selectedProduct.productName : item.name}
            </h3>

            {/* Brand & Quantity */}
            <div className={styles.itemMeta}>
              {hasProduct && selectedProduct.brand && (
                <span className={styles.brand}>{selectedProduct.brand}</span>
              )}
              {hasProduct && selectedProduct.brand && <span className={styles.separator}>•</span>}
              <span className={styles.quantity}>
                {item.quantity} {item.unit}
              </span>
              {hasProduct && selectedProduct.quantity && (
                <>
                  <span className={styles.separator}>•</span>
                  <span className={styles.productSize}>{selectedProduct.quantity}</span>
                </>
              )}
            </div>

            {/* Match Reason (if product matched) */}
            {hasProduct && item.productMatch?.matchReason && (
              <div className={styles.matchReason}>
                {item.productMatch.matchReason}
              </div>
            )}

            {/* Category */}
            <div className={styles.category}>{item.category}</div>
          </div>

          {/* Right: Actions */}
          <div className={styles.itemActions}>
            {hasProduct ? (
              <button
                className={styles.changeProductButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProductModal(true);
                }}
                title="Change product"
              >
                <Edit3 size={18} />
              </button>
            ) : (
              <button
                className={styles.findProductButton}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowProductModal(true);
                }}
                title="Find specific product"
              >
                <Package size={18} />
                Find Product
              </button>
            )}

            <button
              className={`${styles.haveButton} ${item.alreadyHave ? styles.active : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleHave) {
                  onToggleHave(item.id);
                }
              }}
              title={item.alreadyHave ? "Mark as needed" : "Mark as already have"}
            >
              <Check size={20} />
            </button>
          </div>
        </div>

        {/* Product Details (if has product) */}
        {hasProduct && (
          <div className={styles.productDetails}>
            <div className={styles.detailsRow}>
              {/* Price */}
              {selectedProduct.price && (
                <div className={styles.priceInfo}>
                  <span className={styles.price}>{formatPrice(selectedProduct.price)}</span>
                </div>
              )}

              {/* Coverage */}
              {coverage && coverage.comparable && (
                <div className={styles.coverageInfo}>
                  <span className={styles.coverageText}>{coverage.message}</span>
                </div>
              )}

              {/* Badges */}
              <div className={styles.badges}>
                {selectedProduct.nutritionGrade && (
                  <span className={`${styles.badge} ${styles.nutritionBadge}`}>
                    Grade {selectedProduct.nutritionGrade.toUpperCase()}
                  </span>
                )}
                {selectedProduct.isOrganic && (
                  <span className={styles.badge}>🌱 Organic</span>
                )}
              </div>
            </div>

            {/* Toggle Details */}
            <button
              className={styles.toggleDetails}
              onClick={(e) => {
                e.stopPropagation();
                setShowDetails(!showDetails);
              }}
            >
              {showDetails ? 'Less details' : 'More details'}
              {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        )}

        {/* Expanded Product Details */}
        {hasProduct && showDetails && selectedProduct && (
          <div className={styles.expandedDetails}>
            {/* Nutrition Summary */}
            {selectedProduct.nutriments && (
              <div className={styles.nutritionSummary}>
                {selectedProduct.nutriments.energyKcal > 0 && (
                  <div className={styles.nutrientItem}>
                    <span>Calories</span>
                    <strong>{Math.round(selectedProduct.nutriments.energyKcal)}</strong>
                  </div>
                )}
                {selectedProduct.nutriments.proteins > 0 && (
                  <div className={styles.nutrientItem}>
                    <span>Protein</span>
                    <strong>{selectedProduct.nutriments.proteins}g</strong>
                  </div>
                )}
                {selectedProduct.nutriments.carbohydrates > 0 && (
                  <div className={styles.nutrientItem}>
                    <span>Carbs</span>
                    <strong>{selectedProduct.nutriments.carbohydrates}g</strong>
                  </div>
                )}
              </div>
            )}

            {/* Labels */}
            {selectedProduct.labels && selectedProduct.labels.length > 0 && (
              <div className={styles.labels}>
                {selectedProduct.labels.slice(0, 3).map((label, index) => (
                  <span key={index} className={styles.labelChip}>{label}</span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div className={styles.notes}>
            <span className={styles.noteText}>{item.notes}</span>
          </div>
        )}

        {/* Progress Indicator */}
        <div className={styles.progressIndicator}>
          <div className={`${styles.progressBar} ${item.alreadyHave ? styles.complete : ''}`} />
        </div>
      </div>

      {/* Product Match Modal */}
      {showProductModal && (
        <ProductMatchModal
          isOpen={showProductModal}
          onClose={() => setShowProductModal(false)}
          ingredient={{
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category
          }}
          currentProduct={selectedProduct}
          onProductSelect={handleProductSelection}
        />
      )}
    </>
  );
};

export default SmartShoppingListItem;
