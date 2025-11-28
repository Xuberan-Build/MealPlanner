# Meal Planner Application Documentation

## Overview

The Meal Planner is a comprehensive web application designed to simplify meal planning, recipe management, grocery shopping, and health tracking. It allows users to create and manage recipes, plan meals for the week, generate shopping lists based on meal plans, track their health journey, and maintain detailed user profiles with dietary preferences.

## Tech Stack

### Frontend
- **React**: The application is built using React (v18.3.1) for the UI components and state management
- **React Router**: Used for navigation and routing between different sections of the application
- **CSS Modules**: Used for component-specific styling with a consistent design system
- **Lucide React**: Modern icon library for UI elements

### Backend & Data Storage
- **Firebase**:
  - Firestore: NoSQL database for storing recipes, meal plans, user profiles, shopping lists, and health data
  - Firebase Storage: For storing recipe images, progress photos, and other media
  - Firebase Analytics: For tracking user interactions and application usage
  - Firebase Authentication: Secure user authentication and authorization

### External Services & Libraries
- **OpenAI & LlamaAI**: Integration for AI-powered features
- **Tesseract.js**: OCR (Optical Character Recognition) for extracting recipe information from images
- **PapaParse**: For CSV import/export functionality
- **LocalStorage**: Browser-based persistence for working meal plans

