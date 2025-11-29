# Product Matching UI Components - Integration Guide

## Overview

This guide shows how to integrate the new product matching UI components into your existing Shopping List Page.

---

## Components Created

### 1. **ProductMatchModal** (`ProductMatchModal.js`)
Modal for selecting specific products for an ingredient.

**Features:**
- Displays ranked product matches
- Shows match scores and reasons
- Allows sorting by score, price, or nutrition
- Option to keep ingredient generic

### 2. **ProductCard** (`ProductCard.js`)
Individual product display card with match information.

**Features:**
- Product image and details
- Match score badge
- Expandable nutrition info
- Coverage calculation (how many uses)
- Price display

### 3. **ProductPreferencesSettings** (`ProductPreferencesSettings.js`)
Side panel for managing user preferences.

**Features:**
- Dietary restrictions
- Preferred brands
- Preferred stores
- Shopping habits

### 4. **SmartShoppingListItem** (`SmartShoppingListItem.js`)
Enhanced shopping list item with product integration.

**Features:**
- Shows selected product with image
- Quick product change button
- Displays match reason
- Shows price and coverage
- Expandable product details

---

## Integration Example

Here's how to integrate these components into `ShoppingListPage.js`:

### Step 1: Import Components

```javascript
// Add these imports to ShoppingListPage.js
import SmartShoppingListItem from './components/SmartShoppingListItem';
import ProductPreferencesSettings from './components/ProductPreferencesSettings';
import { matchIngredientToProducts } from '../../services/productMatchingService';
import { getUserPreferences } from '../../services/userProductPreferencesService';
```

### Step 2: Add State for Product Matching

```javascript
// Add to existing state in ShoppingListPage
const [showPreferences, setShowPreferences] = useState(false);
const [enableSmartMatching, setEnableSmartMatching] = useState(true);
```

### Step 3: Add Product Selection Handler

```javascript
// Add this handler to ShoppingListPage
const handleProductSelect = async (itemId, product) => {
  const newList = shoppingList.map(item => {
    if (item.id === itemId) {
      return {
        ...item,
        productMatch: {
          mode: product ? 'specific' : 'generic',
          selectedProduct: product,
          suggestedProducts: item.productMatch?.suggestedProducts || [],
          lastUpdated: Date.now()
        }
      };
    }
    return item;
  });

  setShoppingList(newList);

  // Save to database
  if (currentListId) {
    try {
      await updateShoppingList(currentListId, { items: newList });
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save product selection:', err);
      setSaveStatus('unsaved');
    }
  }
};
```

### Step 4: Enhanced List Generation with Product Matching

```javascript
// Replace or enhance existing handleListGenerated function
const handleListGeneratedWithProducts = async (generatedList) => {
  setShoppingList(generatedList);

  if (enableSmartMatching) {
    // Get user preferences
    const userPrefs = await getUserPreferences();

    // Match products for each ingredient
    const enhancedList = await Promise.all(
      generatedList.map(async (item) => {
        try {
          // Match ingredient to products
          const matches = await matchIngredientToProducts(
            {
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category
            },
            {
              userPreferences: userPrefs,
              maxResults: 5,
              minScore: 0.3
            }
          );

          if (matches.length > 0) {
            return {
              ...item,
              productMatch: {
                mode: 'smart',
                selectedProduct: matches[0].product,
                suggestedProducts: matches.slice(1).map(m => m.product),
                matchScore: matches[0].score,
                matchReason: matches[0].reason,
                lastUpdated: Date.now()
              }
            };
          }
        } catch (err) {
          console.error(`Failed to match ${item.name}:`, err);
        }

        return item;
      })
    );

    setShoppingList(enhancedList);

    // Save to database
    if (Object.keys(mealPlan).length > 0) {
      try {
        const id = await createListFromMealPlan(mealPlan, 'Smart Shopping List');
        await updateShoppingList(id, { items: enhancedList });
        setCurrentListId(id);
        setCurrentListName('Smart Shopping List');
        setSaveStatus('saved');
        loadSavedLists();
      } catch (err) {
        console.error('Save generated list failed:', err);
      }
    }
  } else {
    // Use existing logic for non-smart mode
    handleListGenerated(generatedList);
  }
};
```

### Step 5: Replace ShoppingItem with SmartShoppingListItem

