# MealPlanner Gamification System - Implementation Plan

**Date:** November 27, 2025
**Purpose:** Transform the Profile page into a central gamification hub to drive engagement, sharing, and health journey tracking

---

## 🎯 Gamification Objectives

1. **Increase Engagement** - Motivate users to actively use app features
2. **Promote Sharing** - Encourage recipe sharing and friend invitations
3. **Track Health Journey** - Help users monitor progress towards health goals
4. **Build Habits** - Reward consistent app usage and healthy behaviors
5. **Create Community** - Foster social connections through leaderboards and challenges

---

## 🏗️ System Architecture

### Core Components

```
ProfilePage (Enhanced)
├── GamificationDashboard (NEW)
│   ├── UserLevelCard
│   ├── XPProgressBar
│   ├── StreakTracker
│   └── QuickStats
│
├── AchievementsSection (NEW)
│   ├── BadgeGrid
│   ├── RecentUnlocks
│   └── ProgressToNext
│
├── HealthJourneySection (NEW)
│   ├── WeightTracker
│   ├── MeasurementsLog
│   ├── ProgressPhotos
│   ├── GoalsCard
│   └── MilestonesTimeline
│
├── ChallengesSection (NEW)
│   ├── ActiveChallenges
│   ├── AvailableChallenges
│   └── CompletedChallenges
│
├── SocialSection (Enhanced)
│   ├── ReferralStats
│   ├── LeaderboardPreview
│   └── FriendActivity
│
└── Existing Sections
    ├── UserInfoSection
    └── DietaryPreferencesSection
```

---

## 📊 Data Models

### User Gamification Profile

```javascript
{
  userId: "string",

  // XP & Levels
  experience: {
    totalXP: 0,
    currentLevel: 1,
    xpToNextLevel: 100,
    xpHistory: [
      { date: timestamp, xp: 50, action: "recipe_added", description: "..." }
    ]
  },

  // Achievements
  achievements: {
    unlocked: ["first_recipe", "meal_plan_master", ...],
    progress: {
      "recipe_collector": { current: 15, target: 50, percentage: 30 },
      "social_butterfly": { current: 3, target: 10, percentage: 30 }
    },
    lastUnlocked: { badge: "...", date: timestamp }
  },

  // Streaks
  streaks: {
    current: 7,
    longest: 21,
    lastActiveDate: timestamp,
    history: [
      { startDate: timestamp, endDate: timestamp, days: 14 }
    ]
  },

  // Health Journey
  healthJourney: {
    startDate: timestamp,
    currentWeight: 180,
    targetWeight: 165,
    startingWeight: 195,
    weightHistory: [
      { date: timestamp, weight: 180, notes: "..." }
    ],
    measurements: {
      current: { waist: 34, chest: 40, hips: 38 },
      history: [
        { date: timestamp, waist: 34, chest: 40, hips: 38 }
      ]
    },
    progressPhotos: [
      { date: timestamp, url: "...", type: "front/side/back" }
    ],
    goals: [
      {
        id: "...",
        title: "Lose 15 lbs",
        target: 165,
        deadline: timestamp,
        status: "active/completed/abandoned",
        milestones: [
          { weight: 190, achieved: true, date: timestamp },
          { weight: 185, achieved: true, date: timestamp },
          { weight: 180, achieved: false }
        ]
      }
    ]
  },

  // Challenges
  challenges: {
    active: [
      {
        id: "7_day_meal_prep",
        startDate: timestamp,
        endDate: timestamp,
        progress: 4,
        target: 7,
        reward: { xp: 500, badge: "meal_prep_champion" }
      }
    ],
    completed: ["challenge_id_1", "challenge_id_2"],
    available: ["challenge_id_3"]
  },

  // Social & Sharing
  social: {
    recipesShared: 12,
    friendsInvited: 5,
    friendsJoined: 3,
    likesReceived: 45,
    leaderboardRank: 23,
    lastShareDate: timestamp
  }
}
```

---

## 🎮 XP & Leveling System

### XP Point Values

