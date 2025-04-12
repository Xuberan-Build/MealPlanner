# Meal Planner Application Documentation

## Overview

The Meal Planner is a comprehensive web application designed to simplify meal planning, recipe management, and grocery shopping. It allows users to create and manage recipes, plan meals for the week, generate shopping lists based on meal plans, and maintain user profiles with dietary preferences.

## Tech Stack

### Frontend
- **React**: The application is built using React (v18.3.1) for the UI components and state management
- **React Router**: Used for navigation and routing between different sections of the application
- **CSS Modules**: Used for component-specific styling

### Backend & Data Storage
- **Firebase**: 
  - Firestore: NoSQL database for storing recipes, meal plans, user profiles, and shopping lists
  - Firebase Storage: For storing recipe images and other media
  - Firebase Analytics: For tracking user interactions and application usage

### External Services & Libraries
- **OpenAI & LlamaAI**: Integration for AI-powered features
- **Tesseract.js**: OCR (Optical Character Recognition) for extracting recipe information from images
- **PapaParse**: For CSV import/export functionality
- **FontAwesome & Lucide**: Icon libraries for the UI

## Application Structure

The application follows a feature-based architecture, with the codebase organized into the following main directories:

- **src/features/**: Contains feature-specific components and logic
  - **mealPlanner/**: Meal planning functionality
  - **recipeBook/**: Recipe management
  - **shoppingList/**: Shopping list generation and management
  - **profile/**: User profile management
  - **home/**: Home page components
- **src/components/**: Shared UI components
- **src/services/**: Service modules for data operations
- **src/utils/**: Utility functions and helpers

## Key Features

### 1. Recipe Management

The Recipe Book feature allows users to:
- Create, view, edit, and delete recipes
- Import recipes from various sources (URL, text, images via OCR)
- Export recipes in CSV format
- Categorize recipes by meal type and dietary preferences
- Upload and manage recipe images
- Track recipe versions and modifications

### 2. Meal Planning

The Meal Planner feature enables users to:
- Create weekly meal plans by assigning recipes to specific days and meal slots
- Save and load meal plans
- View a weekly calendar of planned meals
- Select recipes from their recipe book for each meal slot
- Generate shopping lists based on the current meal plan

### 3. Shopping List Generation

The Shopping List feature allows users to:
- Generate shopping lists based on ingredients from the meal plan
- Organize ingredients by category
- Mark items as purchased
- Add custom items to the list
- View aggregated quantities for repeated ingredients

### 4. User Profile Management

The Profile feature enables users to:
- Manage personal information
- Set dietary preferences and restrictions
- Customize application settings

### 5. OCR Recipe Import

The application includes an advanced OCR feature that:
- Extracts recipe information from images
- Parses ingredients, instructions, servings, and cooking times
- Normalizes ingredient quantities and measurements
- Categorizes ingredients automatically

## Data Models

### Recipe
- Title
- Description
- Ingredients (with quantities, units, and categories)
- Instructions (step-by-step)
- Cooking time
- Servings
- Meal type (breakfast, lunch, dinner, etc.)
- Dietary type (vegetarian, vegan, gluten-free, etc.)
- Image URL
- Version information

### Meal Plan
- Name
- Date created
- Daily meal assignments (breakfast, lunch, dinner for each day)
- Associated recipes

### Shopping List
- Generated date
- Source meal plan
- Items (with quantities, units, categories, and purchase status)

### User Profile
- Personal information
- Dietary preferences
- Application settings

## User Flows

### Recipe Creation Flow
1. User navigates to Recipe Book
2. User selects "Add New Recipe"
3. User fills in recipe details or imports from external source
4. User uploads recipe image (optional)
5. User saves the recipe to their collection

### Meal Planning Flow
1. User navigates to Meal Planner
2. User clicks on a meal slot (day + meal type)
3. User selects a recipe from their recipe book
4. User continues until the meal plan is complete
5. User saves the meal plan with a name

### Shopping List Generation Flow
1. User creates or loads a meal plan
2. User clicks "Generate Shopping List"
3. System aggregates all ingredients from the meal plan
4. User views and manages the shopping list
5. User marks items as purchased as they shop

## Technical Implementation Details

### State Management
- React's useState and useEffect hooks for local component state
- Props for passing data between parent and child components
- Firestore for persistent data storage

### Data Synchronization
- Firestore listeners for real-time updates
- Async/await pattern for data fetching and updates

### Image Processing
- Firebase Storage for image uploads and URL generation
- Tesseract.js for OCR processing of recipe images

### Responsive Design
- CSS Modules for component-specific styling
- Mobile-first approach with responsive layouts

## Future Enhancements

Potential areas for future development include:
- Enhanced AI-powered recipe suggestions based on dietary preferences
- Meal plan optimization for nutritional balance
- Inventory management to track pantry items
- Social features for sharing recipes and meal plans
- Integration with grocery delivery services
- Nutritional information calculation for recipes and meal plans

## Conclusion

The Meal Planner application provides a comprehensive solution for meal planning, recipe management, and grocery shopping. Its modular architecture allows for easy maintenance and future enhancements, while its feature-rich interface provides users with a seamless experience for managing their culinary needs.