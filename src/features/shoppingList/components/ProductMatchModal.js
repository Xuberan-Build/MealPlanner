/**
 * ProductMatchModal
 *
 * Modal for selecting specific products for a shopping list ingredient
 * Shows matched products with scores, allows comparison, and product selection
 */

import React, { useState, useEffect } from 'react';
import styles from './ProductMatchModal.module.css';
import ProductCard from './ProductCard';
import { matchIngredientToProducts } from '../../../services/productMatchingService';
import { getUserPreferences } from '../../../services/userProductPreferencesService';
import { X, Search, Filter, TrendingUp } from 'lucide-react';

const ProductMatchModal = ({
  isOpen,
  onClose,
  ingredient,
  currentProduct = null,
  onProductSelect
}) => {
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(currentProduct);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchMode, setSearchMode] = useState('smart'); // 'smart' or 'manual'
  const [manualSearch, setManualSearch] = useState('');
  const [sortBy, setSortBy] = useState('score'); // 'score', 'price', 'nutrition'
  const [showFilters, setShowFilters] = useState(false);

  // Load products when modal opens
  useEffect(() => {
    if (isOpen && ingredient) {
      loadProducts();
    }
  }, [isOpen, ingredient]);

  const loadProducts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get user preferences
      const userPrefs = await getUserPreferences();

      // Match ingredient to products
      const matches = await matchIngredientToProducts(ingredient, {
        userPreferences: userPrefs,
        maxResults: 15,
        minScore: 0.2
      });

      setProducts(matches);

      // Auto-select top match if no product selected
      if (!selectedProduct && matches.length > 0) {
        setSelectedProduct(matches[0].product);
      }

    } catch (err) {
      console.error('Error loading products:', err);
      setError('Failed to load products. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
  };

  const handleConfirmSelection = () => {
    if (selectedProduct && onProductSelect) {
      onProductSelect(selectedProduct);
    }
    onClose();
  };

  const handleKeepGeneric = () => {
    if (onProductSelect) {
      onProductSelect(null); // null = keep as generic ingredient
    }
    onClose();
  };

  // Sort products
  const getSortedProducts = () => {
    if (!products || products.length === 0) return [];

    const sorted = [...products];

    switch (sortBy) {
      case 'price':
        return sorted.sort((a, b) => {
          const priceA = a.product.price || 999;
          const priceB = b.product.price || 999;
          return priceA - priceB;
        });

      case 'nutrition':
        return sorted.sort((a, b) => {
          const gradeOrder = { 'a': 5, 'b': 4, 'c': 3, 'd': 2, 'e': 1, '': 0 };
          const gradeA = gradeOrder[a.product.nutritionGrade?.toLowerCase()] || 0;
          const gradeB = gradeOrder[b.product.nutritionGrade?.toLowerCase()] || 0;
          return gradeB - gradeA;
        });

      case 'score':
      default:
        return sorted.sort((a, b) => b.score - a.score);
    }
  };

  const sortedProducts = getSortedProducts();

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.headerContent}>
            <h2>Find Product</h2>
            <p className={styles.ingredientName}>{ingredient?.name}</p>
            {ingredient?.quantity && ingredient?.unit && (
              <p className={styles.ingredientQuantity}>
                Need: {ingredient.quantity} {ingredient.unit}
              </p>
            )}
          </div>
          <button className={styles.closeButton} onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Controls */}
        <div className={styles.controls}>
          <div className={styles.sortControls}>
            <label>Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="score">Best Match</option>
              <option value="price">Price</option>
              <option value="nutrition">Nutrition</option>
            </select>
          </div>

          <button
            className={styles.filterButton}
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter size={18} />
            Filters
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className={styles.loadingState}>
            <div className={styles.spinner}></div>
            <p>Finding matching products...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className={styles.errorState}>
            <p>{error}</p>
            <button onClick={loadProducts} className={styles.retryButton}>
              Try Again
            </button>
          </div>
        )}

        {/* Products List */}
        {!isLoading && !error && sortedProducts.length > 0 && (
          <div className={styles.productsContainer}>
            <div className={styles.matchInfo}>
              <TrendingUp size={16} />
              <span>Found {sortedProducts.length} matching products</span>
            </div>

            <div className={styles.productsList}>
              {sortedProducts.map((match) => (
                <ProductCard
                  key={match.product.barcode}
                  product={match.product}
                  matchScore={match.score}
                  matchReason={match.reason}
                  confidence={match.confidence}
                  isSelected={selectedProduct?.barcode === match.product.barcode}
                  onClick={() => handleProductSelect(match.product)}
                  ingredient={ingredient}
                />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!isLoading && !error && sortedProducts.length === 0 && (
          <div className={styles.noResults}>
            <p>No matching products found</p>
            <p className={styles.noResultsSub}>
              Try keeping this as a generic ingredient
            </p>
          </div>
        )}

        {/* Footer Actions */}
        <div className={styles.modalFooter}>
          <button
            className={styles.genericButton}
            onClick={handleKeepGeneric}
          >
            Keep as "{ingredient?.name}"
          </button>

          <button
            className={styles.confirmButton}
            onClick={handleConfirmSelection}
            disabled={!selectedProduct}
          >
            {selectedProduct ? `Select ${selectedProduct.brand || 'Product'}` : 'Select Product'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductMatchModal;
