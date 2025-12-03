# Deployment Guide: Dev/Production Environment Setup

## Current Issues Identified

### 1. Auth Permission Error ✅ FIXED
- **Issue**: Firestore rules were blocking `lastLogin` updates
- **Fix**: Updated rules to allow login tracking fields (deployed)
- **Status**: Resolved - users can now log in without errors

### 2. Long Load Time (Performance Issue)
- **Issue**: Main JavaScript bundle is 940KB (uncompressed)
- **Impact**: Slow initial load, especially after clearing cache
- **Status**: Needs optimization (see Performance Optimization section below)

### 3. Single Environment
- **Issue**: Only one Firebase project - all changes go to production
- **Impact**: Beta users see experimental features and potential bugs
- **Fix**: Multiple environment setup (instructions below)

---

## Multi-Environment Setup

### Architecture

```
Production Environment:
- Firebase Project: meal-planner-v1-9be19
- URL: https://meal-planner-v1-9be19.web.app
- Branch: main
- Users: Beta testers / production users

Development Environment:
- Firebase Project: meal-planner-dev (needs to be created)
- URL: https://meal-planner-dev.web.app
- Branch: dev
- Users: Developers only
```

### Step 1: Create Development Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name it: `meal-planner-dev`
4. Enable Google Analytics (optional)
5. Create project

### Step 2: Configure Development Project

**Enable Required Services**:
- ✅ Authentication → Enable Email/Password
- ✅ Firestore Database → Create database (start in test mode, we'll deploy rules)
- ✅ Storage → Enable for recipe images
- ✅ Hosting → Enable
- ✅ Functions → Enable (if using Cloud Functions)

**Copy Firebase Configuration**:
1. Go to Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy the configuration object

### Step 3: Create Environment Files

**`.env.production`** (already exists as `.env` - rename it):
```bash
# Firebase Configuration - PRODUCTION
REACT_APP_FIREBASE_API_KEY=your_production_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=meal-planner-v1-9be19.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=your_production_database_url
REACT_APP_FIREBASE_PROJECT_ID=meal-planner-v1-9be19
REACT_APP_FIREBASE_STORAGE_BUCKET=meal-planner-v1-9be19.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

**`.env.development`** (create new):
```bash
# Firebase Configuration - DEVELOPMENT
REACT_APP_FIREBASE_API_KEY=your_dev_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=meal-planner-dev.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=your_dev_database_url
REACT_APP_FIREBASE_PROJECT_ID=meal-planner-dev
REACT_APP_FIREBASE_STORAGE_BUCKET=meal-planner-dev.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_dev_sender_id
REACT_APP_FIREBASE_APP_ID=your_dev_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_dev_measurement_id
```

**`.env.local`** (for local development - create if needed):
```bash
# Use development config for local development
REACT_APP_FIREBASE_API_KEY=your_dev_api_key
# ... same as .env.development
```

### Step 4: Update `.firebaserc`

Already updated to support multiple projects:
```json
{
  "projects": {
    "default": "meal-planner-v1-9be19",
    "production": "meal-planner-v1-9be19",
    "dev": "meal-planner-dev"
  }
}
```

### Step 5: Update `package.json` Scripts

Add environment-specific build and deploy scripts:

```json
{
  "scripts": {
    "start": "react-scripts start",
    "start:dev": "REACT_APP_ENV=development react-scripts start",

    "build": "react-scripts build",
    "build:dev": "env-cmd -f .env.development react-scripts build",
    "build:prod": "env-cmd -f .env.production react-scripts build",

    "test": "react-scripts test",
    "eject": "react-scripts eject",

    "deploy:dev": "npm run build:dev && firebase use dev && firebase deploy",
    "deploy:prod": "npm run build:prod && firebase use production && firebase deploy",
    "deploy:rules": "firebase deploy --only firestore:rules",
    "deploy:rules:dev": "firebase use dev && firebase deploy --only firestore:rules",
    "deploy:rules:prod": "firebase use production && firebase deploy --only firestore:rules"
  }
}
```

**Install required package**:
```bash
npm install --save-dev env-cmd
```

---

## Deployment Workflows

### Development Workflow (Feature Development)

```bash
# 1. Work on dev branch
git checkout dev

# 2. Make changes and test locally
npm start

# 3. Build and deploy to dev environment
npm run deploy:dev

# 4. Test on dev environment
# Visit: https://meal-planner-dev.web.app

# 5. If everything works, commit
git add .
git commit -m "feat: add new feature"
git push origin dev
```

### Production Deployment (Stable Release)

```bash
# 1. Merge dev to main
git checkout main
git merge dev

# 2. Build and deploy to production
npm run deploy:prod

# 3. Tag release (optional)
git tag -a v1.2.0 -m "Release v1.2.0"
git push origin v1.2.0

# 4. Push to main
git push origin main
```

### Quick Rules Update

```bash
# Deploy only Firestore rules (fast)
npm run deploy:rules:dev   # for development
npm run deploy:rules:prod  # for production
```

---

## Performance Optimization

### Current Bundle Size Issue

**Problem**: Main bundle is 940KB, causing slow load times.

**Immediate Fixes**:

#### 1. Enable Code Splitting

Create `src/utils/lazyLoad.js`:
```javascript
import { lazy } from 'react';

export const lazyLoad = (importFunc) => {
  return lazy(() =>
    importFunc().catch(() => {
      window.location.reload();
      return { default: () => null };
    })
  );
};
```

Update route imports in `App.js`:
```javascript
// Instead of:
import RecipePage from './features/recipes/RecipePage';
import MealPlannerPage from './features/mealPlanner/MealPlannerPage';

// Use:
const RecipePage = lazyLoad(() => import('./features/recipes/RecipePage'));
const MealPlannerPage = lazyLoad(() => import('./features/mealPlanner/MealPlannerPage'));
```

**Expected Savings**: 200-300KB from main bundle

#### 2. Optimize Dependencies

```bash
# Analyze bundle size
npm install --save-dev webpack-bundle-analyzer
npm run build
npx webpack-bundle-analyzer build/static/js/*.js
```

**Common Optimizations**:
- Use `lodash-es` and import specific functions: `import debounce from 'lodash-es/debounce'`
- Replace heavy libraries with lighter alternatives
- Remove unused dependencies

#### 3. Enable Compression

Add to `firebase.json`:
```json
{
  "hosting": {
    "public": "build",
    "headers": [
      {
        "source": "**/*.@(js|css)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      },
      {
        "source": "**/*.@(jpg|jpeg|gif|png|svg|webp)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "public, max-age=31536000, immutable"
          }
        ]
      }
    ]
  }
}
```

**Expected Impact**: 60-70% size reduction via gzip/brotli

#### 4. Progressive Web App (PWA) Setup

Enable service worker for offline caching:

Update `src/index.js`:
```javascript
import * as serviceWorkerRegistration from './serviceWorkerRegistration';

