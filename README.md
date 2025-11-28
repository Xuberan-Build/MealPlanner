# 🍽️ Meal Planner - Your Complete Nutrition & Wellness Platform

> A comprehensive web application for meal planning, recipe management, grocery shopping, and health tracking.

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

## 🌟 Features at a Glance

### 📖 Recipe Management
- **Smart Recipe Creation**: Manual entry, URL import, text parsing, or OCR from images
- **AI-Powered Parsing**: Automatic ingredient categorization and formatting
- **Custom Diet Types**: Create and save your own dietary categories
- **Recipe Sharing**: Share via public links or QR codes
- **Quick Actions**: Add recipes directly to meal planner from Recipe Book

### 📅 Meal Planning
- **Visual Weekly Calendar**: Desktop grid view and mobile card interface
- **Weekly Progress Tracker**: See completion status at a glance (0/4, 1/4, etc.)
- **Auto-Save**: Never lose your work - automatic localStorage persistence
- **Saved Plans**: Create, save, load, and edit multiple meal plans
- **Flexible Scheduling**: Add recipes to multiple days, adjust servings per meal
- **Synchronized Navigation**: Seamless day switching across all views

### 🛒 Shopping Lists
- **One-Click Generation**: Create lists from your meal plans instantly
- **Smart Aggregation**: Automatically combines duplicate ingredients
- **Category Organization**: Items grouped by grocery section
- **Persistent Lists**: Save multiple shopping lists for different needs
- **Mobile Optimized**: Touch-friendly checkboxes and bottom sheet UI

### 💪 Health Journey *(New!)*
- **Weight Tracking**: Log weight with visual progress charts and BMI calculation
- **Fitness Goals**: Create SMART goals with progress tracking and milestones
- **Body Measurements**: Track chest, waist, hips, and more with comparison charts
- **Progress Photos**: Upload before/after photos with privacy controls and galleries

### 👤 Profile & Preferences
- **Tabbed Interface**: Organized profile sections (Profile, Health Journey, Referrals)
- **Dietary Preferences**: Save your diet types, allergens, and food preferences
- **Customization**: Personalize your experience with custom settings

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- Firebase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Xuberan-Build/MealPlanner.git
   cd MealPlanner
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
   - Enable Firestore, Storage, and Authentication
   - Copy your Firebase config to `src/firebase.js`

4. **Run the development server**
   ```bash
   npm start
   ```

   Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

5. **Build for production**
   ```bash
   npm run build
   ```

6. **Deploy to Firebase**
   ```bash
   firebase deploy
   ```

## 📱 Mobile Experience

The Meal Planner is fully responsive with a mobile-first design:

- **Bottom Navigation**: Quick access to all main sections
- **Swipe Gestures**: Navigate days with natural swipe interactions
- **Bottom Sheets**: Contextual panels for saved items
- **Touch Optimized**: All buttons and interactions sized for fingers
- **PWA Ready**: Install on your device for app-like experience

### Mobile Features:
- Day-by-day meal cards instead of full week grid
- Bottom sheet saved plans panel
- Touch-friendly checkboxes for shopping lists
- Optimized image loading
- Offline capability (coming soon)

## 🎨 Design System

The application follows a consistent design language:

