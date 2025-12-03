# Git Branch Strategy & Firebase Environment Mapping

## Current Situation Analysis

### Branch Status (as of Dec 3, 2025)

| Branch | Last Commit | Date | Status | Description |
|--------|-------------|------|--------|-------------|
| **dev** | fe01e91 | Dec 3, 2025 | ✅ CURRENT | Active development, 68 commits ahead |
| master | 27bc0b8 | Apr 27, 2025 | ⚠️ OUTDATED | 7 months behind dev |
| feature | 27bc0b8 | Apr 27, 2025 | ⚠️ OUTDATED | Same as master, unused |
| dev-backup | 27bc0b8 | Apr 27, 2025 | ⚠️ OLD BACKUP | Can be deleted |
| master-backup | 12b4643 | Earlier | ⚠️ OLD BACKUP | Can be deleted |

### Problem Identified

1. **Production deployed from dev branch** - Non-standard workflow
2. **master branch is 68 commits behind** - Completely outdated
3. **Unused backup branches** - Cluttering repository
4. **No clear branch → environment mapping** - Confusion about what deploys where

---

## Recommended Branch Strategy

### Branch → Environment Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    GIT BRANCHES                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  main (production)                                          │
│  ├─ Protected branch                                        │
│  ├─ Requires PR approval                                    │
│  ├─ Deploys to: meal-planner-v1-9be19 (production)        │
│  └─ Users: Beta testers / production users                 │
│                                                             │
│  dev (development)                                          │
│  ├─ Active development                                      │
│  ├─ Feature branches merge here first                       │
│  ├─ Deploys to: meal-planner-dev-141e2 (development)      │
│  └─ Users: Developers only                                  │
│                                                             │
│  feature/* (feature branches)                               │
│  ├─ Short-lived branches                                    │
│  ├─ One feature per branch                                  │
│  ├─ Merge to dev when complete                             │
│  └─ Delete after merge                                      │
│                                                             │
│  hotfix/* (emergency fixes)                                 │
│  ├─ Branch from main                                        │
│  ├─ Critical production bugs only                           │
│  ├─ Merge to both main AND dev                             │
│  └─ Delete after merge                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Firebase Environment Mapping

```
Production Environment (meal-planner-v1-9be19)
  ↑
  │ Deploy via: npm run deploy:prod
  │
main branch (stable, production-ready code)

Development Environment (meal-planner-dev-141e2)
  ↑
  │ Deploy via: npm run deploy:dev
  │
dev branch (active development)
```

---

## Migration Plan

### Step 1: Update master to match current production

Since production is currently deployed from dev branch, and dev has all the latest work:

```bash
# Option A: Fast-forward master to dev (RECOMMENDED)
git checkout master
git merge dev --ff-only  # This will fail if there are conflicts
# OR
git reset --hard dev      # Force master to match dev exactly

git push origin master --force-with-lease
```

**Result**: master will be up-to-date with current production state

### Step 2: Rename master → main (industry standard)

```bash
# Rename local branch
git branch -m master main

# Delete old master on remote
git push origin --delete master

# Push new main branch
git push origin main

# Update remote tracking
git push origin -u main
```

### Step 3: Clean up old branches

```bash
# Delete old backup branches (local)
git branch -D dev-backup master-backup feature

# Delete old backup branches (remote)
git push origin --delete dev-backup
git push origin --delete master-backup
git push origin --delete feature
```

### Step 4: Update default branch on GitHub

1. Go to: https://github.com/Xuberan-Build/MealPlanner/settings
2. Navigate to "Branches" section
3. Change default branch from `master` to `main`
4. Set up branch protection rules

---

## Branch Protection Rules

### For `main` branch (production):

**Enable these protections**:
- ✅ Require a pull request before merging
- ✅ Require approvals (at least 1)
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- ✅ Include administrators (optional but recommended)

**Result**: Prevents accidental direct commits to production

### For `dev` branch (development):

**Enable these protections** (optional):
- ✅ Require linear history (prevents messy merge commits)
- ⚠️ Don't require PR approvals (allow direct commits for rapid development)

---

## Deployment Workflows

### Daily Development Workflow

```bash
# 1. Create feature branch from dev
git checkout dev
git pull origin dev
git checkout -b feature/shopping-list-enhancements

# 2. Develop and commit
git add .
git commit -m "feat: add shopping list templates"

# 3. Push feature branch
git push origin feature/shopping-list-enhancements

# 4. Merge to dev (locally or via PR)
git checkout dev
git merge feature/shopping-list-enhancements

# 5. Deploy to development environment
npm run deploy:dev

# 6. Test at https://meal-planner-dev-141e2.web.app

# 7. Clean up feature branch
git branch -d feature/shopping-list-enhancements
git push origin --delete feature/shopping-list-enhancements
```

### Production Release Workflow

```bash
# 1. Ensure dev is tested and stable
# Test thoroughly at https://meal-planner-dev-141e2.web.app

# 2. Create PR from dev to main
git checkout dev
git pull origin dev
# Go to GitHub and create PR: dev → main

# 3. Review and merge PR
# On GitHub, review changes and merge

# 4. Deploy to production
git checkout main
git pull origin main
npm run deploy:prod

# 5. Verify at https://meal-planner-v1-9be19.web.app

# 6. Tag release (optional but recommended)
git tag -a v1.3.0 -m "Release v1.3.0: Shopping list enhancements"
git push origin v1.3.0
```

### Hotfix Workflow (Emergency Production Fix)

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-auth-bug

# 2. Fix the bug
git add .
git commit -m "fix: resolve critical authentication bug"

# 3. Test locally
npm start

# 4. Merge to main
git checkout main
git merge hotfix/critical-auth-bug

# 5. Deploy to production immediately
npm run deploy:prod

# 6. Merge to dev (to keep branches in sync)
git checkout dev
git merge hotfix/critical-auth-bug
npm run deploy:dev

# 7. Clean up
git branch -d hotfix/critical-auth-bug
git push origin --delete hotfix/critical-auth-bug
```

---

## Branch Naming Conventions

### Feature Branches

```
feature/descriptive-name
feature/shopping-templates
feature/meal-plan-export
feature/recipe-import
```

### Bugfix Branches

```
bugfix/descriptive-name
bugfix/shopping-list-save
bugfix/recipe-image-upload
```

### Hotfix Branches (production emergencies)

```
hotfix/descriptive-name
hotfix/auth-login-error
hotfix/database-connection
```

### Experimental Branches

```
experiment/descriptive-name
experiment/ai-recipe-suggestions
experiment/voice-input
```

---

## Firebase Deployment Reference

### Check Current Environment

```bash
firebase use                          # Show current project
firebase projects:list                # List all projects
```

### Switch Environments

```bash
firebase use dev                      # Switch to development
firebase use production               # Switch to production
```

### Deployment Commands

```bash
# Full deployments
npm run deploy:dev                    # Build dev + deploy all services
npm run deploy:prod                   # Build prod + deploy all services

# Hosting only (faster for frontend-only changes)
npm run deploy:hosting:dev            # Deploy only hosting to dev
npm run deploy:hosting:prod           # Deploy only hosting to prod

# Rules only (instant)
npm run deploy:rules:dev              # Deploy Firestore rules to dev
npm run deploy:rules:prod             # Deploy Firestore rules to prod
```

---

## Migration Commands (Execute in Order)

### Complete Branch Cleanup & Reorganization

```bash
# Step 1: Ensure you're on dev and it's up to date
git checkout dev
git pull origin dev

# Step 2: Update master to match dev
git checkout master
git reset --hard dev
git push origin master --force-with-lease

# Step 3: Rename master to main
git branch -m master main
git push origin --delete master
git push origin main
git push origin -u main

# Step 4: Delete backup branches locally
git branch -D dev-backup master-backup feature

# Step 5: Delete backup branches remotely
git push origin --delete dev-backup
git push origin --delete master-backup
git push origin --delete feature

# Step 6: Switch back to dev
git checkout dev

# Step 7: Update local branch tracking
git fetch --prune
git remote prune origin

# Step 8: Verify branch structure
git branch -a
```

**Expected result**:
```
* dev
  main
  remotes/origin/dev
  remotes/origin/main
```

---

## GitHub Settings Updates

After running migration commands:

1. **Update Default Branch**
   - Repo Settings → Branches → Default branch → Change to `main`

2. **Set Branch Protection Rules**
   - Repo Settings → Branches → Add rule for `main`
   - Enable: Require PR, Require approvals

3. **Update README badges** (if any)
   - Change references from `master` to `main`

4. **Update documentation links**
   - Update any hardcoded branch references in docs

---

## Rollback Procedures

### Rollback Production Deployment

```bash
# Option 1: Firebase hosting rollback
firebase use production
firebase hosting:rollback

# Option 2: Revert to specific commit
git checkout main
git log --oneline -5                  # Find commit hash
git revert <commit-hash>              # Create revert commit
npm run deploy:prod
```

### Rollback Dev Deployment

```bash
# Just redeploy previous commit
git checkout dev
git reset --hard HEAD~1               # Go back one commit
npm run deploy:dev
git reset --hard origin/dev           # Restore to remote state
```

---

## Best Practices

### ✅ DO

- ✅ Always work on feature branches
- ✅ Keep commits small and focused
- ✅ Write descriptive commit messages
- ✅ Test in dev before merging to main
- ✅ Use `npm run deploy:dev` for testing
- ✅ Create PRs for main branch merges
- ✅ Tag releases with version numbers
- ✅ Delete feature branches after merge

### ❌ DON'T

- ❌ Don't commit directly to main
- ❌ Don't deploy to production from dev branch
- ❌ Don't mix multiple features in one branch
- ❌ Don't forget to pull before creating branches
- ❌ Don't leave stale feature branches
- ❌ Don't push broken code to dev
- ❌ Don't skip testing in dev environment

---

## Quick Reference Card

### Most Common Commands

```bash
# Start new feature
git checkout dev && git pull && git checkout -b feature/my-feature

# Deploy to dev for testing
npm run deploy:dev

# Merge feature to dev
git checkout dev && git merge feature/my-feature

# Create production release
# 1. Create PR: dev → main on GitHub
# 2. After merge: git checkout main && git pull && npm run deploy:prod

# Check which environment you're on
firebase use

# Switch environments
firebase use dev         # or 'production'
```

---

## Environment URLs

| Environment | Branch | Firebase Project | URL |
|-------------|--------|------------------|-----|
| **Development** | `dev` | meal-planner-dev-141e2 | https://meal-planner-dev-141e2.web.app |
| **Production** | `main` | meal-planner-v1-9be19 | https://meal-planner-v1-9be19.web.app |

---

## Current Status

- ✅ Firebase environments configured (dev + production)
- ✅ Deployment scripts created (npm run deploy:dev/prod)
- ✅ Migration scripts created (Firestore data)
- ⚠️ Branch cleanup needed (master outdated, backups exist)
- ⚠️ Branch protection rules needed (main branch)
- ⚠️ Default branch should be changed to main

**Next Action**: Execute migration commands to clean up branches
