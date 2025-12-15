# Diet Type System - Complete Architecture Plan

## Executive Summary

Comprehensive redesign of diet type management across the entire MealPlanner application, addressing all current issues and implementing 6 major feature sets.

---

## Current State Analysis

### Critical Issues Found:
1. ❌ **No DELETE/UPDATE operations** - Users stuck with typos
2. ❌ **Orphaned Firestore rules** - `/dietTypes` collection unused
3. ❌ **Hardcoded defaults** - Cannot customize without code changes
4. ❌ **Single diet type per recipe** - Cannot mark recipe as both "Vegan" AND "Gluten-Free"
5. ❌ **No user preferences** - Cannot set default diet types
6. ❌ **Low search priority** - Diet type scores only 10 points vs 100 for title
7. ❌ **No recommendations** - Cannot suggest diet types based on ingredients
8. ❌ **Inconsistent state** - 28 files reference diet types differently

### Files Affected: **28 files** across services, components, and utilities

---

## Proposed Architecture

### 1. NEW DATA MODEL

#### **A. Firestore Collections**

```
globalDietTypes/ (NEW)
├── {dietTypeId}
│   ├── name: "Vegetarian"
│   ├── description: "No meat or fish"
│   ├── icon: "🌱"
│   ├── color: "#4CAF50"
│   ├── isDefault: true
│   ├── isActive: true
│   ├── keywords: ["veggie", "plant-based", "meatless"]
│   ├── incompatibleIngredients: ["chicken", "beef", "pork", "fish"]
│   ├── createdAt: <timestamp>
│   └── createdBy: "system" | <userId>

users/{userId}/ (UPDATED)
├── dietTypePreferences: {
│   ├── favorites: ["Keto", "Low-Carb"]
│   ├── hidden: ["Halal", "Kosher"]
│   ├── defaultForNewRecipes: "Keto"
│   └── customDietTypes: [...]  // Keep for backwards compat
│   }
├── customDietTypes: [...] // Deprecated, migrate to globalDietTypes
└── ...

recipes/{recipeId}/ (UPDATED)
├── dietTypes: ["Vegan", "Gluten-Free"]  // ARRAY instead of single string
├── dietType: "Vegan"  // Keep for backwards compat, auto-sync from dietTypes[0]
├── suggestedDietTypes: ["Dairy-Free"]  // AI/ingredient-based suggestions
└── ...
```

#### **B. New Firestore Rules**

```javascript
match /globalDietTypes/{dietTypeId} {
  // Anyone authenticated can read
  allow read: if request.auth != null;

  // Only creator can update/delete their custom diet types
  allow create: if request.auth != null
    && request.resource.data.createdBy == request.auth.uid;

  allow update, delete: if request.auth != null
    && (
      // Admin users (future)
      request.auth.token.admin == true ||
      // Creator of custom diet type
      resource.data.createdBy == request.auth.uid
    );

  // System diet types cannot be deleted
  allow delete: if resource.data.createdBy != 'system';
}

match /users/{userId}/dietTypePreferences {
  allow read, write: if request.auth != null && request.auth.uid == userId;
}
```

---

### 2. ENHANCED DIET TYPE SERVICE

**Location:** `/src/services/dietTypeService.js` (Enhanced)

**New Operations:**

