# Meal Planner Technical Documentation

## Project Architecture

The Meal Planner application follows a feature-based architecture pattern with React as the frontend framework and Firebase as the backend service. This document provides technical details about the implementation, code organization, and development guidelines.

## Directory Structure

```
MealPlanner/
├── public/                  # Static assets
├── src/
│   ├── components/          # Shared UI components
│   │   ├── layout/          # Layout components (Header, BottomNav, etc.)
│   │   └── ...
│   ├── features/            # Feature modules
│   │   ├── home/            # Home page feature
│   │   ├── mealPlanner/     # Meal planning feature
│   │   ├── profile/         # User profile feature
│   │   ├── recipeBook/      # Recipe management feature
│   │   └── shoppingList/    # Shopping list feature
│   ├── services/            # Service modules for data operations
│   │   ├── ocr/             # OCR processing services
│   │   ├── meal-planner-migration/ # Data migration utilities
│   │   └── ...
│   ├── utils/               # Utility functions
│   ├── App.js               # Main application component
│   ├── firebase.js          # Firebase configuration
│   └── index.js             # Application entry point
├── functions/               # Firebase Cloud Functions
├── scripts/                 # Utility scripts
└── ...
```

## Core Technologies

### Frontend
- **React**: v18.3.1
- **React Router**: v6.26.2 for routing
- **CSS Modules**: For component-scoped styling

### Backend
- **Firebase**:
  - Firestore: Document-based NoSQL database
  - Storage: For file storage (images)
  - Analytics: For usage tracking

### External APIs and Services
- **OpenAI API**: Used for natural language processing tasks
- **LlamaAI**: Alternative AI service for specific features
- **Tesseract.js**: OCR engine for extracting text from images

## Key Components and Services

### Firebase Integration (`firebase.js`)

The application uses Firebase for backend services. The configuration includes:
- Firestore for database operations
- Storage for file storage
- Analytics for usage tracking

```javascript
// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Initialize Firestore and export it
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
```

### Routing (`App.js`)

The application uses React Router for navigation between different features:

```javascript
<Router>
  <Routes>
    <Route path="/" element={<Home />} />
    <Route path="/recipe-book" element={<RecipeBook />} />
    <Route path="/meal-planner" element={<MealPlannerPage />} />
    <Route path="/shopping-list" element={<ShoppingListPage />} />
    <Route path="/profile" element={<ProfilePage />} />
  </Routes>
</Router>
```

### Feature: Meal Planner

The Meal Planner feature allows users to create weekly meal plans by assigning recipes to specific days and meal slots.

#### Key Components:
- **MealPlannerPage**: Main container component
- **WeeklyCalendar**: Displays the weekly meal plan
- **RecipeSelectionModal**: Modal for selecting recipes
- **SaveMealPlanModal**: Modal for saving meal plans
- **SavedMealPlans**: Displays saved meal plans

#### State Management:
```javascript
// State declarations
const [mealPlan, setMealPlan] = useState({});
const [isModalOpen, setIsModalOpen] = useState(false);
const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
const [savedMealPlans, setSavedMealPlans] = useState([]);
const [selectedMealSlot, setSelectedMealSlot] = useState({ day: '', meal: '' });
const [availableRecipes, setAvailableRecipes] = useState([]);
```

#### Data Flow:
1. Recipes are fetched from Firestore on component mount
2. User selects a meal slot (day + meal type)
3. Recipe selection modal opens
4. User selects a recipe
5. Meal plan state is updated
6. User can save the meal plan to Firestore

### Feature: Recipe Book

The Recipe Book feature allows users to manage their recipes, including creation, editing, and categorization.

#### Key Components:
- **RecipeBook**: Main container component
- **RecipeForm**: Form for creating and editing recipes
- **RecipeDetails**: Displays detailed recipe information
- **RecipeImageUploader**: Handles image uploads
- **IngredientSelector**: Component for managing recipe ingredients

#### Data Model:
```javascript
// Recipe data model
{
  id: string,
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
  instructions: string[],
  cookingTime: number,
  servings: number,
  mealType: string,
  dietType: string[],
  imageUrl: string,
  versions: [
    {
      versionId: string,
      timestamp: timestamp,
      changes: string
    }
  ]
}
```

### Feature: Shopping List

The Shopping List feature generates shopping lists based on meal plans.