| Action | XP Earned | Category |
|--------|-----------|----------|
| **Recipe Actions** |
| Add new recipe | 50 XP | Content Creation |
| Import recipe from URL | 30 XP | Content Creation |
| Share recipe publicly | 75 XP | Sharing |
| Recipe receives like | 10 XP | Social |
| Mark recipe as favorite | 5 XP | Engagement |
| **Meal Planning** |
| Create meal plan | 100 XP | Planning |
| Complete full week plan | 200 XP | Planning |
| Save meal plan template | 50 XP | Planning |
| **Shopping** |
| Generate shopping list | 25 XP | Planning |
| Complete shopping trip | 50 XP | Execution |
| **Health Journey** |
| Log weight | 20 XP | Health Tracking |
| Log measurements | 20 XP | Health Tracking |
| Upload progress photo | 30 XP | Health Tracking |
| Complete goal milestone | 150 XP | Achievement |
| **Social & Sharing** |
| Invite friend | 100 XP | Social |
| Friend joins via referral | 250 XP | Social |
| **Daily Activities** |
| Daily login | 10 XP | Engagement |
| Maintain 7-day streak | 100 XP | Engagement |
| Maintain 30-day streak | 500 XP | Engagement |
| **Challenges** |
| Complete challenge | 200-1000 XP | Achievement |

### Level Progression

```javascript
const LEVEL_THRESHOLDS = [
  { level: 1, xpRequired: 0, title: "Beginner Chef" },
  { level: 2, xpRequired: 100, title: "Home Cook" },
  { level: 3, xpRequired: 250, title: "Recipe Explorer" },
  { level: 4, xpRequired: 500, title: "Meal Planner" },
  { level: 5, xpRequired: 1000, title: "Kitchen Organizer" },
  { level: 10, xpRequired: 5000, title: "Culinary Expert" },
  { level: 15, xpRequired: 12000, title: "Master Chef" },
  { level: 20, xpRequired: 25000, title: "Nutrition Guru" },
  { level: 25, xpRequired: 50000, title: "Health Champion" },
  { level: 30, xpRequired: 100000, title: "Legendary Cook" }
];
```

### Level Benefits

- **Level 5:** Unlock custom meal plan templates
- **Level 10:** Access to premium recipes
- **Level 15:** Create and share challenges
- **Level 20:** Leaderboard Hall of Fame
- **Level 25:** Custom achievement badges
- **Level 30:** Lifetime Pro features

---

## 🏆 Achievement System

### Achievement Categories

#### 1. Recipe Master Achievements
```javascript
const RECIPE_ACHIEVEMENTS = [
  {
    id: "first_recipe",
    name: "First Steps",
    description: "Add your first recipe",
    icon: "🍳",
    xp: 50,
    criteria: { recipesAdded: 1 }
  },
  {
    id: "recipe_collector",
    name: "Recipe Collector",
    tiers: [
      { count: 10, name: "Bronze", xp: 100 },
      { count: 50, name: "Silver", xp: 250 },
      { count: 100, name: "Gold", xp: 500 },
      { count: 250, name: "Platinum", xp: 1000 }
    ],
    icon: "📚"
  },
  {
    id: "import_master",
    name: "Import Master",
    description: "Import 25 recipes from URLs",
    icon: "🔗",
    xp: 300,
    criteria: { recipesImported: 25 }
  }
];
```

#### 2. Meal Planning Achievements
```javascript
const MEAL_PLANNING_ACHIEVEMENTS = [
  {
    id: "weekly_planner",
    name: "Weekly Planner",
    description: "Create your first weekly meal plan",
    icon: "📅",
    xp: 100
  },
  {
    id: "meal_plan_streak",
    name: "Consistency King/Queen",
    description: "Complete 4 consecutive weekly meal plans",
    icon: "👑",
    xp: 500
  },
  {
    id: "template_creator",
    name: "Template Creator",
    description: "Save 5 meal plan templates",
    icon: "📋",
    xp: 200
  }
];
```

#### 3. Health Journey Achievements
```javascript
const HEALTH_ACHIEVEMENTS = [
  {
    id: "first_weigh_in",
    name: "Starting Strong",
    description: "Log your first weight measurement",
    icon: "⚖️",
    xp: 50
  },
  {
    id: "weight_goal_reached",
    name: "Goal Crusher",
    description: "Reach your weight goal",
    icon: "🎯",
    xp: 1000
  },
  {
    id: "progress_documenter",
    name: "Progress Documenter",
    description: "Upload 10 progress photos",
    icon: "📸",
    xp: 300
  },
  {
    id: "milestone_achiever",
    name: "Milestone Achiever",
    tiers: [
      { milestones: 5, xp: 250 },
      { milestones: 10, xp: 500 },
      { milestones: 20, xp: 1000 }
    ],
    icon: "🏅"
  }
];
```