// Enable service worker
serviceWorkerRegistration.register();
```

**Impact**: Instant load on repeat visits

---

## Git Branch Strategy

### Branch Structure

```
main (production)
  └─ Latest stable release
  └─ Protected branch (require PR reviews)

dev (development)
  └─ Active development
  └─ Merge features here first

feature/* (feature branches)
  └─ Individual features
  └─ Merge to dev when complete
```

### Recommended Workflow

1. **New Feature**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/shopping-list-templates
   # ... work on feature ...
   git push origin feature/shopping-list-templates
   # Create PR to dev
   ```

2. **Bug Fix**:
   ```bash
   git checkout dev
   git checkout -b fix/auth-permission-error
   # ... fix bug ...
   git push origin fix/auth-permission-error
   # Create PR to dev
   ```

3. **Hotfix (Production)**:
   ```bash
   git checkout main
   git checkout -b hotfix/critical-bug
   # ... fix critical bug ...
   git push origin hotfix/critical-bug
   # Create PR to main
   # After merge, also merge to dev
   ```

---

## Monitoring & Testing

### Before Production Deployment

**Checklist**:
- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build:prod`
- [ ] No console errors in dev environment
- [ ] Core user flows tested:
  - [ ] User registration/login
  - [ ] Recipe creation
  - [ ] Meal planning
  - [ ] Shopping list generation
  - [ ] Shopping list templates (new feature)
- [ ] Performance check: Lighthouse score > 80
- [ ] Mobile responsive (test on real device)

### Post-Deployment Monitoring

**Firebase Console**:
- Check Error Reporting for crashes
- Monitor Authentication activity
- Check Firestore usage/costs
- Review Functions logs (if applicable)

**User Feedback**:
- Monitor support channels
- Check for reported bugs
- Gather feature feedback

---

## Rollback Procedure

If production deployment causes issues:

```bash
# 1. Quick rollback to previous hosting version
firebase hosting:rollback

# 2. Or deploy previous commit
git checkout <previous-commit-hash>
npm run deploy:prod

# 3. Then fix issue and redeploy
git checkout main
# ... fix issue ...
npm run deploy:prod
```

---

## Cost Management

### Development Environment
- Lower quotas to prevent unexpected costs
- Use test data, not production data
- Delete old test data regularly

### Production Environment
- Monitor Firestore reads/writes
- Optimize queries (use indexes)
- Set budget alerts in Firebase Console
- Review costs monthly

---

## Security Checklist

- [ ] Firestore rules tested and restrictive
- [ ] API keys for backend services in Functions (not client)
- [ ] `.env` files in `.gitignore`
- [ ] User authentication required for all operations
- [ ] Input validation on all user data
- [ ] Rate limiting on expensive operations
- [ ] CORS configured properly
- [ ] Regular security audits

---

## Quick Reference

### Common Commands

```bash
# Local development
npm start                    # Start dev server (uses .env.local or .env.development)

# Build
npm run build:dev           # Build for development environment
npm run build:prod          # Build for production environment

# Deploy
npm run deploy:dev          # Deploy to development
npm run deploy:prod         # Deploy to production
npm run deploy:rules        # Deploy only Firestore rules (uses current project)

# Switch Firebase projects
firebase use dev            # Switch to development project
firebase use production     # Switch to production project
firebase use default        # Switch to default project

# Check current project
firebase projects:list      # List all projects
firebase use               # Show current project
```

### Environment URLs

- **Production**: https://meal-planner-v1-9be19.web.app
- **Development**: https://meal-planner-dev.web.app (after setup)
- **Local**: http://localhost:3000

---

## Next Steps

1. **Immediate**:
   - [x] Fix auth permission error (completed)
   - [ ] Create development Firebase project
   - [ ] Set up `.env.development` file
   - [ ] Install `env-cmd`: `npm install --save-dev env-cmd`
   - [ ] Update `package.json` scripts

2. **Short-term** (This Week):
   - [ ] Implement code splitting for performance
   - [ ] Test deployment workflow (dev → prod)
   - [ ] Set up branch protection on main

3. **Medium-term** (This Month):
   - [ ] Optimize bundle size (target < 500KB)
   - [ ] Enable PWA/service worker
   - [ ] Set up automated testing
   - [ ] Configure CI/CD pipeline (GitHub Actions)

4. **Long-term** (Next Quarter):
   - [ ] Implement monitoring/alerting
   - [ ] Set up staging environment (optional third env)
   - [ ] Performance budgeting
   - [ ] A/B testing infrastructure