```javascript
class DietTypeService {
  // ========== CRUD ==========

  async getDietTypes(userId, options = {}) {
    // Options: { includeHidden, includeInactive, sortBy }
    // Returns merged: global defaults + user customs
    // Respects user preferences (hide/favorite)
  }

  async createDietType(dietTypeData, userId) {
    // Validation: name, description, keywords
    // Creates in globalDietTypes collection
    // Auto-sets createdBy = userId
    // Returns dietTypeId
  }

  async updateDietType(dietTypeId, updates, userId) {
    // Permission check: must be creator or admin
    // Updates globalDietTypes document
    // Clears cache
  }

  async deleteDietType(dietTypeId, userId) {
    // Permission check: must be creator or admin
    // Cannot delete system diet types
    // Archives instead of hard delete (sets isActive = false)
    // Returns affected recipe count
  }

  async bulkUpdateRecipeDietTypes(oldName, newName, userId) {
    // Updates all user's recipes with oldName → newName
    // Used when renaming diet types
  }

  // ========== MULTI-DIET SUPPORT ==========

  async addDietTypeToRecipe(recipeId, dietTypeName, userId) {
    // Adds to dietTypes array
    // Auto-updates legacy dietType field (first in array)
  }

  async removeDietTypeFromRecipe(recipeId, dietTypeName, userId) {
    // Removes from dietTypes array
    // Updates legacy dietType field
  }

  // ========== RECOMMENDATIONS ==========

  async suggestDietTypes(ingredients, currentDietTypes = []) {
    // Analyzes ingredients against incompatibleIngredients
    // Returns suggested diet types with confidence scores
    // Example: ["Vegan" (95%), "Dairy-Free" (80%)]
  }

  async autoDetectDietType(recipe) {
    // Scans title, ingredients, instructions
    // Returns best-match diet type with keywords
  }

  // ========== USER PREFERENCES ==========

  async getUserPreferences(userId) {
    // Returns favorites, hidden, defaults
  }

  async updateUserPreferences(userId, preferences) {
    // Updates favorites, hidden, defaultForNewRecipes
  }

  async addFavorite(userId, dietTypeName) {}
  async removeFavorite(userId, dietTypeName) {}
  async hideDietType(userId, dietTypeName) {}
  async showDietType(userId, dietTypeName) {}

  // ========== VALIDATION ==========

  validateDietType(dietTypeData) {
    // Name: 1-50 chars, alphanumeric + spaces
    // Keywords: max 10, each 1-30 chars
    // Color: valid hex code
    // Returns {valid, errors}
  }

  // ========== MIGRATION ==========

  async migrateUserDietTypes(userId) {
    // Moves customDietTypes array → globalDietTypes collection
    // One-time migration for existing users
  }

  async migrateSingleToMultiDiet(userId) {
    // Converts recipe.dietType → recipe.dietTypes[]
    // Runs on user's recipes
  }
}
```

---

### 3. CENTRALIZED STATE MANAGEMENT

#### **A. Diet Type Context** (NEW)

**Location:** `/src/contexts/DietTypeContext.js`

```javascript
const DietTypeContext = createContext();

export const DietTypeProvider = ({ children }) => {
  const { user } = useAuth();

  // State
  const [allDietTypes, setAllDietTypes] = useState([]);
  const [userPreferences, setUserPreferences] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load diet types on mount
  useEffect(() => {
    if (user) {
      loadDietTypes();
      loadPreferences();
    }
  }, [user]);

  const loadDietTypes = async () => {
    const types = await dietTypeService.getDietTypes(user.uid);
    setAllDietTypes(types);
  };

  const loadPreferences = async () => {
    const prefs = await dietTypeService.getUserPreferences(user.uid);
    setUserPreferences(prefs);
  };

  // Filtered lists
  const favoriteDietTypes = useMemo(() =>
    allDietTypes.filter(dt =>
      userPreferences?.favorites?.includes(dt.name)
    ), [allDietTypes, userPreferences]
  );

  const visibleDietTypes = useMemo(() =>
    allDietTypes.filter(dt =>
      !userPreferences?.hidden?.includes(dt.name)
    ), [allDietTypes, userPreferences]
  );

  // CRUD operations
  const createDietType = async (dietTypeData) => {
    const id = await dietTypeService.createDietType(dietTypeData, user.uid);
    await loadDietTypes(); // Refresh
    return id;
  };

  const updateDietType = async (id, updates) => {
    await dietTypeService.updateDietType(id, updates, user.uid);
    await loadDietTypes();
  };

  const deleteDietType = async (id) => {
    const affected = await dietTypeService.deleteDietType(id, user.uid);
    await loadDietTypes();
    return affected;
  };

  // Preferences
  const toggleFavorite = async (dietTypeName) => {
    const isFavorite = userPreferences?.favorites?.includes(dietTypeName);
    if (isFavorite) {
      await dietTypeService.removeFavorite(user.uid, dietTypeName);
    } else {
      await dietTypeService.addFavorite(user.uid, dietTypeName);
    }
    await loadPreferences();
  };

  const value = {
    allDietTypes,
    visibleDietTypes,
    favoriteDietTypes,
    userPreferences,
    loading,
    createDietType,
    updateDietType,
    deleteDietType,
    toggleFavorite,
    refreshDietTypes: loadDietTypes
  };

  return (
    <DietTypeContext.Provider value={value}>
      {children}
    </DietTypeContext.Provider>
  );
};

export const useDietTypes = () => useContext(DietTypeContext);
```