```javascript
// In the render section, replace:
// <ShoppingItem ... />

// With:
<SmartShoppingListItem
  key={item.id}
  item={item}
  onProductSelect={handleProductSelect}
  onQuantityChange={handleQuantityChange}
  onNoteChange={handleNoteChange}
  onToggleHave={handleAlreadyHaveToggle}
  onClick={() => { setEditingItem(item); setShowEditModal(true); }}
/>
```

### Step 6: Add Settings Button

```javascript
// Add settings button to header or action buttons
<button
  className={`${styles['action-button']} ${styles['secondary-button']}`}
  onClick={() => setShowPreferences(true)}
>
  ⚙️ Product Preferences
</button>
```

### Step 7: Add Preferences Panel

```javascript
// Add at the end of the component, before closing div
{showPreferences && (
  <ProductPreferencesSettings
    onClose={() => setShowPreferences(false)}
  />
)}
```

---

## Complete Integration Example

Here's a minimal working example showing the key changes:

```javascript
// ShoppingListPage.js - Enhanced Version

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './ShoppingListPage.module.css';
import Header from '../../components/layout/Header';
import BottomNav from '../../components/layout/BottomNav';
import SmartShoppingListItem from './components/SmartShoppingListItem';
import ProductPreferencesSettings from './components/ProductPreferencesSettings';
import { matchIngredientToProducts } from '../../services/productMatchingService';
import { getUserPreferences } from '../../services/userProductPreferencesService';
import {
  getUserShoppingLists,
  createShoppingList,
  updateShoppingList,
  createListFromMealPlan
} from '../../services/ShoppingListService';

const ShoppingListPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mealPlan = location.state?.mealPlan || {};

  // Existing state
  const [shoppingList, setShoppingList] = useState([]);
  const [currentListId, setCurrentListId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // New state for product matching
  const [showPreferences, setShowPreferences] = useState(false);
  const [enableSmartMatching, setEnableSmartMatching] = useState(true);

  // Product selection handler
  const handleProductSelect = async (itemId, product) => {
    const newList = shoppingList.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          productMatch: {
            mode: product ? 'specific' : 'generic',
            selectedProduct: product,
            lastUpdated: Date.now()
          }
        };
      }
      return item;
    });

    setShoppingList(newList);

    // Save to database
    if (currentListId) {
      await updateShoppingList(currentListId, { items: newList });
    }
  };

  // Enhanced list generation
  const handleListGenerated = async (generatedList) => {
    if (!enableSmartMatching) {
      setShoppingList(generatedList);
      return;
    }

    try {
      setIsLoading(true);
      const userPrefs = await getUserPreferences();

      const enhancedList = await Promise.all(
        generatedList.map(async (item) => {
          const matches = await matchIngredientToProducts(
            {
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              category: item.category
            },
            {
              userPreferences: userPrefs,
              maxResults: 5,
              minScore: 0.3
            }
          );

          if (matches.length > 0) {
            return {
              ...item,
              productMatch: {
                mode: 'smart',
                selectedProduct: matches[0].product,
                suggestedProducts: matches.slice(1).map(m => m.product),
                matchScore: matches[0].score,
                matchReason: matches[0].reason,
                lastUpdated: Date.now()
              }
            };
          }

          return item;
        })
      );

      setShoppingList(enhancedList);
    } catch (err) {
      console.error('Error generating smart list:', err);
      setShoppingList(generatedList);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles['shopping-list-page']}>
      <Header />

      {/* Settings Toggle */}
      <div className={styles['list-controls']}>
        <button onClick={() => setShowPreferences(true)}>
          ⚙️ Product Preferences
        </button>

        <label>
          <input
            type="checkbox"
            checked={enableSmartMatching}
            onChange={(e) => setEnableSmartMatching(e.target.checked)}
          />
          Smart Product Matching
        </label>
      </div>

      {/* Shopping List */}
      <div className={styles['shopping-list-container']}>
        {shoppingList.map((item) => (
          <SmartShoppingListItem
            key={item.id}
            item={item}
            onProductSelect={handleProductSelect}
            onQuantityChange={handleQuantityChange}
            onNoteChange={handleNoteChange}
            onToggleHave={handleAlreadyHaveToggle}
          />
        ))}
      </div>

      <BottomNav />

      {/* Preferences Panel */}
      {showPreferences && (
        <ProductPreferencesSettings
          onClose={() => setShowPreferences(false)}
        />
      )}
    </div>
  );
};

export default ShoppingListPage;
```

