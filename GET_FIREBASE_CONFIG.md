# Get Firebase Configuration for Development Environment

## Quick Start - Get Your Firebase Config

### Step 1: Open Firebase Console
Go to: https://console.firebase.google.com/project/meal-planner-dev-141e2/settings/general

### Step 2: Find Your Web App Config

**Option A: If you already have a web app registered:**
1. Scroll down to "Your apps" section
2. Find your web app (looks like `</>` icon)
3. Click "Config" or the settings gear icon
4. You'll see a code snippet like this:

```javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "meal-planner-dev-141e2.firebaseapp.com",
  projectId: "meal-planner-dev-141e2",
  storageBucket: "meal-planner-dev-141e2.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXXXXX"
};
```

**Option B: If no web app exists yet:**
1. Scroll to "Your apps" section
2. Click "Add app" button
3. Select the Web icon (`</>`)
4. Give it a nickname: "Meal Planner Dev Web"
5. Check "Also set up Firebase Hosting" (optional)
6. Click "Register app"
7. Copy the configuration object shown

### Step 3: Update `.env.development`

Open `.env.development` in your project and replace the placeholder values:

```bash
REACT_APP_FIREBASE_API_KEY=<your apiKey here>
REACT_APP_FIREBASE_AUTH_DOMAIN=meal-planner-dev-141e2.firebaseapp.com
REACT_APP_FIREBASE_DATABASE_URL=https://meal-planner-dev-141e2.firebaseio.com
REACT_APP_FIREBASE_PROJECT_ID=meal-planner-dev-141e2
REACT_APP_FIREBASE_STORAGE_BUCKET=meal-planner-dev-141e2.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=<your messagingSenderId here>
REACT_APP_FIREBASE_APP_ID=<your appId here>
REACT_APP_FIREBASE_MEASUREMENT_ID=<your measurementId here>
```

**Values that don't change** (already filled in):
- ✅ `REACT_APP_FIREBASE_AUTH_DOMAIN`
- ✅ `REACT_APP_FIREBASE_PROJECT_ID`
- ✅ `REACT_APP_FIREBASE_STORAGE_BUCKET`
- ✅ `REACT_APP_FIREBASE_DATABASE_URL`

**Values you need to copy from Firebase Console**:
- 🔑 `REACT_APP_FIREBASE_API_KEY`
- 🔑 `REACT_APP_FIREBASE_MESSAGING_SENDER_ID`
- 🔑 `REACT_APP_FIREBASE_APP_ID`
- 🔑 `REACT_APP_FIREBASE_MEASUREMENT_ID`

### Step 4: Verify Setup

Run this command to check your environment is configured:
```bash
cat .env.development | grep "YOUR_"
```

If you see any lines with `YOUR_`, those values still need to be filled in.

---

## Alternative: Use Firebase CLI

You can also get the config using Firebase CLI:

```bash
firebase apps:sdkconfig WEB
```

This will output the configuration. Copy the values to `.env.development`.

---

## Next Steps After Config is Set

Once `.env.development` is properly configured with real values, you can test the dev deployment:

```bash
# Deploy everything to dev environment
npm run deploy:dev

# Or deploy only hosting (faster for frontend-only changes)
npm run deploy:hosting:dev

# Or deploy only Firestore rules
npm run deploy:rules:dev
```

---

## Troubleshooting

### "No web app found"
Create a web app in Firebase Console → Project Settings → Your apps → Add app → Web

### "Invalid API key"
Make sure you copied the full API key without any spaces or line breaks

### "Permission denied"
Run `firebase login` to authenticate with your Firebase account

### "Project not found"
Verify the project ID in `.firebaserc` matches your Firebase Console project ID: `meal-planner-dev-141e2`