#### 4. Social Achievements
```javascript
const SOCIAL_ACHIEVEMENTS = [
  {
    id: "first_share",
    name: "Sharing is Caring",
    description: "Share your first recipe",
    icon: "💝",
    xp: 75
  },
  {
    id: "social_butterfly",
    name: "Social Butterfly",
    description: "Share 25 recipes",
    icon: "🦋",
    xp: 500
  },
  {
    id: "friend_recruiter",
    name: "Friend Recruiter",
    description: "Invite 5 friends who join",
    icon: "🤝",
    xp: 750
  },
  {
    id: "influencer",
    name: "Recipe Influencer",
    description: "Get 100 likes on your recipes",
    icon: "⭐",
    xp: 1000
  }
];
```

#### 5. Streak Achievements
```javascript
const STREAK_ACHIEVEMENTS = [
  {
    id: "week_warrior",
    name: "Week Warrior",
    description: "Maintain a 7-day streak",
    icon: "🔥",
    xp: 100
  },
  {
    id: "month_master",
    name: "Month Master",
    description: "Maintain a 30-day streak",
    icon: "💪",
    xp: 500
  },
  {
    id: "unstoppable",
    name: "Unstoppable",
    description: "Maintain a 90-day streak",
    icon: "🚀",
    xp: 2000
  }
];
```

---

## 🔥 Streak System

### Streak Mechanics

- **Daily Streak:** Login and perform at least one action
- **Streak Actions:**
  - Add/view recipe
  - Create/update meal plan
  - Log health data
  - Complete shopping list
  - Share recipe

### Streak Rewards

| Streak Days | Bonus XP | Badge |
|-------------|----------|-------|
| 3 days | 50 XP | "Getting Started" |
| 7 days | 100 XP | "Week Warrior" 🔥 |
| 14 days | 250 XP | "Two Weeks Strong" 💪 |
| 30 days | 500 XP | "Month Master" 👑 |
| 60 days | 1000 XP | "Consistent Champion" 🏆 |
| 90 days | 2000 XP | "Unstoppable" 🚀 |
| 180 days | 5000 XP | "Half Year Hero" ⭐ |
| 365 days | 10000 XP | "Year Legend" 🎖️ |

### Streak Protection

- **Grace Period:** 1 missed day doesn't break streak (use once per month)
- **Streak Freeze:** Use earned freeze tokens to protect streak
- **Earn Freezes:** Complete weekly challenges to earn freeze tokens

---

## 🎯 Challenge System

### Challenge Types

#### Daily Challenges
```javascript
const DAILY_CHALLENGES = [
  {
    id: "daily_recipe_view",
    title: "Recipe Explorer",
    description: "View 3 recipes today",
    target: 3,
    reward: { xp: 25 },
    duration: "1 day"
  },
  {
    id: "daily_meal_plan",
    title: "Plan Ahead",
    description: "Add a meal to today's plan",
    target: 1,
    reward: { xp: 30 },
    duration: "1 day"
  }
];
```

#### Weekly Challenges
```javascript
const WEEKLY_CHALLENGES = [
  {
    id: "weekly_meal_prep",
    title: "7-Day Meal Prep",
    description: "Complete a full week meal plan",
    target: 7,
    reward: { xp: 200, badge: "weekly_planner" },
    duration: "7 days"
  },
  {
    id: "weekly_shopping",
    title: "Shop Smart",
    description: "Generate and complete 2 shopping lists",
    target: 2,
    reward: { xp: 150 },
    duration: "7 days"
  }
];
```

#### Special Challenges
```javascript
const SPECIAL_CHALLENGES = [
  {
    id: "new_year_reset",
    title: "New Year, New You",
    description: "Complete 30 days of meal planning in January",
    target: 30,
    reward: { xp: 1000, badge: "new_year_champion" },
    startDate: "2025-01-01",
    endDate: "2025-01-31"
  },
  {
    id: "recipe_variety",
    title: "Variety is the Spice",
    description: "Try 20 new recipes this month",
    target: 20,
    reward: { xp: 500 },
    duration: "30 days"
  }
];
```

---

## 📈 Health Journey Tracking

### Features

#### 1. Weight Tracking
- Log weight entries with dates
- Graph showing weight over time
- Calculate BMI
- Show progress towards goal
- Milestone markers on chart

#### 2. Body Measurements
- Waist, chest, hips, arms, thighs
- Track changes over time
- Visual before/after comparisons
- Photo overlay comparisons