### Design System
- **Color Palette**:
  - Sage (#B7C4B7): Primary actions and interactive elements
  - Dark Sage (#a5b2a5): Hover states and emphasis
  - Mist (#E8EFEA): Light backgrounds and borders
  - Soft White (#FAFAFA): Card backgrounds
  - Deep Charcoal (#2C2C2C): Primary text

## Application Structure

The application follows a feature-based architecture, with the codebase organized into the following main directories:

- **src/features/**: Contains feature-specific components and logic
  - **mealPlanner/**: Meal planning functionality with calendar views
  - **recipeBook/**: Recipe management and sharing
  - **shoppingList/**: Shopping list generation, management, and persistence
  - **profile/**: User profile management with tabbed interface
  - **home/**: Home page components
  - **auth/**: Authentication pages (login, registration)
- **src/components/**: Shared UI components (Header, BottomNav, etc.)
- **src/services/**: Service modules for data operations
  - **mealPlanService.js**: Meal plan CRUD operations
  - **recipeService.js**: Recipe management
  - **ShoppingListService.js**: Shopping list operations
  - **healthJourneyService.js**: Health tracking data management
  - **authHelper.js**: Authentication utilities
- **src/utils/**: Utility functions and helpers
- **docs/**: Comprehensive documentation files

## Key Features

### 1. Recipe Management

The Recipe Book feature allows users to:
- **Create and Edit Recipes**:
  - Rich recipe editor with title, description, ingredients, instructions
  - Cooking time and serving size specification
  - Meal type categorization (breakfast, lunch, dinner, snacks)
  - Custom diet types with autocomplete suggestions
  - AI-powered recipe formatting and ingredient parsing

- **Recipe Import**:
  - Import from URLs (automatic parsing)
  - Import from text (AI-powered structure extraction)
  - Import from images via OCR (Tesseract.js)
  - Batch import from CSV files

- **Recipe Media**:
  - Upload and manage recipe images
  - Image compression and optimization
  - Multiple images per recipe support

- **Recipe Organization**:
  - Filter by meal type, diet type, and custom criteria
  - Search functionality across all recipe fields
  - Dietary preference filtering
  - Custom diet type creation and persistence

- **Recipe Sharing**:
  - Share recipes via public links
  - QR code generation for easy sharing
  - View shared recipes without account required

- **Quick Actions**:
  - Add recipe directly to meal planner from Recipe Book
  - Duplicate recipes for variations
  - Export recipes to CSV
  - Delete with confirmation

### 2. Meal Planning

The Meal Planner feature enables users to:

- **Visual Weekly Calendar**:
  - Desktop: Full week grid view with all meals visible
  - Mobile: Day-by-day swipe navigation with clean card interface
  - Visual meal type cards (Breakfast, Lunch, Dinner, Snacks)

- **Weekly Progress Tracker**:
  - Visual progress indicators for each day (0/4, 1/4, etc.)
  - Color-coded status (empty, partial, complete)
  - Clickable day cells to navigate between days
  - Today indicator highlighting
  - Synchronized with mobile day navigation

- **Meal Plan Management**:
  - Create new meal plans from scratch
  - Save meal plans with custom names
  - Load previously saved meal plans
  - Edit existing meal plans in-place
  - Quick update for saved plans
  - Save edited plans as new copies
  - Delete meal plans with confirmation

- **Recipe Selection**:
  - Browse recipes filtered by meal type
  - Search across recipe collection
  - Filter by dietary preferences
  - Add to multiple days simultaneously
  - Adjust serving sizes per meal
  - Remove recipes from meal slots

- **Saved Plans Panel**:
  - Desktop: Slide-in side panel from right
  - Mobile: Bottom sheet with overlay
  - View all saved meal plans with previews
  - See save dates and meal counts
  - Quick load, edit, or delete actions
  - Visual "Editing" indicator on active plan

- **Persistence & Auto-Save**:
  - Working meal plan auto-saved to localStorage
  - Persists across page navigation
  - Survives browser refresh
  - Clear indication of unsaved changes
  - Manual "Clear Plan" option with confirmation

- **Day Navigation**:
  - Arrow buttons to navigate days
  - Day indicator dots for quick jumping
  - Click weekly progress cells to switch days
  - All navigation methods synchronized

- **Shopping List Integration**:
  - Generate shopping list from current meal plan
  - Aggregates ingredients across all meals
  - Automatically categorizes items
  - Carries meal plan context to shopping list

### 3. Shopping List Management

The Shopping List feature allows users to:

- **List Generation**:
  - Generate from meal plans with one click
  - Automatic ingredient aggregation
  - Smart quantity combining (e.g., 2 cups + 1 cup = 3 cups)
  - Category-based organization

- **List Customization**:
  - Add custom items manually
  - Edit quantities and units
  - Move items between categories
  - Remove individual items

- **Shopping Interface**:
  - Check off items as purchased
  - Visual completion indicator
  - Undo accidental purchases
  - Clear purchased items

- **List Persistence**:
  - Save shopping lists with custom names
  - Load previously saved lists
  - View save dates and item counts
  - Delete old lists
  - Auto-save working list to localStorage

- **Mobile Optimization**:
  - Touch-friendly checkboxes
  - Swipe gestures
  - Bottom sheet saved lists panel
  - Compact category organization

### 4. User Profile Management

The Profile feature has been completely redesigned with a tabbed interface:

#### Profile Tab
- **Personal Information**:
  - Name and email display
  - Profile image upload
  - Account settings

- **Dietary Preferences**:
  - Multiple diet types selection
  - Allergen tracking
  - Preferred cuisines
  - Meal frequency preferences
  - Custom dietary notes

#### Health Journey Tab *(New)*

A comprehensive health tracking system with four main components:

**Weight Tracking**:
- Log weight entries with dates and notes
- Visual chart showing progress over time
- Goal weight setting and tracking
- BMI calculation and display
- Weekly/monthly trend analysis
- Edit or delete historical entries

**Fitness Goals**:
- Create SMART goals (Specific, Measurable, Achievable, Relevant, Time-bound)
- Track goal progress with visual indicators
- Set target dates and milestones
- Mark goals as complete
- View active and completed goals
- Edit goals as needed

**Body Measurements**:
- Track multiple measurements:
  - Chest, waist, hips
  - Thighs, arms, calves
  - Neck, shoulders
- Historical measurement tracking
- Visual progress charts
- Compare measurements over time
- Add notes for context

**Progress Photos**:
- Upload before/after photos
- Multiple photo types:
  - Front view, side view, back view
  - Custom angles
- Date-stamped entries
- Privacy controls (private/public)
- Side-by-side comparison view
- Grid gallery view
- Notes and context for each photo

#### Referrals Tab
- Share referral links
- Track referral status
- Earn rewards for referrals
- Social media integration

### 5. Health Journey Features *(New)*

Comprehensive health tracking integrated with meal planning:

- **Data Visualization**:
  - Interactive charts for weight trends
  - Progress indicators for goals
  - Measurement comparisons
  - Photo timeline

- **Goal Setting**:
  - Weight goals with target dates
  - Fitness milestones
  - Measurement targets
  - Custom goal categories

- **Progress Monitoring**:
  - Weekly weigh-ins
  - Monthly measurement checks
  - Photo documentation
  - Achievement tracking

- **Privacy & Security**:
  - Personal data encrypted
  - Private photo storage
  - Sharing controls
  - Data export options

### 6. OCR Recipe Import

The application includes an advanced OCR feature that:
- Extracts recipe information from images
- Parses ingredients, instructions, servings, and cooking times
- Normalizes ingredient quantities and measurements
- Categorizes ingredients automatically
- Handles multiple languages
- Provides review interface before saving

## Data Models

### Recipe
```javascript
{
  id: string,
  userId: string,
  title: string,
  description: string,
  ingredients: [
    {
      name: string,
      quantity: number,
      unit: string,
      category: string
    }
  ],
  instructions: [
    {
      step: number,
      text: string
    }
  ],
  cookingTime: number,
  servings: number,
  mealType: string,
  dietType: [string],
  imageUrl: string,
  isPublic: boolean,
  createdAt: timestamp,
  updatedAt: timestamp,
  version: number
}
```

### Meal Plan
```javascript
{
  id: string,
  userId: string,
  name: string,
  savedAt: timestamp,
  plan: {
    Monday: {
      Breakfast: { recipe: Recipe, servings: number },
      Lunch: { recipe: Recipe, servings: number },
      Dinner: { recipe: Recipe, servings: number },
      Snacks: { recipe: Recipe, servings: number }
    },
    // ... other days
  }
}
```

### Shopping List
```javascript
{
  id: string,
  userId: string,
  name: string,
  savedAt: timestamp,
  items: [
    {
      id: string,
      name: string,
      quantity: number,
      unit: string,
      category: string,
      purchased: boolean,
      fromRecipe: string
    }
  ]
}
```

### User Profile
```javascript
{
  id: string,
  email: string,
  name: string,
  dietaryPreferences: [string],
  allergens: [string],
  profileImage: string,
  createdAt: timestamp
}
```

### Health Journey Data *(New)*
```javascript
// Weight Entry
{
  id: string,
  userId: string,
  date: timestamp,
  weight: number,
  unit: string,
  notes: string
}

// Goal
{
  id: string,
  userId: string,
  title: string,
  description: string,
  targetDate: timestamp,
  category: string,
  progress: number,
  completed: boolean,
  createdAt: timestamp
}

// Measurement
{
  id: string,
  userId: string,
  date: timestamp,
  measurements: {
    chest: number,
    waist: number,
    hips: number,
    // ... other measurements
  },
  unit: string,
  notes: string
}

// Progress Photo
{
  id: string,
  userId: string,
  date: timestamp,
  photoUrl: string,
  type: string, // 'front', 'side', 'back'
  privacy: string, // 'private', 'public'
  weight: number,
  notes: string
}
```

## User Flows

### Recipe Creation Flow
1. User navigates to Recipe Book
2. User selects "Add New Recipe"
3. User chooses input method:
   - Manual entry
   - URL import
   - Text import
   - Image OCR
4. User fills in or edits recipe details
5. User uploads recipe image (optional)
6. User sets meal type and diet types
7. User saves the recipe to their collection

### Meal Planning Flow (Enhanced)
1. User navigates to Meal Planner
2. System auto-loads working plan from localStorage (if exists)
3. User sees Weekly Progress tracker showing completion status
4. User can navigate days via:
   - Clicking day cells in Weekly Progress
   - Arrow buttons in mobile view
   - Day indicator dots
5. User clicks on a meal slot (day + meal type)
6. User selects a recipe from filtered list
7. User adjusts servings if needed
8. User can add same recipe to multiple days
9. User continues until the meal plan is complete
10. User saves the meal plan with a name OR
11. User can "Clear Plan" to start fresh
12. Meal plan auto-saves to localStorage throughout process

### Shopping List Generation Flow (Enhanced)
1. User creates or loads a meal plan
2. User clicks "Generate Shopping List"
3. System aggregates all ingredients from the meal plan
4. System auto-categorizes ingredients
5. System combines duplicate ingredients
6. User views organized shopping list
7. User can add custom items
8. User marks items as purchased while shopping
9. User can save the shopping list with a name
10. Shopping list auto-saves to localStorage

### Health Journey Flow *(New)*
1. User navigates to Profile → Health Journey tab
2. User selects tracking type (Weight, Goals, Measurements, Photos)
3. User adds new entry:
   - Weight: Enter weight, date, notes
   - Goal: Set title, target, deadline
   - Measurement: Record measurements, date
   - Photo: Upload image, set type, privacy
4. User views progress charts and visualizations
5. User can edit or delete historical entries
6. Data syncs to Firestore for persistence

## Technical Implementation Details

### State Management
- **React Hooks**:
  - useState for local component state
  - useEffect for side effects and data fetching
  - useCallback for memoized callbacks
  - Custom hooks for reusable logic

- **LocalStorage Persistence**:
  - Working meal plan auto-saved on every change
  - Shopping list persistence
  - User preferences caching
  - Loaded on component mount

- **Firestore for Permanent Storage**:
  - Saved meal plans
  - Recipe collection
  - Saved shopping lists
  - Health journey data
  - User profiles

### Data Synchronization
- Firestore real-time listeners for live updates
- Async/await pattern for data fetching and updates
- Optimistic UI updates with rollback on error
- Loading states and error handling
- Debounced auto-save to prevent excessive writes

### Responsive Design
- **Mobile-First Approach**:
  - Breakpoints: 480px, 768px, 1024px, 1150px
  - Touch-optimized interactions
  - Swipe gestures for navigation
  - Bottom navigation for mobile

- **Adaptive Layouts**:
  - Desktop: Grid-based meal calendar
  - Mobile: Card-based day view
  - Tablet: Optimized hybrid layout

- **Design Consistency**:
  - CSS Modules for scoped styling
  - Shared design tokens
  - Consistent color palette
  - Neumorphic design elements

### Image Processing
- Firebase Storage for secure image uploads
- Client-side image compression
- URL generation for display
- Tesseract.js for OCR processing
- Progress indicators during upload

### Performance Optimizations
- Code splitting by route
- Lazy loading of heavy components
- Memoization of expensive calculations
- Virtual scrolling for large lists
- Debounced search inputs
- Optimized re-renders with React.memo

### Security
- Firebase Authentication for user management
- Row-level security rules in Firestore
- Secure image upload permissions
- Input sanitization and validation
- XSS protection
- CSRF prevention

## Mobile Experience

### Bottom Navigation
- Fixed navigation bar at bottom
- Icons for each main section:
  - Home
  - Recipe Book
  - Meal Planner
  - Shopping List
  - Profile
- Active state indication
- Smooth transitions

### Touch Interactions
- Swipe gestures for day navigation
- Pull-to-refresh on lists
- Touch-optimized buttons (min 44px)
- Long-press for additional options
- Haptic feedback (where supported)

### Mobile Optimizations
- Reduced data loading on cellular
- Progressive image loading
- Offline capability (via service worker)
- Install as PWA
- Push notifications support

## Future Enhancements

### Planned Features
1. **Social Features**:
   - Follow other users
   - Share meal plans publicly
   - Recipe comments and ratings
   - Community recipe collections

2. **AI Enhancements**:
   - Smart meal plan suggestions based on preferences
   - Nutritional balance optimization
   - Recipe recommendations
   - Ingredient substitution suggestions

3. **Nutrition Tracking**:
   - Calorie calculation per meal
   - Macronutrient breakdown
   - Vitamin and mineral tracking
   - Integration with fitness apps

4. **Inventory Management**:
   - Pantry tracking
   - Expiration date reminders
   - Smart shopping list (subtract what you have)
   - Barcode scanning

5. **Delivery Integration**:
   - Partner with grocery delivery services
   - One-click order from shopping list
   - Price comparison
   - Curbside pickup scheduling

6. **Gamification** (Detailed in GAMIFICATION_PLAN.md):
   - Achievement system
   - Streaks and challenges
   - Leaderboards
   - Reward points

7. **Coach Platform** (Detailed in COACH_PLATFORM_PLAN.md):
   - Professional coach accounts
   - Client management
   - Meal plan templates
   - Progress monitoring
   - Billing integration

## Documentation Files

- **ARCHITECTURE.md**: Detailed system architecture and component relationships
- **CODE_REVIEW.md**: Code quality standards and review checklist
- **FILE_REFERENCE.md**: Complete file structure and component index
- **HEALTH_JOURNEY_UX.md**: Detailed health tracking feature specifications
- **GAMIFICATION_PLAN.md**: Gamification system design
- **COACH_PLATFORM_PLAN.md**: Professional coach features roadmap
- **SECURITY_ASSESSMENT.md**: Security measures and best practices

## Deployment

### Production
- Hosted on Firebase Hosting
- CDN distribution globally
- HTTPS enforced
- Custom domain support
- Automatic SSL certificates

### CI/CD
- GitHub repository
- Development branch for features
- Main branch for production
- Automated builds via Firebase CLI
- Version tagging

### Monitoring
- Firebase Analytics for user behavior
- Performance monitoring
- Error tracking
- User feedback collection

## Support & Maintenance

### Version Control
- Git for source control
- Semantic versioning
- Changelog maintenance
- Release notes

### Updates
- Regular dependency updates
- Security patches
- Feature releases
- Bug fixes

### User Support
- In-app help documentation
- FAQ section
- Contact form
- Bug reporting

## Conclusion

The Meal Planner application provides a comprehensive solution for meal planning, recipe management, grocery shopping, and health tracking. Its modular architecture allows for easy maintenance and future enhancements, while its feature-rich interface provides users with a seamless experience for managing their culinary and wellness needs.

The recent additions of health journey tracking, persistent meal planning, and enhanced mobile UX demonstrate the application's commitment to providing a holistic health and nutrition management platform. The consistent design system and responsive layout ensure a delightful experience across all devices.

---

**Last Updated**: November 28, 2025
**Version**: 2.0.0
**Author**: Development Team
