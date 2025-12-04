# Deployment Policy & Safeguards

## ⚠️ CRITICAL: Production Deployment Rules

### Golden Rules

1. **NEVER deploy to production automatically**
2. **ALWAYS require explicit human confirmation**
3. **ONLY deploy from main branch to production**
4. **ALWAYS test in dev environment first**
5. **NEVER bypass safeguards**

---

## Deployment Safeguards

### Safeguard 1: Separate Environments

```
Development (meal-planner-dev-141e2)
  ↓ Test here first
  ↓ Break things freely
  ↓ Rapid iteration

Production (meal-planner-v1-9be19)
  ↑ Deploy only when stable
  ↑ Beta users depend on this
  ↑ Requires confirmation
```

### Safeguard 2: Branch Requirements

| Environment | Required Branch | Reason |
|-------------|----------------|--------|
| Development | `dev` or `feature/*` | Active development |
| Production | `main` only | Stable, reviewed code |

**Production deployment script will REJECT deployments from non-main branches.**

### Safeguard 3: Explicit Confirmation

Production deployments require:
1. ✅ Confirmation prompt #1: "Are you sure?" (yes/no)
2. ✅ Confirmation prompt #2: Type "DEPLOY TO PRODUCTION"
3. ✅ Branch check: Must be on `main`
4. ✅ Clean working tree: No uncommitted changes

**You cannot accidentally deploy to production.**

### Safeguard 4: Warning Messages

All production commands display:
```
⚠️  WARNING: PRODUCTION DEPLOYMENT ⚠️
```

### Safeguard 5: Default Environment

Firebase CLI defaults to `dev` environment:
```bash
firebase use  # Shows: meal-planner-dev-141e2
```

---

## Deployment Commands

### Development (Safe - No Confirmation)

```bash
# Full deployment to dev
npm run deploy:dev

# Just hosting to dev
npm run deploy:hosting:dev

# Just rules to dev
npm run deploy:rules:dev
```

**These commands**:
- ✅ Run without confirmation
- ✅ Safe to use frequently
- ✅ Break things without affecting users

### Production (Protected - Requires Confirmation)

```bash
# Full deployment to production
npm run deploy:prod

# Just hosting to production
npm run deploy:hosting:prod

# Just rules to production
npm run deploy:rules:prod
```

**These commands**:
- ⚠️ Require explicit confirmation
- ⚠️ Check that you're on main branch
- ⚠️ Warn about production deployment
- ⚠️ Affect live beta users

---

## Production Deployment Workflow

### Prerequisites

- [ ] All changes tested in dev environment
- [ ] All tests passing
- [ ] Code reviewed (if working with team)
- [ ] Main branch is up to date
- [ ] No uncommitted changes

### Step-by-Step

```bash
# 1. Ensure you're on main and up to date
git checkout main
git pull origin main

# 2. Verify no uncommitted changes
git status

# 3. Check current Firebase environment
firebase use  # Should show dev

# 4. Run production deployment (with safeguards)
npm run deploy:prod

# You will see:
# ⚠️  WARNING: PRODUCTION DEPLOYMENT ⚠️
# Are you sure you want to deploy to PRODUCTION? (yes/no): yes
# Type "DEPLOY TO PRODUCTION" to confirm: DEPLOY TO PRODUCTION

# 5. Deployment proceeds
# 6. Verify at: https://meal-planner-v1-9be19.web.app
```

---

## What Happens When You Try to Deploy to Production

### From Dev Branch (BLOCKED)

```bash
$ npm run deploy:prod

❌ ERROR: Production deployments must be from main branch
   Current branch: dev

To deploy to production:
1. git checkout main
2. git pull origin main
3. npm run deploy:prod
```

### With Uncommitted Changes (BLOCKED)

```bash
$ npm run deploy:prod

❌ ERROR: You have uncommitted changes
   Commit or stash your changes before deploying
```

### Wrong Confirmation (BLOCKED)

```bash
$ npm run deploy:prod

Are you sure you want to deploy to PRODUCTION? (yes/no): yes
Type "DEPLOY TO PRODUCTION" to confirm: yes

❌ Confirmation failed. Deployment cancelled.
```

### Correct Process (ALLOWED)

```bash
$ npm run deploy:prod

⚠️  WARNING: PRODUCTION DEPLOYMENT ⚠️
Are you sure you want to deploy to PRODUCTION? (yes/no): yes
Type "DEPLOY TO PRODUCTION" to confirm: DEPLOY TO PRODUCTION

✅ Confirmation received. Starting production deployment...
📦 Building application...
🔄 Switching to production environment...
🚀 Deploying to production...
✅ Deployment Complete!
```

---

## Emergency Hotfix Process

For critical production bugs:

```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-bug

# 2. Fix the bug
# ... make changes ...
git commit -m "fix: critical production bug"

# 3. Test in dev first (if possible)
npm run deploy:dev
# Test at dev URL

# 4. Merge to main
git checkout main
git merge hotfix/critical-bug

# 5. Deploy to production with safeguards
npm run deploy:prod

# 6. Also merge to dev to keep in sync
git checkout dev
git merge hotfix/critical-bug
git push origin dev
```

---

## AI Agent Rules

### For AI Assistants (Claude, etc.)

**NEVER execute these commands without explicit user approval:**

- ❌ `npm run deploy:prod`
- ❌ `npm run deploy:hosting:prod`
- ❌ `npm run deploy:rules:prod`
- ❌ `firebase use production && firebase deploy`
- ❌ Any command that deploys to `meal-planner-v1-9be19`

**ALWAYS use these for development:**