#### **B. Hook: useDietTypeRecommendations**

```javascript
export const useDietTypeRecommendations = (ingredients, currentDietTypes) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const getSuggestions = async () => {
      setLoading(true);
      const results = await dietTypeService.suggestDietTypes(
        ingredients,
        currentDietTypes
      );
      setSuggestions(results);
      setLoading(false);
    };

    if (ingredients?.length > 0) {
      getSuggestions();
    }
  }, [ingredients, currentDietTypes]);

  return { suggestions, loading };
};
```

---

### 4. NEW UI COMPONENTS

#### **A. Diet Type Manager** (NEW)

**Location:** `/src/features/dietTypes/DietTypeManager.js`

**Features:**
- List all diet types (default + custom)
- Create new diet type with form
- Edit diet type inline
- Delete diet type (with confirmation + affected recipes count)
- Mark as favorite ⭐
- Hide/show diet types 👁️
- Bulk operations (merge, rename)

#### **B. Diet Type Selector** (ENHANCED)

**Location:** `/src/features/recipeBook/recipeForm/components/DietTypeSelector.js`

**Features:**
- Multi-select chips (select multiple diet types)
- Show favorites at top ⭐
- Quick-add custom diet type
- Show AI suggestions based on ingredients 🤖
- Color-coded tags
- Search/filter

#### **C. Diet Type Filter Panel** (ENHANCED)

**Location:** `/src/features/recipeBook/components/DietTypeFilterPanel.js`

**Features:**
- Multi-select with "AND" / "OR" logic
- Show recipe counts per diet type
- Favorites section
- Recently used section
- Clear all button

---

### 5. MIGRATION STRATEGY

#### **Phase 1: Backwards Compatible**

1. Keep existing `recipe.dietType` field (single string)
2. Add new `recipe.dietTypes` array field
3. Auto-sync: `dietTypes[0]` ↔ `dietType`
4. All reads check both fields (fallback)

#### **Phase 2: Data Migration**

1. Run migration script on user login
2. Convert `users/{userId}.customDietTypes[]` → `globalDietTypes` collection
3. Convert `recipe.dietType` → `recipe.dietTypes[]`
4. Mark user as migrated (`users/{userId}.dietTypesMigrated = true`)

#### **Phase 3: Deprecation**

1. After 90 days, remove legacy field reads
2. Archive old `customDietTypes` arrays
3. Clean up migration code

---

### 6. FEATURE IMPLEMENTATIONS

#### **Feature 1: Better Diet Type Management**

**Components:**
- DietTypeManager.js - Full CRUD UI
- DietTypeForm.js - Create/edit form with validation
- DietTypeCard.js - Display + quick actions

**Actions:**
- ✅ Create custom diet type with icon + color
- ✅ Edit diet type name, description, keywords
- ✅ Delete diet type (soft delete)
- ✅ Bulk rename across all recipes
- ✅ See affected recipe count before delete

#### **Feature 2: Diet Type Filtering Improvements**

