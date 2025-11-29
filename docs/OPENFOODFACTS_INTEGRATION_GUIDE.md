# OpenFoodFacts Integration Guide

## Overview

The OpenFoodFacts service layer provides intelligent product matching for the MealPlanner shopping list feature. It consists of 4 main services and 1 utility module working together.

---

## Architecture

```
User Interface
      ↓
Shopping List Service (existing)
      ↓
Product Matching Service (NEW) ← coordinates everything
      ↓
      ├─→ OpenFoodFacts Service (API wrapper)
      ├─→ Product Cache Service (performance)
      ├─→ User Preferences Service (personalization)
      └─→ Product Utils (quantity conversion)
```

---

## Services

### 1. OpenFoodFacts Service (`openFoodFactsService.js`)

**Purpose**: Clean API wrapper for OpenFoodFacts

**Key Functions**:
- `searchProducts(searchTerm, options)` - Search for products
- `getProductByBarcode(barcode)` - Get specific product
- `getAutocompleteSuggestions(term, limit)` - Autocomplete
- `searchWithFilters(filters)` - Advanced filtered search
- `batchLookupBarcodes(barcodes)` - Batch lookup

**Example Usage**:
```javascript
import { searchProducts } from '../services/openFoodFactsService';

// Search for flour
const products = await searchProducts('all-purpose flour', {
  pageSize: 20,
  countries: 'United States'
});

console.log(products);
// [
//   {
//     barcode: '041130004834',
//     productName: 'King Arthur All-Purpose Flour',
//     brands: ['King Arthur'],
//     quantity: '5 lb',
//     imageUrl: 'https://...',
//     nutriments: { ... },
//     isOrganic: false,
//     ...
//   }
// ]
```

**Features**:
- Automatic retry with exponential backoff
- Request timeout handling
- Product data normalization
- Dietary flag extraction (vegan, organic, etc.)

---

### 2. Product Cache Service (`productCacheService.js`)

**Purpose**: Reduce API calls and improve performance

**Key Functions**:
- `cacheSearchResults(searchTerm, products)` - Cache search
- `getCachedSearchResults(searchTerm)` - Retrieve cache
- `cacheProductByBarcode(barcode, product)` - Cache product
- `getCachedProductByBarcode(barcode)` - Get cached product
- `cacheUserProduct(userId, barcode, userData)` - User-specific cache

**Example Usage**:
```javascript
import { getCachedSearchResults, cacheSearchResults } from '../services/productCacheService';

// Try cache first
let products = await getCachedSearchResults('milk');

if (!products) {
  // Cache miss - fetch from API
  products = await searchProducts('milk');

  // Store in cache
  await cacheSearchResults('milk', products);
}
```

**Features**:
- Two-tier caching (memory + Firestore)
- LRU eviction for memory cache
- Configurable TTL per cache type
- Cache statistics and cleanup
- Hit count tracking

**Cache TTL**:
- Search results: 7 days
- Product details: 30 days
- Autocomplete: 1 day
- User products: 90 days

---

### 3. Product Matching Service (`productMatchingService.js`)

**Purpose**: Intelligently match recipe ingredients to real products

**Key Functions**:
- `matchIngredientToProducts(ingredient, options)` - Main matching function
- `batchMatchIngredients(ingredients, options)` - Batch processing
- `findSubstituteProducts(ingredient, currentProduct)` - Find alternatives

**Example Usage**:
```javascript
import { matchIngredientToProducts } from '../services/productMatchingService';

// Match a recipe ingredient
const ingredient = {
  name: 'all-purpose flour',
  quantity: 2,
  unit: 'cups',
  category: 'Baking & Pantry'
};

const userPreferences = {
  preferredBrands: ['King Arthur', "Bob's Red Mill"],
  dietaryRestrictions: { organic: true },
  purchaseHistory: ['041130004834'] // Previously bought barcodes
};

const matches = await matchIngredientToProducts(ingredient, {
  userPreferences,
  maxResults: 10,
  minScore: 0.3
});

console.log(matches);
// [
//   {
//     product: { ... },
//     score: 0.92,
//     reason: 'You buy this',
//     confidence: 'high'
//   },
//   {
//     product: { ... },
//     score: 0.78,
//     reason: 'Your preferred brand',
//     confidence: 'high'
//   }
// ]
```

**Scoring Algorithm**:

The matching score (0-1) is calculated from:

| Factor | Weight | Description |
|--------|--------|-------------|
| Name similarity | 35% | How well ingredient name matches product |
| Category match | 15% | Product category matches ingredient |
| Brand preference | 20% | User's preferred brands |
| Purchase history | 15% | User bought this before |
| Dietary match | 10% | Matches dietary restrictions |
| Nutrition grade | 5% | Product nutrition quality |

**Match Reasons**:
- "Perfect match" - Score ≥ 0.9
- "Great match" - Score ≥ 0.75
- "You buy this" - In purchase history
- "Your preferred brand" - Matches brand preference
- "Organic option" - Organic product for organic preference
- "Good match" - Score ≥ 0.6

---

### 4. User Product Preferences Service (`userProductPreferencesService.js`)

**Purpose**: Manage user preferences and purchase history

**Key Functions**:
- `getUserPreferences(userId)` - Get all preferences
- `updateUserPreferences(updates)` - Update preferences
- `recordPurchase(purchase)` - Track purchase
- `getFrequentlyPurchased(limit)` - Get frequent products
- `addFavoriteProduct(barcode, name)` - Add to favorites
- `rateProduct(barcode, rating)` - Rate product (1-5)
- `getShoppingInsights()` - Analyze shopping habits

**Example Usage**:
```javascript
import {
  getUserPreferences,
  updateDietaryRestrictions,
  recordPurchase,
  addPreferredBrand
} from '../services/userProductPreferencesService';

// Get user preferences
const prefs = await getUserPreferences();

// Update dietary restrictions
await updateDietaryRestrictions({
  organic: true,
  vegan: false,
  glutenFree: true
});

// Record a purchase
await recordPurchase({
  barcode: '041130004834',
  productName: 'King Arthur All-Purpose Flour',
  price: 5.99,
  store: "Trader Joe's",
  brand: 'King Arthur',
  quantity: 1
});

// Add preferred brand (auto-learns from 3+ purchases)
await addPreferredBrand('King Arthur');

// Get frequently purchased products
const frequent = await getFrequentlyPurchased(20);
```

**User Preferences Structure**:
```javascript
{
  preferredBrands: ['King Arthur', 'Organic Valley'],
  avoidBrands: [],
  preferredStores: [
    { name: "Trader Joe's", priority: 1, location: {...} },
    { name: "Whole Foods", priority: 2, location: {...} }
  ],
  primaryStore: "Trader Joe's",

  dietaryRestrictions: {
    organic: true,
    vegan: false,
    glutenFree: true,
    kosher: false,
    halal: false
  },

  shoppingHabits: {
    buyInBulk: false,
    priceConscious: true,
    qualityConscious: true,
    brandLoyal: true
  },

  purchaseHistory: [
    {
      barcode: '041130004834',
      productName: 'King Arthur Flour',
      price: 5.99,
      store: "Trader Joe's",
      purchasedAt: '2025-11-28T...',
      timestamp: 1732838400000
    }
  ],

  favoriteProducts: ['041130004834', ...],

  productRatings: {
    '041130004834': 5
  }
}
```

---

### 5. Product Utils (`productUtils.js`)

**Purpose**: Helper functions for product data operations

**Key Functions**:
- `parseProductQuantity(quantityStr)` - Parse "5 lb" → {amount: 5, unit: 'lb'}
- `convertToStandardUnits(amount, unit)` - Convert to grams/ml
- `calculateProductCoverage(recipeNeeds, product)` - How many uses?
- `formatPrice(price)` - Format as currency
- `calculateUnitPrice(price, quantity)` - Price per 100g/100ml
- `compareProductValue(products)` - Sort by best value

**Example Usage**:
```javascript
import {
  parseProductQuantity,
  calculateProductCoverage,
  calculateUnitPrice,
  formatPrice
} from '../utils/productUtils';

// Parse product quantity
const parsed = parseProductQuantity('5 lb');
// { amount: 5, unit: 'lb' }

// Calculate coverage
const coverage = calculateProductCoverage(
  { quantity: 2, unit: 'cups', ingredient: 'flour' },
  { quantity: '5 lb' }
);
console.log(coverage);
// {
//   comparable: true,
//   needsAmount: 240,
//   productSize: 2268,
//   standardUnit: 'g',
//   enoughFor: 9,
//   message: 'Enough for 9 uses of this recipe'
// }

// Calculate unit price
const unitPrice = calculateUnitPrice(5.99, '5 lb');
// { pricePerUnit: 0.26, unit: '100g', display: '$0.26/100g' }
```

