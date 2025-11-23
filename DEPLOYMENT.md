# Deployment Documentation

## Firebase Hosting Setup

This project is deployed on Firebase Hosting at: https://meal-planner-v1-9be19.web.app/

---

## 🔒 CRITICAL: Security Setup (First Time Only)

### Step 1: Rotate Your OpenAI API Key

**IMPORTANT:** The OpenAI API key in your repository was exposed and should be rotated immediately.

1. Go to https://platform.openai.com/api-keys
2. Find the exposed key (starts with `sk-proj-TEg0Anj...`)
3. Click the trash icon to **delete** it
4. Click "Create new secret key"
5. Give it a name like "MealPlanner-Production"
6. Copy the new key (you'll need it in Step 2)

### Step 2: Set Up OpenAI API Key in Firebase Functions

The OpenAI API key is now stored securely in Firebase Functions as a secret (not in your code).

1. Install Firebase CLI if you haven't already:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Navigate to the functions directory:
   ```bash
   cd functions
   ```

4. Set the OpenAI API key as a secret:
   ```bash
   firebase functions:secrets:set OPENAI_API_KEY
   ```

   When prompted, paste your new OpenAI API key from Step 1.

5. Navigate back to the root directory:
   ```bash
   cd ..
   ```

### Step 3: Remove .env from Git History

Your `.env` file was previously committed to the repository. Remove it from git history:

```bash
# Remove .env from all commits
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remote (WARNING: This rewrites history)
git push origin --force --all
```

**Alternative (safer):** If you have collaborators, use BFG Repo-Cleaner instead:
```bash
# Install BFG Repo-Cleaner
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Clean the repository
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push origin --force --all
```

---

## Deployment Steps

### Deploy Functions and Hosting Together

1. Build the React application:
   ```bash
   CI=false npm run build
   ```

2. Deploy both functions and hosting:
   ```bash
   firebase deploy
   ```

### Deploy Only Functions

```bash
firebase deploy --only functions
```

### Deploy Only Hosting

```bash
firebase deploy --only hosting
```

---

## Environment Variables

### Client-Side (.env)

These are **safe to expose** in client-side code (they're public):
- `REACT_APP_FIREBASE_API_KEY`
- `REACT_APP_FIREBASE_AUTH_DOMAIN`
- `REACT_APP_FIREBASE_PROJECT_ID`
- etc.

### Server-Side (Firebase Functions Secrets)

These must **NEVER** be in client-side code:
- `OPENAI_API_KEY` (stored in Firebase Functions secrets)

To view current secrets:
```bash
firebase functions:secrets:access OPENAI_API_KEY
```

To update a secret:
```bash
firebase functions:secrets:set OPENAI_API_KEY
```

---

## Troubleshooting

### Functions Not Working After Deployment

1. Check function logs:
   ```bash
   firebase functions:log
   ```

2. Verify the secret is set:
   ```bash
   firebase functions:secrets:access OPENAI_API_KEY
   ```

3. Ensure functions have been deployed:
   ```bash
   firebase deploy --only functions
   ```

### CORS Errors

If you get CORS errors when calling Cloud Functions, ensure the function has `cors: true` in its configuration (already set in `functions/index.js`).

---

## Production Checklist

Before deploying to production, verify:

- [ ] OpenAI API key has been rotated
- [ ] New API key is stored in Firebase Functions secrets
- [ ] `.env` file is in `.gitignore`
- [ ] `.env` removed from git history
- [ ] Firestore security rules are updated (see separate security fixes)
- [ ] Functions have been deployed with secrets
- [ ] Testing the URL import feature works with new setup