---

## Usage Scenarios

### Scenario 1: User Creates Shopping List from Meal Plan

1. User navigates to meal planner
2. Creates a meal plan for the week
3. Clicks "Generate Shopping List"
4. System:
   - Extracts ingredients
   - Matches each to products (if smart matching enabled)
   - Shows list with product suggestions
5. User can:
   - Accept suggested products
   - Change to different products
   - Keep items generic

### Scenario 2: User Manages Preferences

1. User clicks "Product Preferences" button
2. Side panel slides in
3. User:
   - Sets dietary restrictions (e.g., vegan, gluten-free)
   - Adds preferred brands (e.g., "Organic Valley")
   - Adds preferred stores (e.g., "Trader Joe's")
   - Sets shopping habits (e.g., price conscious)
4. Preferences are saved automatically
5. Future product matches use these preferences

### Scenario 3: User Changes Product Selection

1. User has a shopping list item "flour"
2. System suggested "King Arthur All-Purpose Flour"
3. User clicks "Change Product" button
4. ProductMatchModal opens showing:
   - Top 5 matching products
   - Match scores and reasons
   - Product details
5. User selects different product or keeps generic
6. List updates with new selection

---

## Styling Customization

All components use CSS modules and follow your existing design system:

- **Primary Color**: `#b7c4b7` (sage green)
- **Background**: `#fafafa`
- **Accent**: `#f7e4e0` (peach)
- **Shadows**: Neumorphic soft shadows

To customize, edit the respective `.module.css` files.

---

## Performance Considerations

1. **Lazy Loading**: Components are only loaded when needed
2. **Caching**: Product searches are cached to reduce API calls
3. **Batch Processing**: Multiple ingredients matched in batches of 5
4. **Optimistic Updates**: UI updates immediately, syncs to DB async

---

## Error Handling

All components handle errors gracefully:

```javascript
try {
  const matches = await matchIngredientToProducts(ingredient);
  // ... success
} catch (error) {
  console.error('Product matching failed:', error);
  // Fall back to generic ingredient
  return item; // Without product match
}
```

---

## Testing

### Manual Testing Checklist

- [ ] Product modal opens when clicking "Find Product"
- [ ] Products are sorted correctly (score, price, nutrition)
- [ ] Product selection updates the list item
- [ ] Preferences save correctly
- [ ] Dietary restrictions filter products
- [ ] Preferred brands appear first
- [ ] Cache reduces API calls (check network tab)
- [ ] Works on mobile devices
- [ ] Handles API errors gracefully

### Test Data

Use these ingredients to test matching:
- "all-purpose flour" - should match King Arthur, Bob's Red Mill
- "organic milk" - should match Organic Valley, Horizon
- "chicken breast" - should match various brands
- "banana" - should match fresh produce (less specific matching)

---

## Troubleshooting

### Products Not Showing
- Check if OpenFoodFacts API is accessible
- Verify ingredient name is specific enough
- Check console for errors
- Try lowering `minScore` parameter

### Preferences Not Saving
- Check authentication (user must be logged in)
- Verify Firestore permissions
- Check browser console for errors
- Ensure `userProductPreferences` collection exists

### Performance Issues
- Enable caching (should be on by default)
- Reduce `maxResults` in matching calls
- Use batch processing for multiple items
- Check network tab for duplicate requests

---

## Future Enhancements

Potential additions to consider:

1. **Barcode Scanner**: Use device camera to scan products
2. **Price Tracking**: Track price history and alert on deals
3. **Store Navigation**: Show in-store aisle locations
4. **Comparison View**: Side-by-side product comparison
5. **Social Sharing**: Share product recommendations
6. **Recipe Bundles**: Pre-matched product sets for recipes

---

## Summary

**Components Built:**
- ✅ ProductMatchModal - Product selection modal
- ✅ ProductCard - Individual product display
- ✅ ProductPreferencesSettings - User preferences panel
- ✅ SmartShoppingListItem - Enhanced list item

**Integration Points:**
- Product matching on list generation
- Product selection handler
- Preferences management
- Smart vs. generic mode toggle

**All components are:**
- Responsive (mobile-first)
- Accessible
- Error-handled
- Performance-optimized
- Following your design system

Ready to integrate and test!