**Enhancements:**
- Multi-select with chips (not checkboxes)
- "Match ALL" vs "Match ANY" toggle
- Recipe count badges
- Quick filters: "Favorites Only", "Recently Used"
- Persistent filter state (localStorage)

#### **Feature 3: Diet Type Consistency**

**Standardization:**
- Single source of truth: `DietTypeContext`
- Shared components across all features
- Centralized normalization function
- Consistent data model (array of diet types)
- Automated tests for consistency

**Affected Areas:**
- Recipe Book ✓
- Meal Planner ✓
- Recipe Details ✓
- CSV Import ✓
- URL Import ✓
- OCR Import ✓
- Text Import ✓

#### **Feature 4: Diet Type Recommendations**

**AI/Rule-Based System:**

```javascript
// Recommendation Rules
const DIET_TYPE_RULES = {
  'Vegan': {
    requires: [], // No animal products
    excludes: ['chicken', 'beef', 'pork', 'fish', 'dairy', 'eggs', 'honey'],
    keywords: ['tofu', 'tempeh', 'plant-based', 'vegan']
  },
  'Vegetarian': {
    requires: [],
    excludes: ['chicken', 'beef', 'pork', 'fish', 'meat'],
    keywords: ['veggie', 'vegetarian', 'meatless']
  },
  'Gluten-Free': {
    requires: [],
    excludes: ['wheat', 'flour', 'bread', 'pasta', 'barley', 'rye'],
    keywords: ['gluten-free', 'gf']
  }
};

// Confidence scoring
async function suggestDietTypes(ingredients) {
  const suggestions = [];

  for (const [dietType, rules] of Object.entries(DIET_TYPE_RULES)) {
    let confidence = 100;

    // Check excludes
    for (const excluded of rules.excludes) {
      if (ingredients.some(ing => ing.includes(excluded))) {
        confidence = 0;
        break;
      }
    }

    // Check keywords (boosts confidence)
    for (const keyword of rules.keywords) {
      if (ingredients.some(ing => ing.includes(keyword))) {
        confidence = Math.min(100, confidence + 20);
      }
    }

    if (confidence > 50) {
      suggestions.push({ dietType, confidence });
    }
  }

  return suggestions.sort((a, b) => b.confidence - a.confidence);
}
```

**UI:**
- Show suggestions in RecipeForm
- "Apply Suggestion" button
- Confidence badge (95% 🟢, 60% 🟡, etc.)

#### **Feature 5: Multi-Diet Support**

**Changes:**
- `recipe.dietType` (string) → `recipe.dietTypes` (array)
- UI: Chip selector (multiple selection)
- Filtering: Match ANY diet type in array
- Search: Score based on ALL matched diet types
- Display: Show all diet type tags

**Example:**
```javascript
// Before
{
  dietType: "Vegan"
}

// After
{
  dietType: "Vegan",  // Legacy field (auto-synced from dietTypes[0])
  dietTypes: ["Vegan", "Gluten-Free", "Nut-Free"]
}
```

#### **Feature 6: Diet Type Profiles**

**User Preferences:**
```javascript
{
  favorites: ["Keto", "Low-Carb"],          // Show at top
  hidden: ["Halal", "Kosher"],              // Don't show in lists
  defaultForNewRecipes: "Keto",             // Auto-select when creating recipe
  recentlyUsed: ["Paleo", "Keto"],          // Track usage
  filterDefaults: ["Keto", "Low-Carb"]      // Default Recipe Book filters
}
```

**Settings UI:**
- User Profile page → Diet Type Preferences
- Drag-to-reorder favorites
- Toggle visibility per diet type
- Set default for new recipes
- Clear recently used

---

### 7. PERMISSION SYSTEM

#### **Permission Levels:**

1. **System Diet Types** (`createdBy: 'system'`)
   - ✅ Read: Everyone
   - ❌ Update: Admins only (future)
   - ❌ Delete: No one

2. **User Custom Diet Types** (`createdBy: userId`)
   - ✅ Read: Everyone
   - ✅ Update: Creator only
   - ✅ Delete: Creator only (soft delete)

