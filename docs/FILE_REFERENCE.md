# MealPlanner File-by-File Reference Guide

**Version:** 1.0
**Last Updated:** November 26, 2025

This document provides a comprehensive reference for every significant file in the MealPlanner codebase, organized by directory.

---

## Table of Contents

1. [Root Configuration Files](#root-configuration-files)
2. [Frontend Source (src/)](#frontend-source-src)
3. [Services Layer (src/services/)](#services-layer-srcservices)
4. [Components (src/components/)](#components-srccomponents)
5. [Features (src/features/)](#features-srcfeatures)
6. [Cloud Functions (functions/)](#cloud-functions-functions)
7. [Scripts (scripts/)](#scripts-scripts)
8. [Utilities (src/utils/)](#utilities-srcutils)

---

## Root Configuration Files

### firebase.json
**Purpose:** Firebase deployment configuration
**Size:** 36 lines

**Configuration Sections:**
- **functions:** Source directory, predeploy hooks, ignore patterns
- **firestore:** Rules and indexes file locations
- **hosting:** Public directory, SPA rewrites

### firestore.rules
**Purpose:** Database security rules
**Size:** 68 lines

**Rules Defined:**
- Users can only access own data
- Recipe ownership validation
- Public recipe read access
- Meal plans and shopping lists user-scoped
- Default deny for all other collections

### firestore.indexes.json
**Purpose:** Composite index definitions
**Size:** 23 lines

**Indexes:**
- `shoppingLists`: {userId ASC, isActive ASC, updatedAt DESC}

### package.json
**Purpose:** Frontend dependencies and scripts
**Key Dependencies:**
- react: ^18.3.1
- react-router-dom: ^6.26.2
- firebase: ^10.13.2
- react-quill: ^2.0.0
- lucide-react: ^0.454.0

**Scripts:**
- `start`: Development server
- `build`: Production build
- `test`: Jest test runner

### .env
**Purpose:** Environment variables
**Contains:**
- Firebase configuration keys
- API keys (⚠️ should be backend-only for OpenAI/Mistral)

---

## Frontend Source (src/)

### src/index.js
**Purpose:** React application entry point
**Size:** Minimal
**Function:** Renders App component to DOM

### src/App.js
**Purpose:** Root component with routing and authentication
**Size:** ~200 lines
**Responsibilities:**
- Firebase auth state listener
- Route definitions (public and protected)
- ProtectedRoute component
- User state management

**Routes:**
```javascript
Public: /, /login, /register, /forgot-password, /welcome, /shared/:linkId
Protected: /recipe-book, /meal-planner, /shopping-list, /profile, /account
```

### src/App.css
**Purpose:** Global styles
**Size:** ~500 lines
**Defines:**
- Color palette (Sage green, Charcoal, Warm Sand)
- Button styles
- Card styles
- Form field styles
- Grid system
- Layout components

### src/index.css
**Purpose:** Base CSS and resets
**Defines:**
- Font imports
- CSS reset
- Body styles
- Root variables

### src/firebase.js
**Purpose:** Firebase SDK initialization
**Size:** ~50 lines
**Exports:**
- `auth` - Firebase Authentication
- `db` - Firestore Database
- `storage` - Cloud Storage
- `analytics` - Analytics

---

## Services Layer (src/services/)

### authHelper.js
**Purpose:** Authentication utility functions
**Size:** 38 lines
**Exports:**
- `getCurrentUserId()` - Get current user UID
- `getCurrentUser()` - Get full user object
- `isUserAuthenticated()` - Check auth status
- `getCurrentUserEmail()` - Get user email

**Dependencies:** Firebase Auth

---

### userService.js
**Purpose:** User profile management
**Size:** 164 lines
**Collection:** `users`

**Functions:**
| Function | Purpose | Returns |
|----------|---------|---------|
| `createUserProfile(uid, userData, referralCode)` | Create new user with initialization | Promise<boolean> |
| `getUserProfile(uid)` | Fetch user document | Promise<Object \| null> |
| `updateUserProfile(uid, userData)` | Update user fields | Promise<boolean> |
| `updateLastLogin(uid)` | Update lastLogin timestamp | Promise<boolean> |
| `completeOnboarding(uid)` | Mark onboarding complete | Promise<boolean> |

**User Initialization:**
- Sets up subscription (free tier)
- Initializes credits (via creditService)
- Initializes metrics (via userMetricsService)
- Initializes referral system (via referralService)
- Seeds starter recipes (via starterRecipeService)

**Dependencies:** creditService, userMetricsService, referralService, starterRecipeService

---

### recipeService.js
**Purpose:** Recipe CRUD operations
**Size:** 422 lines
**Collections:** `recipes`, `variations`

**Core Functions:**
| Function | Purpose | Returns |
|----------|---------|---------|
| `addRecipe(recipeData)` | Create new recipe | Promise<string> (recipeId) |
| `getRecipes()` | Get all user recipes | Promise<Array> |
| `getRecipeById(recipeId)` | Get single recipe | Promise<Object> |
| `updateRecipe(recipeId, updatedData)` | Update recipe | Promise<void> |
| `deleteRecipe(recipeId)` | Delete recipe | Promise<void> |

**Variation Functions:**
| Function | Purpose |
|----------|---------|
| `addVariation(variationData)` | Create recipe variation |
| `getVariationsByRecipe(recipeId)` | Get all variations for recipe |
| `getVariationById(variationId)` | Get single variation |
| `updateVariation(variationId, updatedData)` | Update variation |
| `deleteVariation(variationId)` | Delete variation |

**Security:** All operations verify userId ownership
**Metrics:** Tracks recipe additions via userMetricsService

---

### mealPlanService.js
**Purpose:** Meal plan persistence
**Size:** 168 lines
**Collection:** `mealPlans`

**Functions:**
| Function | Purpose | Returns |
|----------|---------|---------|
| `saveMealPlanToFirestore(planName, mealPlan)` | Save new meal plan | Promise<string> (planId) |
| `updateMealPlanInFirestore(planId, planName, mealPlan)` | Update existing plan | Promise<void> |
| `loadMealPlansFromFirestore()` | Load all user plans | Promise<Array> |
| `deleteMealPlanFromFirestore(planId)` | Delete meal plan | Promise<boolean> |

**Data Structure:**
```javascript
{
  userId, name,
  plan: {
    monday: {breakfast: Recipe, lunch: Recipe, dinner: Recipe},
    tuesday: {...},
    // ... 7 days
  },
  savedAt, updatedAt
}
```

**Security:** User ownership validation on all operations

---

### ShoppingListService.js
**Purpose:** Shopping list management
**Size:** 440 lines
**Collection:** `shoppingLists`

**Core Functions:**
| Function | Purpose |
|----------|---------|
| `createShoppingList(listData)` | Create new list |
| `getUserShoppingLists()` | Get all user lists |
| `getShoppingList(listId)` | Get specific list |
| `updateShoppingList(listId, updates)` | Update list |
| `deleteShoppingList(listId)` | Soft delete list |

**Item Management:**
| Function | Purpose |
|----------|---------|
| `addItemToList(listId, item)` | Add item to list |
| `removeItemFromList(listId, itemId)` | Remove item |
| `updateItemInList(listId, itemId, updates)` | Update item |

**Special Function:**
```javascript
createListFromMealPlan(mealPlan, listName)
```
- Extracts ingredients from all meals
- Consolidates duplicates by name + unit
- Auto-categorizes by ingredient type
- Adjusts quantities for servings

**Helper Functions:**
- `cleanIngredientName(name)` - Normalize ingredient names
- `categorizeIngredient(name)` - Auto-categorize
- `normalizeUnit(unit)` - Singular form

**Index Used:** `{userId, isActive, updatedAt}`

---

### creditService.js
**Purpose:** Credit management and monetization
**Size:** 536 lines
**Collections:** `transactions`, `usageEvents`

**Core Functions:**
| Function | Purpose |
|----------|---------|
| `initializeUserCredits(userId)` | Initialize credit structure |
| `getCreditBalance(userId?)` | Get current balance |
| `hasAvailableCredits(userId?, requiredCredits)` | Check availability |
| `consumeCredits(feature, metadata, requiredCredits)` | Use credits (transactional) |
| `addPurchasedCredits(userId, credits, paymentData)` | Add paid credits |
| `resetMonthlyCredits(userId)` | Reset free credits |

**Analytics Functions:**
| Function | Purpose |
|----------|---------|
| `getTransactionHistory(userId?, limit)` | Get credit history |
| `getUsageStatistics(userId?)` | Get usage stats |
| `checkFreeLimit(userId?)` | Check if limit reached |

**Credit System:**
- Free tier: 5 credits/month
- Uses free credits before paid credits
- Transactional consumption (prevents race conditions)
- Monthly reset on 1st of month

**Transaction Schema:**
```javascript
{
  userId, type: 'credit_used' | 'purchase',
  creditsUsed, creditsAdded, feature,
  amount, currency, paymentMethod,
  status, createdAt, completedAt
}
```

---

### userMetricsService.js
**Purpose:** User activity and engagement tracking
**Size:** 423 lines

**Tracking Functions:**
| Function | Purpose |
|----------|---------|
| `initializeUserMetrics(userId)` | Initialize metrics object |
| `trackRecipeAdded(userId?)` | Increment recipe count |
| `trackRecipeViewed(userId?, recipeId?)` | Increment view count |
| `trackMealPlanCreated(userId?)` | Increment meal plan count |
| `trackMealPlanCompleted(userId?)` | Track completion |
| `trackShoppingListGenerated(userId?)` | Increment shopping list count |
| `trackFeatureUsage(userId?, featureName)` | Track navigation |
| `trackSessionStart(userId?)` | Count sessions |

**Data Functions:**
| Function | Purpose |
|----------|---------|
| `getUserMetrics(userId?)` | Get all metrics |
| `getMostUsedFeatures(userId?)` | Get feature ranking |
| `addFavoriteRecipe(userId?, recipeId)` | Add to favorites |
| `removeFavoriteRecipe(userId?, recipeId)` | Remove from favorites |

**Metrics Schema:**
```javascript
{
  totalRecipesAdded, totalRecipesViewed, favoriteRecipes[],
  totalMealPlansCreated, totalMealPlansCompleted, lastMealPlanDate,
  totalShoppingListsGenerated, lastShoppingListDate,
  featureUsage: {recipeBook, mealPlanner, shoppingList, profile},
  lastActiveDate, accountCreatedDate, totalSessions
}
```

**Error Handling:** Fails silently to not disrupt UX

---

### recipeSharingService.js
**Purpose:** Public recipe sharing and discovery
**Size:** 495 lines
**Collections:** `publicRecipes`, `sharedLinks`, `recipeInteractions`

**Sharing Functions:**
| Function | Purpose |
|----------|---------|
| `shareRecipe(recipeId, options)` | Make recipe public |
| `unshareRecipe(recipeId)` | Make recipe private |
| `createShareLink(linkData)` | Generate shareable link |
| `trackShareLinkView(linkId, context)` | Track link views |

**Discovery Functions:**
| Function | Purpose |
|----------|---------|
| `browsePublicRecipes(filters)` | Discover recipes |
| `getUserSharedRecipes(userId?)` | Get user's public recipes |

**Engagement Functions:**
| Function | Purpose |
|----------|---------|
| `savePublicRecipe(publicRecipeId)` | Copy to user's collection |
| `markRecipeAsMade(publicRecipeId)` | Track "made this" |

**Utility:**
- `copyLinkToClipboard(shareUrl)` - Copy helper
- `generateLinkId()` - Create 8-char random ID

**Share Link Format:** `/shared/{linkId}`

**Public Recipe Schema:**
```javascript
{
  recipeData: {...full recipe},
  authorId, authorName, authorImage,
  visibility: 'public' | 'unlisted' | 'private',
  engagement: {views, saves, madeThis, ratings},
  tags[], trending, featuredAt,
  moderationStatus: 'approved' | 'pending' | 'rejected'
}
```

---

### referralService.js
**Purpose:** Referral program and invite system
**Size:** 413 lines
**Collection:** `referrals`

**Core Functions:**
| Function | Purpose |
|----------|---------|
| `initializeReferralSystem(userId, userName, referredBy?)` | Setup referrals |
| `getReferralData(userId?)` | Get referral info |
| `getReferralLink(userId?)` | Get shareable link |
| `validateReferralCode(referralCode)` | Verify code before signup |

**Engagement Functions:**
| Function | Purpose |
|----------|---------|
| `trackReferralShare(platform)` | Log share event |
| `sendEmailInvite(email, message)` | Send invite (placeholder) |
| `generateSocialShareUrls(referralUrl)` | Social media URLs |

**Helper Functions:**
- `generateReferralCode(userName)` - Create unique code from name
- `processReferralSignup(referrerCode, newUserId)` - Internal processing

**Referral Schema:**
```javascript
{
  code, referredBy, referredAt,
  stats: {invitesSent, successfulReferrals, activeReferrals},
  rewards: {pointsEarned, bonusesReceived[]}
}
```

**Reward System:** 50 points per successful referral
**URL Format:** `/signup?ref={referralCode}`

---

### dietTypeService.js
**Purpose:** Diet type management with caching
**Size:** 149 lines
**Design:** Singleton class instance

**Methods:**
| Method | Purpose |
|--------|---------|
| `getDietTypes(userId)` | Get default + custom types |
| `addCustomDietType(userId, dietType)` | Add user type |
| `searchDietTypes(searchTerm, dietTypes)` | Filter with fuzzy matching |
| `clearCache()` | Force refresh |

**Default Types:**
Vegetarian, Vegan, Keto, Paleo, Low-Carb, Gluten-Free, Dairy-Free, Nut-Free, Halal, Kosher

**Caching:** 5-minute in-memory cache with auto-refresh

---

### ocrService.js
**Purpose:** OCR image recognition + OpenAI recipe parsing
**Size:** 220 lines
**APIs:** Tesseract.js, OpenAI GPT-3.5-turbo

**Functions:**
| Function | Purpose |
|----------|---------|
| `extractRawTextFromImage(imageFile)` | Extract text via Tesseract |
| `processRecipeImages(images)` | Multi-image processing |
| `processRecipeImage(imageFile)` | Single image wrapper |

**Helper Functions:**
- `normalizeRecipe(recipe)` - Standardize structure
- `validateRecipe(recipe)` - Ensure minimum fields

**Workflow:**
1. Extract raw text from image(s) using Tesseract.js
2. Combine multi-image text
3. Send to OpenAI with detailed JSON schema prompt
4. Parse JSON response
5. Normalize and validate
6. Return structured recipe

**Environment Required:** `REACT_APP_OPENAI_API_KEY`

---

### urlImportService.js
**Purpose:** Extract recipes from URLs via Cloud Function
**Size:** 86 lines
**Cloud Function:** `extractRecipeFromUrl`

**Function:**
```javascript
extractRecipeFromUrl(url) → Promise<Object>
```

**Helper Functions:**
- `normalizeRecipe(recipe)` - Copied from ocrService
- `validateRecipe(recipe)` - Copied from ocrService

**Note:** Code duplication with ocrService

**Function URL:** `https://us-central1-meal-planner-v1-9be19.cloudfunctions.net/extractRecipeFromUrl`

---

### gptShoppingService.js
**Purpose:** AI-powered shopping list generation
**Size:** 162 lines
**API:** Mistral AI (mistral-small-latest)

**Function:**
```javascript
generateShoppingList(mealPlan) → Promise<Array>
```

**Helper:**
- `parseShoppingListResponse(response)` - Parse AI response

**Environment Required:** `REACT_APP_MISTRAL_API_KEY`

**Categories:** Produce, Dairy, Meat & Seafood, Pantry, Frozen, Beverages, Other

---

### storageService.js
**Purpose:** Image upload and management
**Size:** 51 lines
**Storage:** Firebase Cloud Storage

**Functions:**
| Function | Purpose |
|----------|---------|
| `uploadRecipeImage(file, recipeId)` | Upload with UUID naming |
| `deleteRecipeImage(imagePath)` | Delete from storage |
| `getRecipeImagePath(recipeId, type)` | Generate path |
| `validateImageFile(file)` | Validate type & size |

**Path Format:** `recipe-images/{recipeId}/{filename}_{UUID}`
**Validation:** JPEG, PNG, WebP; Max 5MB

---

### starterRecipeService.js
**Purpose:** Seed starter recipes for new users
**Size:** ~100 lines

**Function:**
```javascript
seedStarterRecipesForUser(userId) → Promise<void>
```

**Starter Recipes:**
1. Simple Pancakes (Breakfast, Vegetarian)
2. Classic Caesar Salad (Lunch)
3. Spaghetti with Tomato Sauce (Dinner, Vegetarian)

**Implementation:** Uses `writeBatch` for atomic operations

---

### csvService.js
**Purpose:** Recipe import/export via CSV
**Size:** 52 lines
**Library:** PapaParse

**Functions:**
| Function | Purpose |
|----------|---------|
| `exportRecipesToCSV()` | Download recipes as CSV |
| `importRecipesFromCSV(file)` | Parse CSV file |

---

### profileService.js
**Purpose:** Profile persistence (duplicate functionality)
**Size:** 87 lines
**Note:** Similar to userService - potential consolidation

---

## Components (src/components/)

### components/layout/Header.js
**Purpose:** Application header with branding
**Size:** ~50 lines
**Props:** None
**Displays:** "Savor Meals" branding

---

### components/layout/BottomNav.js
**Purpose:** Mobile-friendly bottom navigation
**Size:** ~100 lines
**Features:**
- 5 navigation items
- Active state highlighting
- Metrics tracking on navigation
- Large center "Add Recipe" button

**Links:**
- Recipe Book
- Meal Planner
- Add Recipe (center)
- Shopping List
- Profile

---

### components/layout/Layout.js
**Purpose:** Page wrapper component
**Size:** Minimal
**Usage:** Wraps main content with Header and BottomNav

---

### components/ShareRecipeModal.js
**Purpose:** Modal for sharing recipes
**Size:** ~200 lines

**Features:**
- Generate share link
- Copy to clipboard
- Social media share buttons (Twitter, Facebook, WhatsApp)
- QR code display
- Share analytics

**Props:**
- `isOpen` - Modal visibility
- `onClose` - Close callback
- `recipe` - Recipe object to share

**Dependencies:** recipeSharingService

---

### components/InviteFriendsModal.js
**Purpose:** Modal for sending invites
**Size:** ~150 lines

**Features:**
- Email invite form
- Personal message customization
- Social share buttons
- Referral link display
- Copy to clipboard

**Props:**
- `isOpen` - Modal visibility
- `onClose` - Close callback

**Dependencies:** referralService

---

### components/ImageUploadButton.js
**Purpose:** Reusable image upload component
**Size:** ~80 lines

**Features:**
- File input with validation
- Preview thumbnail
- Upload progress indicator
- Error handling

---

## Features (src/features/)

### features/auth/Login.js
**Purpose:** User login page
**Size:** ~190 lines

**Features:**
- Email/password form
- "Remember me" checkbox
- Forgot password link
- Redirect parameter support
- Error handling

**State:**
```javascript
{
  formData: {email, password, rememberMe},
  errors: {},
  isSubmitting: false,
  redirectPath: null
}
```

**Flow:**
- Validate form
- `signInWithEmailAndPassword()`
- Set persistence (local or session)
- Redirect to redirectPath or home

---

### features/auth/Registration.js
**Purpose:** User registration page
**Size:** ~290 lines

**Features:**
- Full name, email, password fields
- Password confirmation
- Dietary preferences checkboxes
- Referral code handling
- Referral banner display
- Redirect parameter support

**State:**
```javascript
{
  formData: {name, email, password, confirmPassword, dietaryPreferences[]},
  errors: {},
  isSubmitting: false,
  referralCode: null,
  referrerName: null,
  redirectPath: null
}
```

**Flow:**
- Validate form
- `createUserWithEmailAndPassword()`
- `createUserProfile()` with referral code
- Redirect to redirectPath or welcome

**Dietary Options:** Vegetarian, Vegan, Keto, Paleo, Low-Carb, Gluten-Free, Dairy-Free

---

### features/auth/ForgotPassword.js
**Purpose:** Password reset page
**Size:** ~100 lines

**Features:**
- Email input form
- Send reset email
- Success/error messages

---

### features/auth/Account.js
**Purpose:** Account management page
**Features:**
- Logout functionality
- Account deletion
- Email change

---

### features/auth/welcome/Welcome.js
**Purpose:** Post-registration onboarding
**Size:** ~150 lines

**Features:**
- Welcome message
- Feature introduction
- Quick start guide
- Skip to app button

---

### features/recipeBook/RecipeBook.js
**Purpose:** Main recipe management page
**Size:** 514 lines ⚠️ (large component)

**State:**
```javascript
{
  recipesByDiet: {},
  allRecipes: [],
  selectedRecipe: null,
  searchTerm: '',
  filters: {dietTypes[], mealTypes[]},
  availableDietTypes: [],
  availableMealTypes: [],
  deleteDialog: {},
  isFilterPanelOpen: false,
  // Multiple modal states
}
```

**Features:**
- Recipe list display (grouped by diet type)
- Search functionality
- Filter panel (diet type, meal type)
- Recipe card display
- Add new recipe button
- Edit/delete operations
- Confirmation dialogs
- Mobile-responsive design

**Subcomponents:**
- SearchBar
- FilterPanel
- RecipeCard
- ConfirmDialog
- AddToMealPlanModal

---

### features/recipeBook/recipeForm/RecipeForm.js
**Purpose:** Recipe creation/edit form
**Size:** ~400 lines

**Uses Custom Hook:** `useRecipeForm`

**Form Sections:**
- Basic info (title, servings, times)
- Ingredients (enhanced selector)
- Instructions (rich text editor)
- Diet type dropdown
- Meal type selector
- Photo upload
- Import section (URL/CSV/OCR)

**Subcomponents:**
- BasicInfoFields
- PhotoUploadField
- InstructionsField
- ImportSection
- FormButtons
- IngredientSelector
- DietTypeDropdown

---

### features/recipeBook/recipeForm/hooks/useRecipeForm.js
**Purpose:** Recipe form state management hook
**Size:** ~200 lines

**Returns:**
```javascript
{
  formData,
  errors,
  handleChange,
  handleSubmit,
  validateForm,
  resetForm
}
```

**Validation:**
- Required fields (title, ingredients, instructions)
- Ingredient structure validation
- Serving count validation
- Time format validation

---

### features/recipeBook/recipeForm/IngredientSelector/
**Components:**
- `IngredientSelector.js` - Main component
- `SimpleIngredientSelector.js` - Basic version
- `EnhancedIngredientSelector.js` - Advanced version with autocomplete

**Features:**
- Add/remove ingredients
- Amount, unit, name inputs
- Validation
- Autocomplete suggestions

---

### features/recipeBook/recipeForm/DietTypeDropdown/
**Purpose:** Diet type selection with custom types
**Size:** ~100 lines

**Features:**
- System diet types
- Custom user-created types
- Add new type inline
- Autocomplete/search
- Multiple selection support

**Dependencies:** dietTypeService

---

### features/recipeBook/recipedetails/RecipeDetails.js
**Purpose:** Recipe view page
**Size:** ~300 lines

**Features:**
- Full recipe display
- Ingredients list
- Instructions (formatted HTML)
- Prep/cook times
- Servings
- Edit/delete buttons
- Share button
- Add to meal plan button
- Version history (if variations exist)

**Dependencies:** recipeService, recipeSharingService

---

### features/mealPlanner/MealPlannerPage.js
**Purpose:** Weekly meal planning interface
**Size:** 360 lines

**State:**
```javascript
{
  mealPlan: {},  // {day: {meal: {recipe, servings}}}
  savedMealPlans: [],
  selectedMealSlot: {day, meal},
  currentEditingPlan: null,
  originalMealPlan: null,
  hasUnsavedChanges: false,
  // Modal states
}
```

**Features:**
- 7-day calendar view
- Breakfast/Lunch/Dinner slots
- Click slot to add recipe
- Drag-and-drop (potential)
- Save meal plan with name
- Load saved plans
- Edit existing plans
- Delete plans
- Generate shopping list
- Unsaved changes warning

**Subcomponents:**
- WeeklyCalendar
- MealProgressCalendar
- RecipeSelectionModal
- SaveMealPlanModal
- SavedMealPlans
- ShoppingListGenerator

---

### features/mealPlanner/components/WeeklyCalendar.js
**Purpose:** 7-day meal slot grid
**Size:** ~150 lines

**Props:**
- `mealPlan` - Current plan object
- `onSlotClick` - Callback for slot selection

**Display:**
- 7 columns (Monday-Sunday)
- 3 rows (Breakfast, Lunch, Dinner)
- Recipe cards in slots
- Empty state prompts

---

### features/mealPlanner/components/RecipeSelectionModal.js
**Purpose:** Choose recipes for meal slots
**Size:** ~300 lines

**Features:**
- Recipe search
- Filter by diet/meal type
- Recipe list display
- Servings adjustment
- Multiple day selection (add to several days at once)
- Confirm selection

**Props:**
- `isOpen` - Modal visibility
- `onClose` - Close callback
- `onRecipeSelect` - Selection callback
- `selectedMealSlot` - Current slot being filled

---

### features/mealPlanner/components/SaveMealPlanModal.js
**Purpose:** Name and save meal plan
**Size:** ~80 lines

**Features:**
- Plan name input
- Save button
- Cancel button
- Validation (non-empty name)

---

### features/mealPlanner/components/SavedMealPlans.js
**Purpose:** Display and manage saved plans
**Size:** ~200 lines

**Features:**
- List of saved plans
- Load plan button
- Edit plan button
- Delete plan button
- Confirmation dialog
- Last updated display

---

### features/shoppingList/ShoppingListPage.js
**Purpose:** Shopping list management
**Size:** 648 lines ⚠️ (largest component)

**State:**
```javascript
{
  shoppingList: [],  // Array of items
  savedLists: [],
  currentListId: null,
  currentListName: '',
  saveStatus: 'saved' | 'saving' | 'unsaved',
  showQuickAdd: false,
  selectedCategory: null,
  editingItem: null,
  // Multiple modal states
}
```

**Features:**
- Create blank list
- Create from meal plan
- Load saved lists
- Auto-save (1.5s debounce)
- Quick-add items
- Browse categories
- Edit items inline
- Mark completed
- Mark "already have"
- Add notes
- Estimate costs
- Delete items
- Generate from recipes

**Subcomponents:**
- ShoppingListComponent
- ShoppingItem
- EditItemModal
- BrowseCategoriesModal
- RecipeSelectionModal
- ShoppingListAutocomplete
- SaveShoppingListModal
- SavedShoppingLists

**Categories:**
- Produce (Fruits, Vegetables, Herbs, Salad)
- Meat & Seafood
- Dairy & Eggs
- Pantry (Grains, Canned, Baking, Condiments, Spices)
- Beverages, Frozen, Health & Beauty, Other

---

### features/shoppingList/components/ShoppingItem.js
**Purpose:** Individual shopping list item component
**Size:** ~100 lines

**Features:**
- Checkbox (completed)
- "Already have" checkbox
- Item name, quantity, unit display
- Edit button
- Delete button
- Notes display
- Cost display

---

### features/profile/ProfilePage.js
**Purpose:** User profile and settings
**Size:** ~200 lines

**State:**
```javascript
{
  userData: null,
  isLoading: true,
  error: null,
  showInviteModal: false
}
```

**Sections:**
- UserInfoSection
- DietaryPreferencesSection
- ReferralSection

---

### features/profile/components/UserInfoSection.js
**Purpose:** Display and edit user info
**Size:** ~100 lines

**Features:**
- Profile image
- Name display/edit
- Email display
- Last login display
- Account created date

---

### features/profile/components/DietaryPreferencesSection.js
**Purpose:** Manage dietary preferences
**Size:** ~150 lines

**Features:**
- Diet type checkboxes
- Cuisine preferences
- Calorie goal input
- Macros sliders (protein, carbs, fat)
- Save preferences button

---

### features/profile/components/ReferralSection.js
**Purpose:** Referral program display
**Size:** ~145 lines

**Features:**
- Referral code display
- Shareable link
- Copy to clipboard
- Invite friends button
- Stats display:
  - Successful referrals
  - Points earned
- How it works section

**Props:**
- `onInviteFriends` - Callback to open invite modal

---

## Cloud Functions (functions/)

### functions/index.js
**Purpose:** Cloud Functions definitions
**Size:** 536 lines

**Functions Exported:**

#### helloWorld
- **Type:** HTTP (onRequest)
- **Purpose:** Health check
- **Response:** "Hello from Firebase Functions!"

#### fetchRecipeUrl
- **Type:** HTTP with CORS
- **Purpose:** Proxy endpoint to fetch HTML content from URLs
- **Input:** `{url: string}`
- **Output:** `{success: boolean, html: string, url: string}`
- **Status Codes:** 405 (non-POST), 400 (missing URL), 500 (fetch error)

#### extractRecipeFromUrl
- **Type:** HTTP with CORS + OpenAI
- **Purpose:** Extract structured recipe from URL using AI
- **Input:** `{url: string}`
- **Output:** `{success: boolean, recipe: Object}`
- **Processing:**
  1. Fetch HTML
  2. Strip tags and clean text
  3. Limit to 12,000 chars
  4. Call OpenAI GPT-3.5-turbo
  5. Parse JSON response
- **Secret:** `OPENAI_API_KEY`
- **Status Codes:** 405, 400, 500

#### resetMonthlyCredits
- **Type:** Scheduled (onSchedule)
- **Schedule:** `"1 0 1 * *"` (1st of month at 00:01 AM)
- **Timezone:** America/New_York
- **Purpose:** Reset free tier credits for all free users
- **Processing:**
  1. Query all free tier users
  2. Batch update (500 ops per batch)
  3. Reset freeCredits.total to 5
  4. Archive previous month usage

#### addPurchasedCredits
- **Type:** HTTP with CORS
- **Purpose:** Add purchased credits after payment
- **Input:** `{userId: string, credits: number, paymentData: Object}`
- **Output:** `{success: boolean, creditsAdded: number, newBalance: Object}`
- **Processing:**
  1. Validate inputs
  2. Firestore transaction
  3. Update user credits
  4. Create transaction record
  5. Create notification
- **Status Codes:** 405, 400, 500

#### consumeCredits
- **Type:** HTTP with CORS
- **Purpose:** Deduct credits for feature usage
- **Input:** `{userId: string, feature: string, requiredCredits: number, metadata: Object}`
- **Output:** `{success: boolean, creditsUsed: number, breakdown: Object, balanceBefore/After: Object}`
- **Processing:**
  1. Validate inputs
  2. Firestore transaction
  3. Check sufficient balance
  4. Deduct credits (free first, then paid)
  5. Create transaction + usage event
- **Status Codes:** 405, 400, 402 (insufficient), 500

---

### functions/package.json
**Purpose:** Cloud Functions dependencies
**Node Runtime:** 22
**Dependencies:**
- firebase-admin: ^12.7.0
- firebase-functions: ^6.3.2
**Dev Dependencies:**
- eslint: ^8.15.0
- firebase-functions-test: ^3.1.0

---

### functions/.eslintrc.cjs
**Purpose:** ESLint configuration
**Rules:**
- ES6 environment
- Google style base
- No restricted globals (name, length)
- Double quotes required
- Arrow callbacks preferred

---

## Scripts (scripts/)

### scripts/backfillUserMetrics.js
**Purpose:** Backfill metrics for existing users
**Size:** 7.7 KB
**Usage:** `node scripts/backfillUserMetrics.js`

**Target Users:** 8 hardcoded user IDs (lines 38-47)

**Process:**
1. Count recipes per user
2. Count meal plans per user
3. Count shopping lists per user
4. Get most recent creation dates
5. Update user metrics object
6. Preserve existing feature usage

**Dependencies:** Firebase Admin SDK

---

### scripts/migrate-recipes.js
**Purpose:** Assign userId to recipes without one
**Size:** 2.6 KB
**Usage:** `node scripts/migrate-recipes.js`

**Configuration:** Edit `YOUR_USER_ID` variable

**Safety:** Requires manual confirmation before executing

---

### scripts/migrateMealPlans.js
**Purpose:** Migrate meal plans without userId
**Size:** 2.8 KB
**Usage:** `node scripts/migrateMealPlans.js`

**Configuration:** Uses `.env` file

---

### scripts/update-mealplans.js
**Purpose:** Batch update meal plans with userId
**Size:** 4.3 KB
**Usage:** `node scripts/update-mealplans.js`

**Safety Features:**
- Displays analysis before updating
- Requires YES confirmation
- Batch operations (450 per batch)

---

### scripts/updateMealTypes.js
**Purpose:** Update meal type references
**Size:** 1.2 KB
**Usage:** `node scripts/updateMealTypes.js`

---

## Utilities (src/utils/)

### utils/ingredientCategories.js
**Purpose:** Ingredient categorization taxonomy
**Size:** ~150 lines

**Exports:**
```javascript
{
  CATEGORIES: {
    PRODUCE: {...},
    MEAT_SEAFOOD: {...},
    DAIRY: {...},
    PANTRY: {...},
    // etc.
  },
  categorizeIngredient(name)
}
```

**Categories Defined:**
- Produce (Fruits, Vegetables, Herbs)
- Meat & Seafood
- Dairy & Eggs
- Pantry (Grains, Canned, Baking, Condiments, Spices)
- Beverages
- Frozen
- Health & Beauty
- Other

---

### utils/quantityNormalizer.js
**Purpose:** Unit normalization utilities
**Size:** ~100 lines

**Functions:**
- `normalizeUnit(unit)` - Convert to singular form
- `convertUnit(amount, fromUnit, toUnit)` - Unit conversion
- `formatQuantity(amount, unit)` - Display formatting

**Supported Units:**
- Volume: cup, tablespoon, teaspoon, liter, ml
- Weight: pound, ounce, gram, kg
- Count: piece, item, whole

---

## Summary Statistics

| Category | Count | Total Lines |
|----------|-------|-------------|
| **Services** | 22 | 4,634 |
| **Components** | 60+ | ~8,000 |
| **CSS Files** | 53 | ~3,000 |
| **Cloud Functions** | 6 | 536 |
| **Scripts** | 5 | ~18 KB |
| **Configuration** | 5 | ~200 |
| **Total** | 150+ | ~16,000+ |

---

## Key File Relationships

```
App.js
  ├─ firebase.js (initialization)
  ├─ Features/
  │  ├─ RecipeBook → recipeService, dietTypeService, ocrService
  │  ├─ MealPlanner → mealPlanService, recipeService
  │  ├─ ShoppingList → ShoppingListService, gptShoppingService
  │  └─ Profile → profileService, referralService, userMetricsService
  └─ Services/
     ├─ authHelper (base)
     ├─ userService → creditService, userMetricsService, referralService
     ├─ recipeService
     ├─ mealPlanService
     └─ ShoppingListService
```

---

**End of File Reference Guide**

For architecture overview, see [ARCHITECTURE.md](./ARCHITECTURE.md)
For code review findings, see [CODE_REVIEW.md](./CODE_REVIEW.md)