---

## Complete Integration Example

Here's a complete example showing how to integrate these services into a shopping list:

```javascript
import { matchIngredientToProducts } from '../services/productMatchingService';
import { getUserPreferences } from '../services/userProductPreferencesService';
import { calculateProductCoverage } from '../utils/productUtils';

/**
 * Generate smart shopping list from meal plan
 */
async function generateSmartShoppingList(mealPlan) {
  // 1. Extract ingredients from meal plan
  const ingredients = extractIngredients(mealPlan);
  // [
  //   { name: 'all-purpose flour', quantity: 2, unit: 'cups' },
  //   { name: 'milk', quantity: 1, unit: 'gallon' },
  //   ...
  // ]

  // 2. Get user preferences
  const userPreferences = await getUserPreferences();

  // 3. Match each ingredient to products
  const shoppingList = [];

  for (const ingredient of ingredients) {
    // Match to products
    const matches = await matchIngredientToProducts(ingredient, {
      userPreferences,
      maxResults: 5,
      minScore: 0.4
    });

    if (matches.length === 0) {
      // No products found - add as generic item
      shoppingList.push({
        type: 'generic',
        name: ingredient.name,
        quantity: ingredient.quantity,
        unit: ingredient.unit
      });
      continue;
    }

    // Get top match (highest score)
    const topMatch = matches[0];

    // Calculate coverage
    const coverage = calculateProductCoverage(
      ingredient,
      topMatch.product
    );

    // Add to shopping list
    shoppingList.push({
      type: 'product',
      ingredient: ingredient.name,
      selectedProduct: topMatch.product,
      alternativeProducts: matches.slice(1),
      matchScore: topMatch.score,
      matchReason: topMatch.reason,
      coverage: coverage,
      quantity: ingredient.quantity,
      unit: ingredient.unit
    });
  }

  return shoppingList;
}

/**
 * Display shopping list to user
 */
function displayShoppingList(shoppingList) {
  shoppingList.forEach(item => {
    if (item.type === 'generic') {
      console.log(`□ ${item.name} (${item.quantity} ${item.unit})`);
    } else {
      const product = item.selectedProduct;
      console.log(`
□ ${product.productName}
  ${product.quantity} • ${product.brand}
  ${item.matchReason}
  ${item.coverage.message}
      `);
    }
  });
}

// Usage
const mealPlan = { /* ... */ };
const shoppingList = await generateSmartShoppingList(mealPlan);
displayShoppingList(shoppingList);
```

**Output**:
```
□ King Arthur All-Purpose Flour
  5 lb • King Arthur
  You buy this
  Enough for 9 uses of this recipe

□ Organic Valley Whole Milk
  1 gal • Organic Valley
  Your preferred brand
  Matches your recipe needs

□ eggs (12 count)
```

---

## Integration with Existing Shopping List Service

Update `ShoppingListService.js` to use product matching:

```javascript
import { matchIngredientToProducts } from './productMatchingService';
import { getUserPreferences } from './userProductPreferencesService';

/**
 * Enhanced version of createListFromMealPlan
 */
export const createSmartListFromMealPlan = async (mealPlan, options = {}) => {
  const {
    enableProductMatching = true,
    userPreferences = null
  } = options;

  // Extract ingredients (existing logic)
  const ingredients = extractIngredientsFromMealPlan(mealPlan);

  // Get user preferences
  const prefs = userPreferences || await getUserPreferences();

  // Match products if enabled
  const items = [];

  for (const ingredient of ingredients) {
    const item = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: ingredient.name,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      category: ingredient.category,
      completed: false
    };

    if (enableProductMatching) {
      // Try to match product
      const matches = await matchIngredientToProducts(ingredient, {
        userPreferences: prefs,
        maxResults: 5,
        minScore: 0.3
      });

      if (matches.length > 0) {
        item.productMatch = {
          mode: 'smart',
          selectedProduct: matches[0].product,
          suggestedProducts: matches.slice(1).map(m => m.product),
          matchScore: matches[0].score,
          matchReason: matches[0].reason,
          lastUpdated: Date.now()
        };
      }
    }

    items.push(item);
  }

  // Create shopping list
  const listData = {
    name: 'Smart Shopping List',
    items,
    type: 'mealPlan',
    source: 'Generated with product matching'
  };

  const listId = await createShoppingList(listData);
  return listId;
};
```