- ✅ `npm run deploy:dev`
- ✅ `npm run deploy:hosting:dev`
- ✅ `npm run deploy:rules:dev`
- ✅ `firebase use dev`

**If user asks to deploy to production:**

1. Confirm the request explicitly
2. Verify they understand it affects live users
3. Check that main branch is the target
4. Use the safeguarded script (it will prompt for confirmation)

---

## Rollback Procedures

### If Production Deployment Goes Wrong

**Option 1: Firebase Hosting Rollback**
```bash
firebase use production
firebase hosting:rollback
```

**Option 2: Revert Commit and Redeploy**
```bash
git checkout main
git revert HEAD
npm run deploy:prod
```

**Option 3: Deploy Previous Known Good Commit**
```bash
git checkout main
git log --oneline -10  # Find good commit
git checkout <commit-hash>
npm run deploy:prod
# Then fix forward
```

---

## Monitoring After Production Deployment

### Check These Immediately

- [ ] Site loads: https://meal-planner-v1-9be19.web.app
- [ ] Login works
- [ ] Core features functional:
  - [ ] Recipe creation
  - [ ] Meal planning
  - [ ] Shopping list generation
- [ ] No console errors
- [ ] Firebase console: Check for errors

### Within 1 Hour

- [ ] Monitor Firebase console for errors
- [ ] Check user reports (if any)
- [ ] Verify database operations working
- [ ] Check Cloud Functions logs

---

## Testing Before Production

### Required Tests in Dev Environment

```bash
# 1. Deploy to dev
npm run deploy:dev

# 2. Test core workflows
# - User registration/login
# - Create recipe
# - Create meal plan
# - Generate shopping list
# - Save template
# - Product search

# 3. Check console for errors
# Open DevTools → Console

# 4. Test on mobile
# Use device or Chrome DevTools mobile mode

# 5. If all tests pass → proceed to production
```

---

## Environment Status Check

### Quick Check Commands

```bash
# What environment am I on?
firebase use

# What branch am I on?
git branch --show-current

# Any uncommitted changes?
git status

# Last production deployment?
firebase use production && firebase hosting:channel:list | grep live
```

---

## Security Considerations

### Never Deploy These to Production

- ❌ Debug code or console.logs with sensitive data
- ❌ Test accounts with weak passwords
- ❌ API keys in client-side code
- ❌ Unvalidated user input
- ❌ Disabled security rules
- ❌ Commented-out authentication checks

### Always Review Before Production

- ✅ Firestore security rules
- ✅ Function permissions
- ✅ API rate limits
- ✅ User input validation
- ✅ Error messages (don't leak info)

---

## Deployment Checklist

### Before Deploying to Production

- [ ] Tested thoroughly in dev environment
- [ ] All tests passing: `npm test`
- [ ] Build succeeds: `npm run build:prod`
- [ ] Code reviewed (if team)
- [ ] Breaking changes documented
- [ ] Database migrations completed (if any)
- [ ] Firestore rules updated (if needed)
- [ ] Main branch is up to date: `git pull origin main`
- [ ] Clean working tree: `git status`
- [ ] Correct branch: `git branch` shows `main`

### During Deployment

- [ ] Read all warnings carefully
- [ ] Confirm deployment explicitly
- [ ] Monitor deployment logs
- [ ] No errors in deployment output

### After Deployment

- [ ] Site loads correctly
- [ ] Core features work
- [ ] No console errors
- [ ] Mobile responsive
- [ ] Create git tag: `git tag -a v1.x.x -m "Release notes"`
- [ ] Push tag: `git push origin v1.x.x`
- [ ] Update changelog (if maintained)
- [ ] Notify team/users of changes

---

## Common Questions

### "Can I deploy to production from dev branch?"

**No.** The safeguard script will reject this. You must be on `main` branch.

### "Can I skip the confirmation prompts?"

**No.** This would defeat the purpose of safeguards. The prompts ensure intentional deployments.

### "What if I need to deploy quickly?"

Use the hotfix process. The confirmation prompts only take 10 seconds but prevent costly mistakes.

### "How do I know what's currently in production?"

```bash
git checkout main
git log -1  # Shows last commit on main
firebase use production
firebase hosting:channel:list  # Shows last deployment
```

### "Can the AI deploy to production for me?"

**No.** AI assistants are instructed to never deploy to production automatically. They will ask for explicit confirmation.

---

## Quick Reference

### Safe Commands (Use Freely)

```bash
npm run deploy:dev              # Deploy everything to dev
npm run deploy:hosting:dev      # Deploy hosting only to dev
npm run deploy:rules:dev        # Deploy rules only to dev
firebase use dev                # Switch to dev environment
```

### Protected Commands (Use Carefully)

```bash
npm run deploy:prod             # Requires confirmation
npm run deploy:hosting:prod     # Shows warning
npm run deploy:rules:prod       # Shows warning
firebase use production         # Switch to prod (then switch back!)
```

### Check Commands

```bash
firebase use                    # Current environment
git branch --show-current       # Current branch
git status                      # Working tree status
firebase hosting:channel:list   # Recent deployments
```

---

## Summary

**Development Environment**:
- 🟢 Deploy freely
- 🟢 Break things safely
- 🟢 No confirmation needed
- 🟢 Rapid iteration

**Production Environment**:
- 🔴 Requires explicit confirmation
- 🔴 Must be on main branch
- 🔴 Affects live beta users
- 🔴 Deploy only when stable

**Golden Rule**: When in doubt, deploy to dev first!

---

**These safeguards protect your users and prevent costly mistakes.** 🛡️