#### Key Components:
- **ShoppingListPage**: Main container component
- **ShoppingListComponent**: Displays the shopping list
- **ShoppingItem**: Individual shopping list item

#### Implementation Details:
- Ingredients are aggregated from all recipes in the meal plan
- Similar ingredients are combined with quantities summed
- Ingredients are categorized for easier shopping
- Items can be marked as purchased

### Feature: User Profile

The Profile feature manages user information and preferences.

#### Key Components:
- **ProfilePage**: Main container component
- **UserInfoSection**: Manages user information
- **DietaryPreferencesSection**: Manages dietary preferences

#### Data Model:
```javascript
// User profile data model
{
  id: string,
  name: string,
  email: string,
  dietaryPreferences: string[],
  settings: {
    // Application settings
  }
}
```

### Services

#### Recipe Service (`recipeService.js`)
Handles CRUD operations for recipes:
- `getRecipes()`: Fetches all recipes
- `getRecipeById(id)`: Fetches a specific recipe
- `addRecipe(recipe)`: Creates a new recipe
- `updateRecipe(id, recipe)`: Updates an existing recipe
- `deleteRecipe(id)`: Deletes a recipe

#### Meal Plan Service (`mealPlanService.js`)
Manages meal plan operations:
- `saveMealPlanToFirestore(name, mealPlan)`: Saves a meal plan
- `loadMealPlansFromFirestore()`: Loads saved meal plans
- `deleteMealPlanFromFirestore(id)`: Deletes a meal plan

#### OCR Service (`ocrService.js`)
Handles OCR processing for recipe imports:
- Extracts text from images
- Parses ingredients, instructions, and other recipe details
- Normalizes extracted data

#### Profile Service (`profileService.js`)
Manages user profile operations:
- `getUserProfile()`: Fetches user profile
- `updateUserProfile(profile)`: Updates user profile
- `updateDietaryPreferences(preferences)`: Updates dietary preferences

### Utilities

#### Ingredient Categories (`ingredientCategories.js`)
Defines categories for ingredients to organize shopping lists.

#### Quantity Normalizer (`quantityNormalizer.js`)
Normalizes ingredient quantities and units for consistent representation.

## Data Flow

### Recipe Creation Flow
1. User inputs recipe details in RecipeForm
2. Form data is validated
3. If image is uploaded, it's processed by RecipeImageUploader
4. Recipe data is normalized by recipeNormalizer
5. Recipe is saved to Firestore via recipeService

### Meal Planning Flow
1. User selects a meal slot in WeeklyCalendar
2. RecipeSelectionModal displays available recipes
3. User selects a recipe
4. MealPlannerPage updates the mealPlan state
5. User saves the meal plan via mealPlanService

### Shopping List Generation Flow
1. MealPlannerPage passes mealPlan to ShoppingListPage
2. ShoppingListPage extracts ingredients from all recipes
3. Similar ingredients are aggregated
4. Ingredients are categorized
5. ShoppingListComponent displays the organized list

## Error Handling

The application implements error handling at various levels:
- Try/catch blocks for async operations
- Error logging to console
- User-friendly error messages
- Fallback UI for failed components

## Performance Considerations

- Firebase queries are optimized to fetch only necessary data
- Images are optimized before upload
- React components use memoization where appropriate
- Large lists implement virtualization for better performance

## Security

- Firebase Security Rules control access to Firestore and Storage
- Client-side validation is complemented by server-side validation
- API keys are properly secured

## Testing

The application uses Jest and React Testing Library for testing:
- Unit tests for utility functions
- Component tests for UI components
- Integration tests for feature workflows

## Deployment

The application is deployed using Firebase Hosting:
- Build process uses React Scripts
- Firebase CLI handles deployment
- Environment variables manage different environments (dev, staging, prod)

## Development Guidelines

### Code Style
- Follow ESLint configuration
- Use functional components with hooks
- Implement CSS Modules for styling
- Use descriptive variable and function names

### State Management
- Use React hooks for local state
- Lift state up when needed for sharing between components
- Use context for global state when appropriate
- Keep Firebase operations in service modules

### Component Design
- Follow single responsibility principle
- Create reusable components
- Use composition over inheritance
- Document component props with JSDoc comments

## Future Technical Enhancements

- Implement React Query for better data fetching and caching
- Add TypeScript for type safety
- Improve test coverage
- Implement CI/CD pipeline
- Add performance monitoring
- Enhance accessibility features