---

## Error Handling

All services include comprehensive error handling:

```javascript
try {
  const products = await searchProducts('milk');
} catch (error) {
  if (error.name === 'AbortError') {
    // Timeout - API didn't respond in time
    console.log('Request timed out, try again');
  } else {
    // Other error
    console.error('Failed to search products:', error.message);
  }
}
```

**Common Errors**:
- `AbortError` - Request timeout
- `Error: User must be authenticated` - No current user
- `Error: OpenFoodFacts API error: 503` - API down/unavailable
- `Error: Search term is required` - Missing required parameter

---

## Performance Optimization

**Best Practices**:

1. **Always use cache**:
   ```javascript
   // Good - checks cache first
   const matches = await matchIngredientToProducts(ingredient, {
     useCache: true // default
   });

   // Avoid - bypasses cache
   const matches = await matchIngredientToProducts(ingredient, {
     useCache: false // slower
   });
   ```

2. **Batch operations**:
   ```javascript
   // Good - batch processing
   const results = await batchMatchIngredients(ingredients);

   // Avoid - sequential processing
   for (const ingredient of ingredients) {
     await matchIngredientToProducts(ingredient);
   }
   ```

3. **Limit results**:
   ```javascript
   // Good - only get what you need
   const matches = await matchIngredientToProducts(ingredient, {
     maxResults: 5
   });

   // Avoid - fetching too much
   const matches = await matchIngredientToProducts(ingredient, {
     maxResults: 50
   });
   ```

4. **Preload user preferences**:
   ```javascript
   // Good - load once
   const prefs = await getUserPreferences();
   for (const ingredient of ingredients) {
     await matchIngredientToProducts(ingredient, { userPreferences: prefs });
   }

   // Avoid - loads each time
   for (const ingredient of ingredients) {
     await matchIngredientToProducts(ingredient); // loads prefs internally
   }
   ```

---

## Testing

### Unit Tests

```javascript
import { parseProductQuantity, convertToStandardUnits } from '../utils/productUtils';

describe('Product Utils', () => {
  test('parseProductQuantity', () => {
    expect(parseProductQuantity('5 lb')).toEqual({
      amount: 5,
      unit: 'lb'
    });

    expect(parseProductQuantity('1 gallon')).toEqual({
      amount: 1,
      unit: 'gallon'
    });
  });

  test('convertToStandardUnits', () => {
    const result = convertToStandardUnits(5, 'lb');
    expect(result.grams).toBeCloseTo(2267.96, 1);
  });
});
```

### Integration Tests

```javascript
import { matchIngredientToProducts } from '../services/productMatchingService';

describe('Product Matching', () => {
  test('matches flour to products', async () => {
    const ingredient = {
      name: 'all-purpose flour',
      quantity: 2,
      unit: 'cups'
    };

    const matches = await matchIngredientToProducts(ingredient);

    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toHaveProperty('product');
    expect(matches[0]).toHaveProperty('score');
    expect(matches[0].score).toBeGreaterThanOrEqual(0);
    expect(matches[0].score).toBeLessThanOrEqual(1);
  });
});
```

---

## Future Enhancements

1. **Store Integration**
   - Real-time pricing from store APIs
   - Inventory availability
   - Store navigation/aisle locations

2. **Machine Learning**
   - Improve matching algorithm with user feedback
   - Personalized ranking models
   - Collaborative filtering

3. **Social Features**
   - Share product recommendations
   - Community ratings
   - Recipe-product bundles

4. **Advanced Features**
   - Barcode scanning
   - Receipt scanning
   - Budget tracking
   - Meal prep optimization

---

## Summary

The OpenFoodFacts integration provides:

✅ **Comprehensive API wrapper** - Clean interface to OpenFoodFacts
✅ **Intelligent caching** - Two-tier cache for performance
✅ **Smart matching** - Algorithm-based product suggestions
✅ **User personalization** - Learns from preferences and history
✅ **Utility functions** - Quantity conversion and calculations

**All services are**:
- Well-documented with JSDoc comments
- Error-handled with try/catch
- Consistent with existing codebase patterns
- Non-breaking to existing functionality
- Ready for UI integration

**Next Steps**:
1. Create UI components for product selection
2. Integrate with existing shopping list page
3. Add user preference settings page
4. Implement barcode scanning (optional)
5. Add analytics tracking