#### 3. Progress Photos
- Front, side, back views
- Date-stamped gallery
- Side-by-side comparisons
- Privacy controls (private by default)

#### 4. Goals & Milestones
- Set weight goals with deadlines
- Break into smaller milestones
- Track completion percentage
- Celebrate achievements
- Share success stories

#### 5. Health Metrics Dashboard
```javascript
{
  summary: {
    totalWeightLost: 15, // lbs
    daysTracking: 45,
    goalProgress: 75, // percentage
    averageWeeklyLoss: 1.2, // lbs per week
    nextMilestone: { weight: 175, daysToGo: 12 }
  },
  insights: [
    "You're averaging 1.2 lbs per week - great progress!",
    "You've completed 3 milestones - keep it up!",
    "Only 5 lbs away from your goal!"
  ]
}
```

---

## 🎨 UI Components to Build

### 1. GamificationDashboard Component
```jsx
<GamificationDashboard>
  <UserLevelCard
    level={15}
    title="Master Chef"
    xp={12450}
    xpToNext={13000}
  />

  <StreakTracker
    currentStreak={23}
    longestStreak={45}
  />

  <QuickStats
    recipesAdded={87}
    mealPlansCreated={34}
    achievementsUnlocked={28}
  />
</GamificationDashboard>
```

### 2. AchievementGrid Component
```jsx
<AchievementGrid>
  <AchievementBadge
    badge={achievement}
    unlocked={true}
    onClick={showDetails}
  />
</AchievementGrid>
```

### 3. HealthJourneyCard Component
```jsx
<HealthJourneyCard>
  <WeightChart data={weightHistory} />
  <GoalProgress
    current={180}
    target={165}
    start={195}
  />
  <QuickActions>
    <Button onClick={logWeight}>Log Weight</Button>
    <Button onClick={addPhoto}>Add Photo</Button>
  </QuickActions>
</HealthJourneyCard>
```

### 4. ChallengeCard Component
```jsx
<ChallengeCard challenge={challenge}>
  <ProgressBar
    current={challenge.progress}
    target={challenge.target}
  />
  <TimeRemaining endDate={challenge.endDate} />
  <RewardPreview reward={challenge.reward} />
</ChallengeCard>
```

---

## 🔧 Services to Create/Update

### 1. gamificationService.js
```javascript
// XP Management
export async function awardXP(userId, amount, action, description);
export async function getUserLevel(userId);
export async function checkLevelUp(userId);

// Achievement Management
export async function checkAchievements(userId);
export async function unlockAchievement(userId, achievementId);
export async function getAchievementProgress(userId);

// Streak Management
export async function updateStreak(userId);
export async function getStreakInfo(userId);
export async function useStreakFreeze(userId);
```

### 2. healthJourneyService.js
```javascript
// Weight Tracking
export async function logWeight(userId, weight, date, notes);
export async function getWeightHistory(userId, startDate, endDate);

// Measurements
export async function logMeasurements(userId, measurements, date);
export async function getMeasurementsHistory(userId);

// Progress Photos
export async function uploadProgressPhoto(userId, photo, type);
export async function getProgressPhotos(userId);

// Goals
export async function createGoal(userId, goal);
export async function updateGoalProgress(userId, goalId, progress);
export async function completeGoal(userId, goalId);
```

### 3. challengeService.js
```javascript
// Challenge Management
export async function getAvailableChallenges(userId);
export async function startChallenge(userId, challengeId);
export async function updateChallengeProgress(userId, challengeId, progress);
export async function completeChallenge(userId, challengeId);
export async function getActiveChallenges(userId);
```

### 4. leaderboardService.js
```javascript
// Leaderboard
export async function getGlobalLeaderboard(limit = 100);
export async function getFriendsLeaderboard(userId);
export async function getUserRank(userId);
```

---

## 📱 Profile Page Layout (Enhanced)

