# MealPlanner Application Architecture Documentation

**Version:** 1.0
**Last Updated:** November 26, 2025
**Project:** MealPlanner Web Application

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Technology Stack](#technology-stack)
4. [Application Architecture](#application-architecture)
5. [Frontend Architecture](#frontend-architecture)
6. [Backend Architecture](#backend-architecture)
7. [Database Schema](#database-schema)
8. [Authentication & Security](#authentication--security)
9. [Data Flow Patterns](#data-flow-patterns)
10. [External Integrations](#external-integrations)
11. [Deployment Architecture](#deployment-architecture)
12. [Performance Considerations](#performance-considerations)
13. [Scalability](#scalability)

---

## Executive Summary

MealPlanner is a React-based web application that helps users manage recipes, plan meals, generate shopping lists, and share recipes with friends. Built on Firebase infrastructure, it provides a complete meal planning ecosystem with AI-powered features, social engagement, and monetization capabilities.

### Key Metrics
- **Frontend:** 53 CSS files, 60+ React components
- **Backend Services:** 22 service modules, 4,634 lines of code
- **Cloud Functions:** 6 serverless functions
- **Database Collections:** 12 Firestore collections
- **External APIs:** OpenAI (GPT-3.5), Mistral AI, Tesseract.js

---

## System Overview

### Application Purpose
MealPlanner enables users to:
- Create and manage personal recipe collections
- Plan weekly meals with drag-and-drop interface
- Generate intelligent shopping lists from meal plans
- Share recipes publicly with tracking
- Track usage metrics and achievements
- Earn rewards through referral program

### User Journey
```
Registration/Login
    ↓
Recipe Book (Add/Import recipes)
    ↓
Meal Planner (Plan weekly meals)
    ↓
Shopping List (Generate from plan)
    ↓
Share & Social Features
    ↓
Profile & Metrics
```

---

## Technology Stack

### Frontend
- **Framework:** React 18.3.1
- **Routing:** React Router v6
- **State Management:** Local component state + Firestore
- **Styling:** CSS Modules + Global CSS
- **Icons:** Lucide React
- **Rich Text Editor:** React Quill
- **Build Tool:** Create React App

### Backend
- **Platform:** Firebase (Google Cloud)
- **Database:** Cloud Firestore (NoSQL)
- **Authentication:** Firebase Authentication
- **Storage:** Firebase Cloud Storage
- **Functions:** Cloud Functions (Node.js 22)
- **Hosting:** Firebase Hosting

### External Services
- **AI:** OpenAI GPT-3.5-turbo (recipe parsing)
- **AI:** Mistral AI (shopping list optimization)
- **OCR:** Tesseract.js (image text extraction)
- **Payment:** Stripe/PayPal integration (configured)

---

## Application Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT LAYER (React)                          │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ RecipeBook   │  │ MealPlanner  │  │ ShoppingList │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Profile      │  │ Sharing      │  │ Auth Pages   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────┬─────────────────────────────────────────┘
                        │
┌────────────────────────┴─────────────────────────────────────────┐
│                    SERVICE LAYER (22 Services)                    │
│                                                                  │
│  ┌─ Core Services ────────────────────────────────────────┐    │
│  │ authHelper, userService, profileService                │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ Content Services ─────────────────────────────────────┐    │
│  │ recipeService, mealPlanService, ShoppingListService    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ Feature Services ─────────────────────────────────────┐    │
│  │ creditService, recipeSharingService, referralService,  │    │
│  │ userMetricsService, dietTypeService                    │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ AI Services ──────────────────────────────────────────┐    │
│  │ ocrService, urlImportService, gptShoppingService       │    │
│  └────────────────────────────────────────────────────────┘    │
└────────────────────────┬─────────────────────────────────────────┘
                        │
┌────────────────────────┴─────────────────────────────────────────┐
│                    FIREBASE BACKEND                              │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cloud Firestore (12 Collections)                        │  │
│  │ users, recipes, mealPlans, shoppingLists, etc.          │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cloud Functions (6 Functions)                           │  │
│  │ extractRecipeFromUrl, consumeCredits, resetMonthlyCredits│ │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Authentication & Storage                                 │  │
│  │ Firebase Auth, Cloud Storage                             │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Component Organization

```
src/
├── components/           # Shared components
│   ├── layout/
│   │   ├── Header.js
│   │   ├── BottomNav.js
│   │   └── Layout.js
│   └── modals/
│       ├── ShareRecipeModal.js
│       └── InviteFriendsModal.js
├── features/            # Feature modules
│   ├── auth/            # Authentication
│   ├── recipeBook/      # Recipe management
│   ├── mealPlanner/     # Meal planning
│   ├── shoppingList/    # Shopping lists
│   └── profile/         # User profile
├── pages/               # Route pages
├── services/            # Backend integration
└── utils/              # Utilities
```

### State Management Strategy

**No Global State Library**
The application uses:
1. Local component state (`useState`)
2. Firebase Firestore as source of truth
3. Service layer for business logic
4. Session storage for temporary state

**Rationale:**
- Simple architecture for current scale
- Firebase provides real-time synchronization
- Reduces complexity and dependencies
- Easy to add Context API or Zustand if needed

### Routing Structure

```javascript
Public Routes:
  /login
  /register
  /forgot-password
  /shared/:linkId        // Public recipe view

Protected Routes (Authentication Required):
  /                      // Home
  /recipe-book           // Recipe management
  /meal-planner          // Meal planning
  /shopping-list         // Shopping lists
  /profile               // User profile
  /account               // Account settings
```

---

## Backend Architecture

### Service Layer Pattern

Each service module follows a consistent pattern:
1. Import Firebase SDK modules
2. Import helper utilities
3. Define service functions with error handling
4. Export functions for component use

**Example Service Structure:**
```javascript
// Auth verification
const userId = getCurrentUserId();
if (!userId) throw new Error('Not authenticated');

// Firestore operation
const docRef = doc(db, 'collection', docId);
const docSnap = await getDoc(docRef);

// Error handling
try {
  // Operations
} catch (error) {
  console.error('Error:', error);
  throw new Error('User-friendly message');
}
```

### Service Dependencies

```
authHelper (base utility)
    ↓
userService → creditService
    ↓         → userMetricsService
    ↓         → referralService
    ↓
recipeService → dietTypeService
    ↓           → storageService
    ↓           → userMetricsService
    ↓
mealPlanService
    ↓
ShoppingListService → gptShoppingService
```

### Cloud Functions Architecture

**HTTP Callable Functions:**
- `fetchRecipeUrl` - CORS proxy for URL fetching
- `extractRecipeFromUrl` - AI recipe extraction
- `addPurchasedCredits` - Payment webhook
- `consumeCredits` - Feature usage tracking

**Scheduled Functions:**
- `resetMonthlyCredits` - Monthly credit reset (cron: 1st at 00:01)

---

## Database Schema

### Collections Overview

| Collection | Purpose | Key Fields | Relationships |
|-----------|---------|------------|---------------|
| **users** | User profiles | uid, email, name, subscription, credits, metrics, referral | 1:N recipes |
| **recipes** | User recipes | userId, title, ingredients, instructions, dietType | N:1 users, 1:N variations |
| **variations** | Recipe versions | recipeId, userId, modifications | N:1 recipes |
| **mealPlans** | Saved meal plans | userId, name, plan (7-day structure) | N:1 users |
| **shoppingLists** | Shopping lists | userId, name, items[], isActive | N:1 users |
| **publicRecipes** | Shared recipes | authorId, recipeData, engagement, visibility | N:1 users |
| **sharedLinks** | Share URLs | linkId, type, resourceId, analytics | N:1 publicRecipes |
| **recipeInteractions** | User engagement | userId, recipeId, saved, madeThis | N:N users:recipes |
| **referrals** | Referral tracking | referrerId, code, stats, rewards | 1:1 users |
| **transactions** | Credit transactions | userId, type, amount, status | N:1 users |
| **usageEvents** | Analytics | userId, feature, timestamp | N:1 users |
| **notifications** | User alerts | userId, type, message, read | N:1 users |

### User Document Structure

```javascript
{
  uid: string,
  email: string,
  name: string,
  createdAt: Timestamp,
  lastLogin: Timestamp,

  subscription: {
    tier: 'free' | 'premium',
    status: 'active' | 'cancelled',
    startDate: Timestamp,
    renewalDate: Timestamp
  },

  credits: {
    freeCredits: {
      total: 5,
      used: 0,
      remaining: 5,
      resetDate: Timestamp,
      lastResetAt: Timestamp
    },
    paidCredits: {
      balance: 0,
      totalPurchased: 0,
      totalSpent: 0
    },
    totalAvailable: 5,
    usage: {
      thisMonth: 0,
      lastMonth: 0,
      allTime: 0,
      averagePerMonth: 0
    }
  },

  metrics: {
    totalRecipesAdded: 0,
    totalMealPlansCreated: 0,
    totalShoppingListsGenerated: 0,
    featureUsage: {
      recipeBook: 0,
      mealPlanner: 0,
      shoppingList: 0,
      profile: 0
    },
    lastActiveDate: Timestamp,
    totalSessions: 0
  },

  referral: {
    code: string,
    referredBy: string | null,
    stats: {
      invitesSent: 0,
      successfulReferrals: 0
    },
    rewards: {
      pointsEarned: 0
    }
  },

  customDietTypes: [string]
}
```

### Recipe Document Structure

```javascript
{
  id: string,
  userId: string,
  title: string,
  ingredients: [
    {
      amount: number,
      unit: string,
      ingredientId: string
    }
  ],
  instructions: string,  // HTML/plain text
  servings: number,
  prepTime: string,
  cookTime: string,
  mealType: string,
  dietType: string | [string],
  difficulty: string,
  imageUrl: string,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isStarterRecipe: boolean
}
```

### Indexes

Current Composite Index:
```
shoppingLists: {userId ASC, isActive ASC, updatedAt DESC}
```

Recommended Additional Indexes:
```
recipes: {userId ASC, createdAt DESC}
mealPlans: {userId ASC, savedAt DESC}
publicRecipes: {visibility ASC, sharedAt DESC}
transactions: {userId ASC, createdAt DESC}
```

---

## Authentication & Security

### Authentication Flow

```
User registers/logs in
    ↓
Firebase Auth creates user
    ↓
onAuthStateChanged listener (App.js)
    ↓
Set isAuthenticated state
    ↓
ProtectedRoute checks auth
    ↓
Create user profile in Firestore
    ↓
Initialize credits, metrics, referrals
    ↓
Redirect to protected routes
```

### Security Rules (Firestore)

**User Data Isolation:**
```javascript
// Users can only read/write their own data
match /users/{userId} {
  allow read, write: if request.auth.uid == userId;
}

// Recipes owned by user
match /recipes/{recipeId} {
  allow read, write: if resource.data.userId == request.auth.uid;
}
```

**Public Content:**
```javascript
// Public recipes readable by all
match /publicRecipes/{recipeId} {
  allow read: if resource.data.visibility == 'public';
  allow write: if request.auth.uid == resource.data.authorId;
}
```

### API Security

**Frontend:**
- Firebase SDK automatically handles auth tokens
- All Firestore operations validate user ownership

**Cloud Functions:**
- ⚠️ **Critical:** HTTP functions currently lack authentication
- Recommended: Add `if (!request.auth)` checks
- Need: Rate limiting implementation

---

## Data Flow Patterns

### Recipe Creation Flow

```
User submits recipe form
    ↓
RecipeForm component
    ↓
useRecipeForm hook validates
    ↓
recipeService.addRecipe(data)
    ↓
Firebase: Add to recipes collection
    ↓
storageService.uploadImage() (if image)
    ↓
userMetricsService.trackRecipeAdded()
    ↓
Navigate to recipe details
```

### Meal Plan to Shopping List Flow

```
User has completed meal plan
    ↓
Click "Generate Shopping List"
    ↓
ShoppingListService.createListFromMealPlan()
    ↓
Extract all ingredients from recipes
    ↓
Consolidate duplicates (same name + unit)
    ↓
Categorize by ingredient type
    ↓
Calculate quantities based on servings
    ↓
Create shopping list document
    ↓
Navigate to shopping list page
    ↓
Auto-save on edits (1.5s debounce)
```

### Recipe Sharing Flow

```
User clicks "Share Recipe"
    ↓
ShareRecipeModal opens
    ↓
recipeSharingService.shareRecipe(recipeId)
    ↓
Create publicRecipes document
    ↓
Generate unique share link (8-char ID)
    ↓
Store in sharedLinks collection
    ↓
Return shareable URL
    ↓
User copies link or shares to social
    ↓
Recipient opens /shared/{linkId}
    ↓
trackShareLinkView() increments analytics
    ↓
Show recipe + "Save" button
    ↓
If not logged in → redirect to signup
    ↓
After signup → auto-save recipe to user's collection
```

### Credit Consumption Flow

```
User triggers paid feature
    ↓
creditService.consumeCredits(feature, metadata)
    ↓
Firestore transaction starts
    ↓
Read user credits
    ↓
Check sufficient balance (free first, then paid)
    ↓
Deduct credits atomically
    ↓
Create transaction record
    ↓
Create usage event
    ↓
Commit transaction
    ↓
Return new balance
```

---

## External Integrations

### OpenAI Integration

**Purpose:** Extract structured recipes from images and URLs
**Model:** GPT-3.5-turbo
**Cost:** ~$0.0005-0.0015 per 1K tokens

**Flow:**
```
Image/URL → Extract text → Send to OpenAI → Parse JSON → Normalize recipe
```

**Prompt Engineering:**
- Detailed JSON schema provided
- Specific field requirements
- Ingredient structure with amount, unit, name

### Mistral AI Integration

**Purpose:** Optimize shopping list generation
**Model:** mistral-small-latest

**Flow:**
```
Meal plan → Format for AI → Call Mistral → Parse response → Categorized list
```

### Tesseract.js OCR

**Purpose:** Extract text from recipe images
**Processing:** Client-side in browser
**Languages:** English (primary)

---

## Deployment Architecture

### Build Process

```
Source Code (src/)
    ↓
npm run build (Create React App)
    ↓
Optimized bundle (build/)
    ↓
firebase deploy
    ↓
Firebase Hosting (CDN)
```

### Cloud Functions Deployment

```
functions/index.js
    ↓
firebase deploy --only functions
    ↓
Auto-deploy to Cloud Functions
    ↓
Available at:
https://us-central1-meal-planner-v1-9be19.cloudfunctions.net/{functionName}
```

### Environment Configuration

**Frontend (.env):**
```
REACT_APP_FIREBASE_API_KEY
REACT_APP_FIREBASE_AUTH_DOMAIN
REACT_APP_FIREBASE_PROJECT_ID
REACT_APP_FIREBASE_STORAGE_BUCKET
REACT_APP_OPENAI_API_KEY (⚠️ should be backend-only)
REACT_APP_MISTRAL_API_KEY (⚠️ should be backend-only)
```

**Cloud Functions (Secrets):**
```
OPENAI_API_KEY (via Firebase Secret Manager)
```

---

## Performance Considerations

### Frontend Performance

**Current State:**
- No code splitting (all JavaScript in single bundle)
- No lazy loading for routes or components
- No image optimization
- No memoization (React.memo, useMemo)

**Impact:**
- Initial bundle size: 279.81 kB (gzipped)
- Potential re-rendering issues with large lists
- All features loaded upfront

**Recommendations:**
1. Implement React.lazy() for route-based code splitting
2. Add React.memo to heavy components (RecipeCard, ShoppingItem)
3. Use useMemo for expensive calculations
4. Implement virtual scrolling for large lists
5. Optimize images with lazy loading and WebP format

### Backend Performance

**Firestore Query Patterns:**
- ✅ Indexed queries (shoppingLists)
- ⚠️ Missing indexes for common queries (recipes, mealPlans)
- ⚠️ No pagination on large result sets
- ⚠️ N+1 query pattern in shopping list generation

**Caching Strategy:**
- ✅ dietTypeService has 5-minute in-memory cache
- ⚠️ No caching for user data or recipes
- ⚠️ No CDN caching strategy

**Recommendations:**
1. Add composite indexes for all filtered queries
2. Implement cursor-based pagination
3. Add client-side caching with invalidation
4. Use batched reads where possible
5. Implement Firestore query optimization

---

## Scalability

### Current Capacity

**Firebase Limits:**
- Firestore: 1M document reads/day (free tier)
- Cloud Functions: 2M invocations/month (free tier)
- Storage: 5GB (free tier)

**Estimated User Capacity:**
- 100-500 concurrent users (comfortably)
- 1K-5K total users (free tier)
- 10K-50K users (paid tier with optimization)

### Scaling Bottlenecks

1. **OpenAI API Costs**
   - Expensive at scale
   - Need caching and rate limiting

2. **Firestore Read/Write Costs**
   - Real-time listeners consume reads
   - Need query optimization

3. **Cloud Functions Cold Starts**
   - 1-2 second delay on first invocation
   - Consider minimum instances for critical functions

4. **Frontend Bundle Size**
   - 280KB will grow with features
   - Need code splitting strategy

### Scaling Strategy

**Phase 1 (0-1K users):**
- Current architecture sufficient
- Focus on features

**Phase 2 (1K-10K users):**
- Add caching layer
- Implement pagination
- Optimize indexes
- Add monitoring

**Phase 3 (10K-100K users):**
- Consider Redis for caching
- Implement CDN for assets
- Add read replicas
- Horizontal scaling with Cloud Run

**Phase 4 (100K+ users):**
- Multi-region deployment
- Dedicated database instances
- Microservices architecture
- Advanced monitoring and alerting

---

## Architecture Decision Log

### Why Firebase?
- Rapid development with managed services
- Built-in authentication and security
- Real-time synchronization
- Automatic scaling
- Pay-as-you-grow pricing

### Why No Global State Management?
- Current scale doesn't require it
- Firebase provides data synchronization
- Local state is sufficient
- Can add Context API or Zustand later if needed

### Why React (not Next.js)?
- SPA architecture suitable for current needs
- No SEO requirements (authenticated app)
- Simple deployment model
- May migrate to Next.js for public pages later

### Why Cloud Functions?
- Serverless reduces operational overhead
- Automatic scaling
- Pay-per-use pricing
- Integrates seamlessly with Firebase

---

## Future Architecture Considerations

### Potential Migrations

**TypeScript Migration:**
- Benefits: Type safety, better IDE support
- Effort: Medium (gradual migration possible)
- Priority: Medium

**Next.js Migration:**
- Benefits: SSR for public pages, better SEO
- Effort: High (significant refactoring)
- Priority: Low (unless SEO becomes critical)

**Monorepo Structure:**
- Benefits: Shared types/utils between frontend/backend
- Effort: Medium
- Priority: Medium

### Additional Features

**Mobile App:**
- React Native for iOS/Android
- Share codebase with web via monorepo
- Firebase SDK supports mobile

**Offline Support:**
- PWA with service workers
- Firestore offline persistence
- Sync when connection restored

**Advanced Analytics:**
- Google Analytics 4 integration
- Custom event tracking
- User behavior analysis

---

## Conclusion

MealPlanner's architecture is well-suited for its current scale and feature set. The modular design, clear separation of concerns, and Firebase infrastructure provide a solid foundation for growth. Key areas for improvement include security hardening, performance optimization, and scalability enhancements as the user base grows.

For detailed implementation guides, see:
- [File-by-File Reference](./FILE_REFERENCE.md)
- [Code Review Findings](./CODE_REVIEW.md)
- [Development Guide](./DEVELOPMENT.md)

---

**Document Version:** 1.0
**Last Updated:** November 26, 2025
**Maintained By:** Development Team