- **Sage (#B7C4B7)**: Primary actions and interactive elements
- **Dark Sage (#a5b2a5)**: Hover states and emphasis
- **Mist (#E8EFEA)**: Light backgrounds and borders
- **Soft White (#FAFAFA)**: Card backgrounds
- **Deep Charcoal (#2C2C2C)**: Primary text

## 🔐 Security & Privacy

- **Firebase Authentication**: Secure user accounts
- **Row-Level Security**: Firestore rules protect user data
- **Private Photo Storage**: Health photos stored securely
- **Input Sanitization**: Protection against XSS attacks
- **HTTPS Only**: All traffic encrypted

## 📚 Documentation

Comprehensive documentation available in the repository:

- **[Full Documentation](documentation.md)**: Complete feature and technical reference
- **[Architecture](docs/ARCHITECTURE.md)**: System design and component structure
- **[File Reference](docs/FILE_REFERENCE.md)**: Complete codebase index
- **[Health Journey UX](docs/HEALTH_JOURNEY_UX.md)**: Health feature specifications
- **[Security Assessment](docs/SECURITY_ASSESSMENT.md)**: Security measures and best practices

## 🛠️ Tech Stack

**Frontend:**
- React 18.3.1
- React Router
- CSS Modules
- Lucide React Icons

**Backend:**
- Firebase Firestore (Database)
- Firebase Storage (Media)
- Firebase Authentication
- Firebase Hosting

**AI & Processing:**
- OpenAI API
- LlamaAI
- Tesseract.js (OCR)

**Development:**
- Create React App
- ESLint
- Git & GitHub

## 📈 Key User Flows

### 1. Quick Meal Planning
```
Recipe Book → Select Recipe → Add to Meal Planner
→ Choose Days → Adjust Servings → Auto-Saved
→ Generate Shopping List → Shop!
```

### 2. Health Tracking
```
Profile → Health Journey Tab → Select Tracking Type
→ Log Entry (Weight/Goal/Measurement/Photo)
→ View Progress Charts → Set Goals
```

### 3. Recipe Import
```
Recipe Book → Add New → Import from URL/Text/Image
→ AI Parses & Formats → Review & Edit
→ Save to Collection → Use in Meal Plans
```

## 🔄 Persistent Data

The app uses multiple persistence layers:

**LocalStorage (Temporary):**
- Working meal plan (auto-saves on every change)
- Shopping list in progress
- User preferences
- Navigation state

**Firestore (Permanent):**
- Saved meal plans
- Recipe collection
- Saved shopping lists
- Health journey data
- User profiles

This dual approach ensures you never lose work while navigating between pages!

## 🎯 Upcoming Features

- [ ] Nutritional information calculation
- [ ] Meal plan templates
- [ ] Social recipe sharing
- [ ] Inventory/pantry management
- [ ] Barcode scanning for recipes
- [ ] Integration with fitness apps
- [ ] Coach platform for professionals
- [ ] Gamification with achievements

See [GAMIFICATION_PLAN.md](docs/GAMIFICATION_PLAN.md) and [COACH_PLATFORM_PLAN.md](docs/COACH_PLATFORM_PLAN.md) for details.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

Please ensure:
- Code follows existing style
- All tests pass
- Documentation is updated
- Commit messages are clear

## 📝 Changelog

### Version 2.0.0 (November 2025)
- ✨ Added comprehensive Health Journey tracking
- ✨ Implemented localStorage persistence for meal plans
- ✨ Added tabbed profile interface
- ✨ Enhanced mobile UX with bottom sheets
- ✨ Synchronized day navigation across all views
- ✨ Added Clear Plan functionality
- 🎨 Consistent design system implementation
- 📱 Improved responsive layouts

### Version 1.0.0 (Initial Release)
- 📖 Recipe management system
- 📅 Weekly meal planner
- 🛒 Shopping list generation
- 👤 User profiles
- 🔐 Firebase authentication

## 📞 Support

For questions, issues, or feature requests:

- **Issues**: [GitHub Issues](https://github.com/Xuberan-Build/MealPlanner/issues)
- **Documentation**: See documentation.md and `/docs` folder

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **Firebase** for backend infrastructure
- **React Team** for the amazing framework
- **OpenAI** for AI-powered features
- **Lucide** for beautiful icons
- **All contributors** who have helped shape this project

---

## Available Scripts

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

In the project directory, you can run:

### `npm start`

Runs the app in development mode at [http://localhost:3000](http://localhost:3000).
The page will reload when you make changes.

### `npm test`

Launches the test runner in interactive watch mode.
See [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.
It correctly bundles React in production mode and optimizes the build for the best performance.

### `firebase deploy`

Deploys the built application to Firebase Hosting.

---

**Built with ❤️ for healthier, easier meal planning**

*Last Updated: November 28, 2025 | Version 2.0.0*