```
┌─────────────────────────────────────┐
│         GAMIFICATION HUB            │
├─────────────────────────────────────┤
│                                     │
│  ┌───────────────────────────────┐ │
│  │ Level 15: Master Chef         │ │
│  │ ████████████░░░░░░ 75%        │ │
│  │ 12,450 / 13,000 XP            │ │
│  └───────────────────────────────┘ │
│                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐ │
│  │  🔥23  │ │ 🏆 28  │ │ 📚 87  │ │
│  │ Streak │ │Badges  │ │Recipes │ │
│  └────────┘ └────────┘ └────────┘ │
│                                     │
├─────────────────────────────────────┤
│        HEALTH JOURNEY 📊            │
├─────────────────────────────────────┤
│                                     │
│  Current: 180 lbs → Goal: 165 lbs  │
│  ████████████░░░░░ 75% Complete    │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    Weight Chart (30 days)   │   │
│  │         📈                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  [Log Weight] [Add Photo] [Goals]  │
│                                     │
├─────────────────────────────────────┤
│        ACHIEVEMENTS 🏆              │
├─────────────────────────────────────┤
│                                     │
│  🎖️ 🏅 ⭐ 🔥 📚 💪 👑 🚀        │
│  (Achievement badges grid)          │
│                                     │
│  Recent: "Month Master" unlocked!   │
│                                     │
├─────────────────────────────────────┤
│        ACTIVE CHALLENGES 🎯         │
├─────────────────────────────────────┤
│                                     │
│  7-Day Meal Prep Challenge          │
│  Progress: ████░░░ 4/7 days         │
│  Reward: 200 XP + Badge             │
│  Time left: 3 days                  │
│                                     │
├─────────────────────────────────────┤
│        SOCIAL & SHARING 🤝          │
├─────────────────────────────────────┤
│                                     │
│  Recipes Shared: 12                 │
│  Friends Invited: 5                 │
│  Leaderboard Rank: #23              │
│                                     │
│  [View Leaderboard] [Invite More]   │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create data models and Firestore structure
- [ ] Build gamificationService.js
- [ ] Implement XP and leveling system
- [ ] Create GamificationDashboard component
- [ ] Add basic stats display

### Phase 2: Achievements (Week 2)
- [ ] Define all achievement criteria
- [ ] Build achievement tracking logic
- [ ] Create AchievementGrid component
- [ ] Implement unlock notifications
- [ ] Add achievement progress tracking

### Phase 3: Streaks (Week 3)
- [ ] Build streak tracking logic
- [ ] Create StreakTracker component
- [ ] Implement streak freeze system
- [ ] Add daily login rewards
- [ ] Build streak history view

### Phase 4: Health Journey (Week 4)
- [ ] Create healthJourneyService.js
- [ ] Build weight tracking UI
- [ ] Add measurements logging
- [ ] Implement progress photo upload
- [ ] Create goals and milestones system
- [ ] Build health dashboard charts

### Phase 5: Challenges (Week 5)
- [ ] Create challengeService.js
- [ ] Define challenge templates
- [ ] Build challenge tracking logic
- [ ] Create ChallengeCard component
- [ ] Add challenge notifications
- [ ] Implement challenge rewards

### Phase 6: Social & Leaderboard (Week 6)
- [ ] Create leaderboardService.js
- [ ] Build leaderboard UI
- [ ] Add friend comparisons
- [ ] Enhance sharing features
- [ ] Add social achievements

### Phase 7: Polish & Testing (Week 7)
- [ ] Add animations and micro-interactions
- [ ] Implement notification system
- [ ] Performance optimization
- [ ] Mobile responsiveness
- [ ] User testing and feedback
- [ ] Bug fixes and refinements

---

## 🎉 Success Metrics

### Engagement Metrics
- **Daily Active Users (DAU)** - Target: +30%
- **Average Session Duration** - Target: +40%
- **Feature Usage** - Target: +50% across all features
- **User Retention (30-day)** - Target: +35%

### Social Metrics
- **Recipes Shared** - Target: +100%
- **Friend Invitations** - Target: +150%
- **Referral Conversion** - Target: 20%

### Health Journey Metrics
- **Weight Logs** - Target: 80% of users log weekly
- **Goal Completion** - Target: 60% of goals reached
- **Progress Photos** - Target: 40% of users upload photos
- **Streak Participation** - Target: 50% maintain 7+ day streaks

---

## 📝 Notes

- All XP values and level thresholds can be adjusted based on analytics
- Achievement criteria should be reviewed quarterly
- Challenge templates should rotate seasonally
- Privacy controls are critical for health data
- Mobile-first design is essential
- Real-time updates for achievements/levels create excitement
- Celebrate milestones with animations and confetti effects

---

**Next Steps:**
1. Review and approve this plan
2. Create detailed UI mockups
3. Begin Phase 1 implementation
4. Set up analytics tracking
5. Plan beta testing with select users