3. **User Preferences** (`users/{userId}/dietTypePreferences`)
   - ✅ Read: Owner only
   - ✅ Write: Owner only

#### **Code-Level Checks:**

```javascript
async function updateDietType(dietTypeId, updates, userId) {
  const dietType = await getDietType(dietTypeId);

  // Check permissions
  if (dietType.createdBy === 'system') {
    throw new Error('Cannot modify system diet types');
  }

  if (dietType.createdBy !== userId) {
    throw new Error('You can only modify your own custom diet types');
  }

  // Proceed with update
  await firestore.collection('globalDietTypes').doc(dietTypeId).update(updates);
}
```

---

### 8. SEARCH IMPROVEMENTS

#### **Increase Diet Type Weight:**

```javascript
// Current (search.js)
DIET_TYPE_MATCH: 10  // Very low priority

// Proposed
DIET_TYPE_MATCH: 35  // Medium-high priority
```

**Multi-Diet Scoring:**
```javascript
// If recipe has multiple diet types, score each match
const dietTypeScore = recipe.dietTypes
  .filter(dt => dt.toLowerCase().includes(searchTerm.toLowerCase()))
  .length * DIET_TYPE_MATCH;
```

---

### 9. TESTING STRATEGY

#### **Unit Tests:**
- DietTypeService CRUD operations
- Permission checks
- Validation logic
- Recommendation engine
- Migration scripts

#### **Integration Tests:**
- Create → Read → Update → Delete flow
- Multi-diet assignment
- Filter with multiple diet types
- Preference saving/loading

#### **E2E Tests:**
- Create recipe with multiple diet types
- Filter recipes by diet type
- Manage custom diet types
- Apply AI suggestions

---

### 10. DEPLOYMENT PLAN

#### **Phase 1: Foundation** (Week 1)
- [ ] Enhanced DietTypeService with CRUD
- [ ] New Firestore schema + rules
- [ ] DietTypeContext provider
- [ ] Migration scripts
- [ ] Unit tests

#### **Phase 2: UI Components** (Week 2)
- [ ] DietTypeManager component
- [ ] Enhanced DietTypeSelector
- [ ] Enhanced FilterPanel
- [ ] Settings page for preferences
- [ ] Integration tests

#### **Phase 3: Integration** (Week 3)
- [ ] Update RecipeForm
- [ ] Update RecipeDetails
- [ ] Update all 28 affected files
- [ ] Search scoring updates
- [ ] E2E tests

#### **Phase 4: Advanced Features** (Week 4)
- [ ] Diet type recommendations
- [ ] Multi-diet support
- [ ] User preferences
- [ ] Bulk operations
- [ ] Final testing

#### **Phase 5: Migration & Rollout**
- [ ] Deploy to dev
- [ ] Run migration on test accounts
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Gradual migration of existing users

---

### 11. BACKWARD COMPATIBILITY

**Guaranteed:**
- Existing recipes continue to work
- Old `dietType` field still readable
- Old filters still functional
- Gradual migration (no breaking changes)

**Timeline:**
- Month 1-3: Dual field support
- Month 4-6: Migrate existing data
- Month 7+: Deprecate old fields

---

### 12. SUCCESS METRICS

**Quantitative:**
- 100% of diet type operations have permission checks ✓
- 28 files updated for consistency ✓
- 0 hardcoded diet types (all in Firestore) ✓
- < 5ms diet type load time ✓
- 95%+ recommendation accuracy ✓

**Qualitative:**
- Users can manage custom diet types easily
- No confusion about which diet types to use
- Multi-diet recipes work seamlessly
- Filters are intuitive and fast

---

## Next Steps

1. Review this architecture plan
2. Approve/modify scope
3. Begin Phase 1 implementation
4. Iterate based on feedback

**Estimated Total Development Time:** 4 weeks
**Priority Level:** High (affects 28 files + core functionality)
