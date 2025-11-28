# MealPlanner Coach & Trainer Platform

**Date:** November 27, 2025
**Vision:** Enable nutrition coaches and personal trainers to manage clients, create meal plans, and track health progress

---

## 🎯 Core Use Cases

### For Coaches/Trainers
1. **Client Management** - Manage multiple clients from one dashboard
2. **Meal Plan Creation** - Build custom meal plans for each client
3. **Plan Distribution** - Share meal plans directly to client accounts
4. **Progress Monitoring** - Track client weight, measurements, and goals
5. **Communication** - Message clients and provide feedback
6. **Templates** - Create reusable meal plan templates

### For Clients
1. **Health Tracking** - Log weight, measurements, progress photos
2. **Goal Setting** - Set and track health/fitness goals
3. **Meal Plan Access** - Receive and follow coach-assigned plans
4. **Recipe Library** - Access coach-shared recipes
5. **Progress Sharing** - Share updates with coach
6. **Shopping Lists** - Generate lists from coach plans

---

## 🏗️ Account Types & Permissions

### Account Tiers

```javascript
const ACCOUNT_TYPES = {
  FREE: {
    role: "free",
    canCreateRecipes: true,
    canCreateMealPlans: true,
    maxClients: 0,
    canSharePlans: false,
    canTrackHealth: true,
    canHaveCoach: true,
    features: ["basic_recipes", "personal_meal_plans", "health_tracking"]
  },

  COACH: {
    role: "coach",
    canCreateRecipes: true,
    canCreateMealPlans: true,
    maxClients: 10, // or unlimited for premium
    canSharePlans: true,
    canTrackHealth: true,
    canHaveCoach: false,
    features: [
      "client_management",
      "meal_plan_distribution",
      "client_progress_tracking",
      "recipe_library",
      "meal_plan_templates",
      "client_messaging"
    ]
  },

  COACH_PRO: {
    role: "coach_pro",
    maxClients: -1, // unlimited
    features: [
      ...COACH.features,
      "branded_profiles",
      "custom_domains",
      "advanced_analytics",
      "meal_plan_marketplace",
      "white_label_reports"
    ]
  },

  CLIENT: {
    role: "client",
    hasCoach: true,
    coachId: "string",
    canCreateRecipes: true,
    canCreateMealPlans: true,
    receivesCoachPlans: true,
    sharesProgressWithCoach: true,
    features: [
      "coach_assigned_plans",
      "health_tracking_shared",
      "coach_messaging",
      "recipe_access"
    ]
  }
};
```

---

## 📊 Data Models

### User Profile (Enhanced)

```javascript
{
  // Existing fields
  uid: "string",
  email: "string",
  name: "string",

  // Account type
  accountType: "free" | "coach" | "coach_pro" | "client",

  // Coach relationship
  coachRelationship: {
    isCoach: false,
    hasCoach: true,
    coachId: "coach_user_id",
    coachName: "John Smith",
    coachEmail: "coach@example.com",
    relationshipStartDate: timestamp,
    status: "active" | "pending" | "inactive"
  },

  // For coach accounts
  coachProfile: {
    businessName: "FitLife Nutrition",
    certifications: ["Certified Nutritionist", "Personal Trainer"],
    specialties: ["Weight Loss", "Sports Nutrition", "Meal Prep"],
    bio: "15 years experience...",
    website: "https://...",
    phone: "+1-555-0100",
    clients: ["client_id_1", "client_id_2"], // Array of client UIDs
    activeClients: 8,
    totalClients: 15
  },

  // Health Journey (enhanced)
  healthJourney: {
    // Privacy settings
    privacy: {
      shareWithCoach: true,
      shareWeight: true,
      shareMeasurements: true,
      sharePhotos: true,
      shareGoals: true
    },

    // Goals set by user or coach
    goals: [
      {
        id: "goal_1",
        title: "Lose 15 lbs",
        setBy: "coach" | "self",
        setByUserId: "coach_id",
        startWeight: 195,
        targetWeight: 180,
        deadline: timestamp,
        status: "active",
        milestones: [
          { weight: 190, achieved: true, date: timestamp },
          { weight: 185, achieved: false }
        ],
        notes: "Focus on protein intake and strength training"
      }
    ],

    // Weight tracking
    weight: {
      current: 180,
      start: 195,
      target: 165,
      history: [
        { date: timestamp, weight: 180, notes: "Feeling great!", loggedBy: "self" }
      ]
    },

    // Measurements
    measurements: {
      current: { waist: 34, chest: 40, hips: 38, arms: 14, thighs: 22 },
      history: [
        {
          date: timestamp,
          waist: 34,
          chest: 40,
          hips: 38,
          arms: 14,
          thighs: 22,
          notes: "",
          loggedBy: "self"
        }
      ]
    },

    // Progress photos
    progressPhotos: [
      {
        id: "photo_1",
        date: timestamp,
        urls: {
          front: "storage_url",
          side: "storage_url",
          back: "storage_url"
        },
        weight: 180,
        notes: "Week 4 progress",
        visibility: "coach_only" | "private"
      }
    ]
  }
}
```

### Coach-Client Relationship

```javascript
// Collection: coachClientRelationships
{
  id: "relationship_id",
  coachId: "coach_user_id",
  clientId: "client_user_id",
  status: "pending" | "active" | "paused" | "ended",

  invitedDate: timestamp,
  acceptedDate: timestamp,
  endedDate: timestamp,

  // Permissions granted by client
  permissions: {
    canViewWeight: true,
    canViewMeasurements: true,
    canViewPhotos: true,
    canViewGoals: true,
    canEditGoals: true,
    canAssignMealPlans: true,
    canSendMessages: true
  },

  // Plan assignments
  assignedPlans: [
    {
      planId: "meal_plan_id",
      assignedDate: timestamp,
      startDate: timestamp,
      endDate: timestamp,
      status: "active" | "completed" | "archived",
      notes: "Focus on high protein, low carb"
    }
  ],

  // Check-ins
  checkIns: [
    {
      id: "checkin_1",
      date: timestamp,
      weight: 180,
      measurements: { ... },
      notes: "Great progress this week!",
      coachNotes: "Keep up the good work",
      photos: ["photo_id"]
    }
  ],

  // Communication
  lastMessageDate: timestamp,
  unreadMessages: 3
}
```

### Shared Meal Plans

```javascript
// Collection: sharedMealPlans
{
  id: "shared_plan_id",

  // Owner info
  createdBy: "coach_user_id",
  createdByName: "John Smith - FitLife Nutrition",
  createdDate: timestamp,

  // Plan details
  planName: "High Protein Week 1",
  description: "Week 1 of muscle building program",
  tags: ["high-protein", "muscle-building", "1800-calories"],

  // Meal plan structure
  mealPlan: {
    monday: {
      breakfast: { recipeId: "recipe_1", recipeName: "...", servings: 1 },
      lunch: { recipeId: "recipe_2", recipeName: "...", servings: 1 },
      dinner: { recipeId: "recipe_3", recipeName: "...", servings: 1 },
      snacks: [{ recipeId: "recipe_4", recipeName: "...", servings: 1 }]
    },
    // ... other days
  },

  // Nutritional summary
  nutrition: {
    totalCalories: 1800,
    protein: 150,
    carbs: 180,
    fat: 60
  },

  // Sharing
  sharedWith: ["client_id_1", "client_id_2"], // Array of client UIDs
  isTemplate: true, // Can be reused
  visibility: "private" | "clients_only" | "marketplace",

  // Usage tracking
  timesAssigned: 12,
  activeClients: 3
}
```

---

## 🎨 UI Components to Build

### Phase 1: Health Journey Tracking

#### 1. HealthJourneySection Component
```jsx
<HealthJourneySection>
  <WeightTracker />
  <MeasurementsLog />
  <GoalsCard />
  <ProgressPhotos />
  <HealthStats />
</HealthJourneySection>
```

#### 2. WeightTracker Component
```jsx
<WeightTracker>
  <WeightChart data={weightHistory} />
  <CurrentStats
    current={180}
    start={195}
    target={165}
    progress={75}
  />
  <LogWeightButton onClick={openWeightModal} />
</WeightTracker>
```

#### 3. WeightLogModal Component
```jsx
<WeightLogModal>
  <DatePicker />
  <WeightInput />
  <NotesTextarea />
  <SaveButton />
</WeightLogModal>
```

#### 4. MeasurementsLog Component
```jsx
<MeasurementsLog>
  <MeasurementInputs
    waist={34}
    chest={40}
    hips={38}
    arms={14}
    thighs={22}
  />
  <MeasurementHistory />
  <ComparisonView />
</MeasurementsLog>
```

#### 5. GoalsCard Component
```jsx
<GoalsCard>
  <ActiveGoals goals={activeGoals} />
  <MilestoneProgress />
  <AddGoalButton />
</GoalsCard>
```

#### 6. ProgressPhotos Component
```jsx
<ProgressPhotos>
  <PhotoGallery photos={progressPhotos} />
  <UploadPhotoButton />
  <ComparisonTool />
  <PrivacyToggle />
</ProgressPhotos>
```

### Phase 2: Enhanced Recipe Sharing

#### 7. ShareMealPlanModal Component
```jsx
<ShareMealPlanModal>
  <ShareOptions
    shareWithClients={true}
    makeTemplate={true}
    addToMarketplace={false}
  />
  <ClientSelector clients={myClients} />
  <PlanDetails
    name=""
    description=""
    tags={[]}
  />
</ShareMealPlanModal>
```

### Phase 3: Coach Dashboard

#### 8. CoachDashboard Component
```jsx
<CoachDashboard>
  <ClientsList clients={myClients} />
  <PlanTemplates templates={myTemplates} />
  <RecentActivity />
  <QuickActions />
</CoachDashboard>
```

#### 9. ClientCard Component
```jsx
<ClientCard client={client}>
  <ClientInfo name={name} email={email} />
  <ProgressSummary
    weightLoss={-15}
    goalsCompleted={3}
    daysActive={45}
  />
  <QuickActions
    viewProgress={true}
    assignPlan={true}
    message={true}
  />
</ClientCard>
```

#### 10. ClientProgressView Component
```jsx
<ClientProgressView clientId={clientId}>
  <ClientHeader />
  <WeightChart />
  <MeasurementsTrend />
  <GoalsProgress />
  <PhotoComparison />
  <CoachNotes />
  <AssignedPlans />
</ClientProgressView>
```

#### 11. AssignMealPlanModal Component
```jsx
<AssignMealPlanModal>
  <PlanSelector
    myPlans={coachPlans}
    templates={templates}
  />
  <SchedulePicker
    startDate=""
    endDate=""
  />
  <PersonalizationOptions />
  <NotesToClient />
</AssignMealPlanModal>
```

---

## 🔧 Services to Build

### 1. healthJourneyService.js (Enhanced)

```javascript
// Weight tracking
export async function logWeight(userId, weight, date, notes);
export async function getWeightHistory(userId, startDate, endDate);
export async function getWeightStats(userId);

// Measurements
export async function logMeasurements(userId, measurements, date, notes);
export async function getMeasurementsHistory(userId);
export async function compareMeasurements(userId, date1, date2);

// Progress photos
export async function uploadProgressPhoto(userId, photoData);
export async function getProgressPhotos(userId);
export async function comparePhotos(photoId1, photoId2);
export async function updatePhotoPrivacy(photoId, visibility);

// Goals
export async function createGoal(userId, goalData);
export async function updateGoal(goalId, updates);
export async function completeGoal(goalId);
export async function addMilestone(goalId, milestone);
export async function completeMilestone(goalId, milestoneId);

// Share with coach
export async function shareHealthDataWithCoach(userId, coachId, permissions);
```

### 2. coachClientService.js (New)

```javascript
// Relationship management
export async function inviteClient(coachId, clientEmail);
export async function acceptCoachInvite(clientId, coachId);
export async function endCoachRelationship(relationshipId);

// Client management
export async function getCoachClients(coachId);
export async function getClientCoach(clientId);
export async function updateRelationshipPermissions(relationshipId, permissions);

// Progress tracking
export async function getClientProgress(coachId, clientId);
export async function addCoachNotes(relationshipId, notes);

// Check-ins
export async function scheduleCheckIn(coachId, clientId, date);
export async function submitCheckIn(relationshipId, checkInData);
export async function getCheckInHistory(relationshipId);
```

### 3. mealPlanSharingService.js (New)

```javascript
// Plan creation & sharing
export async function createSharedPlan(coachId, planData);
export async function assignPlanToClient(planId, clientId, schedule);
export async function getAssignedPlans(clientId);
export async function getCoachPlans(coachId);

// Templates
export async function saveAsTemplate(planId);
export async function getTemplates(coachId);
export async function duplicatePlan(planId);

// Plan management
export async function updateSharedPlan(planId, updates);
export async function archivePlan(planId);
export async function removePlanFromClient(planId, clientId);
```

### 4. messagingService.js (New)

```javascript
// Messaging between coach and client
export async function sendMessage(fromId, toId, message);
export async function getConversation(userId1, userId2);
export async function markAsRead(messageId);
export async function getUnreadCount(userId);
```

---

## 📱 Profile Page Structure (Enhanced)

```
┌─────────────────────────────────────┐
│         MY HEALTH JOURNEY 📊        │
├─────────────────────────────────────┤
│                                     │
│  Coach: John Smith - FitLife        │
│  [Message Coach] [View Plans]       │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    WEIGHT PROGRESS          │   │
│  │                             │   │
│  │  Current: 180 lbs           │   │
│  │  Start: 195 lbs             │   │
│  │  Goal: 165 lbs              │   │
│  │  ██████████████░░ 75%       │   │
│  │                             │   │
│  │  [Weight Chart - 30 days]   │   │
│  │       📈                    │   │
│  │                             │   │
│  │  [Log Weight]               │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    MEASUREMENTS             │   │
│  │                             │   │
│  │  Waist: 34" (-3")           │   │
│  │  Chest: 40" (+2")           │   │
│  │  Hips: 38" (-2")            │   │
│  │                             │   │
│  │  [Log Measurements]         │   │
│  │  [View Trends]              │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    GOALS & MILESTONES       │   │
│  │                             │   │
│  │  🎯 Lose 15 lbs             │   │
│  │  ✅ 190 lbs (Week 2)        │   │
│  │  ✅ 185 lbs (Week 4)        │   │
│  │  ⏳ 180 lbs (Week 6)        │   │
│  │  ⏳ 175 lbs (Week 8)        │   │
│  │  ⏳ 165 lbs (Week 12)       │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │    PROGRESS PHOTOS          │   │
│  │                             │   │
│  │  [📷] [📷] [📷] [📷]        │   │
│  │                             │   │
│  │  [Add Photo] [Compare]      │   │
│  │  🔒 Private (Shared with    │   │
│  │     coach only)             │   │
│  └─────────────────────────────┘   │
│                                     │
├─────────────────────────────────────┤
│      ASSIGNED MEAL PLANS 🍽️        │
├─────────────────────────────────────┤
│                                     │
│  High Protein Week 1                │
│  By: John Smith                     │
│  Active: Nov 25 - Dec 1             │
│  [View Plan] [Shopping List]        │
│                                     │
│  Muscle Building Week 2             │
│  Starts: Dec 2                      │
│  [Preview Plan]                     │
│                                     │
└─────────────────────────────────────┘
```

---

## 🚀 Implementation Roadmap

### Phase 1: Health Journey Foundation (Week 1-2)
**Goal:** Build core health tracking features

- [ ] Create healthJourneyService.js
- [ ] Build WeightTracker component with chart
- [ ] Create WeightLogModal
- [ ] Build MeasurementsLog component
- [ ] Create GoalsCard component
- [ ] Add ProgressPhotos component
- [ ] Integrate into ProfilePage
- [ ] Add privacy controls

**Deliverables:**
- Users can log weight with history chart
- Users can track body measurements
- Users can set and track goals
- Users can upload progress photos

### Phase 2: Recipe & Meal Plan Sharing (Week 3)
**Goal:** Enhance sharing capabilities for meal plans

- [ ] Enhance existing ShareRecipeModal
- [ ] Create ShareMealPlanModal
- [ ] Update mealPlanService for sharing
- [ ] Create mealPlanSharingService
- [ ] Add meal plan templates feature
- [ ] Build template library view

**Deliverables:**
- Users can share complete meal plans
- Meal plans can be saved as templates
- Templates can be reused

### Phase 3: Coach Account Setup (Week 4)
**Goal:** Enable coach accounts and profiles

- [ ] Add account type to user model
- [ ] Create coach profile setup flow
- [ ] Build CoachProfile component
- [ ] Add coach verification/certification
- [ ] Create upgrade-to-coach flow
- [ ] Add billing for coach accounts

**Deliverables:**
- Users can upgrade to coach accounts
- Coaches have enhanced profiles
- Coach subscription/billing setup

### Phase 4: Client Management (Week 5)
**Goal:** Allow coaches to manage clients

- [ ] Create coachClientService.js
- [ ] Build CoachDashboard component
- [ ] Create ClientsList component
- [ ] Build InviteClientModal
- [ ] Add client invitation flow
- [ ] Create accept/decline invitation UI
- [ ] Build ClientCard components

**Deliverables:**
- Coaches can invite clients
- Clients can accept/decline
- Coaches see client dashboard

### Phase 5: Plan Assignment & Tracking (Week 6)
**Goal:** Enable plan distribution and progress monitoring

- [ ] Create AssignMealPlanModal
- [ ] Build plan assignment logic
- [ ] Create ClientProgressView
- [ ] Add progress charts for clients
- [ ] Build comparison tools
- [ ] Add coach notes feature
- [ ] Create check-in system

**Deliverables:**
- Coaches can assign plans to clients
- Coaches can view client progress
- Coaches can add notes/feedback
- Scheduled check-ins

### Phase 6: Communication (Week 7)
**Goal:** Enable coach-client messaging

- [ ] Create messagingService.js
- [ ] Build MessagingModal component
- [ ] Add real-time messaging
- [ ] Create notification system
- [ ] Add unread message counts
- [ ] Build conversation history

**Deliverables:**
- Coaches and clients can message
- Real-time notifications
- Message history

### Phase 7: Polish & Launch (Week 8)
**Goal:** Finalize and launch coach platform

- [ ] Mobile responsiveness
- [ ] Performance optimization
- [ ] Security audit
- [ ] User testing
- [ ] Documentation
- [ ] Marketing materials
- [ ] Beta launch to select coaches

---

## 💰 Pricing Strategy

### Client Accounts (Free)
- Personal meal planning
- Recipe library access
- Health tracking
- 1 coach connection

### Coach Account ($29/month)
- Up to 10 active clients
- Unlimited meal plan templates
- Client progress tracking
- Messaging
- Basic analytics

### Coach Pro Account ($79/month)
- Unlimited clients
- Branded profiles
- Advanced analytics
- White-label reports
- Priority support
- Marketplace access (sell templates)
- API access

---

## 📊 Success Metrics

### Adoption Metrics
- Coach sign-ups: Target 100 in first 3 months
- Client connections: Target 500 in first 3 months
- Active coach-client relationships: Target 300

### Engagement Metrics
- Plans assigned per coach: Target 15/month
- Client check-ins: Target 80% weekly
- Message response time: Target <24 hours

### Business Metrics
- Coach account conversion: Target 20%
- Coach Pro upgrade: Target 30%
- Monthly recurring revenue: Target $10k in 6 months

---

## 🔐 Privacy & Security

### Data Privacy
- Clients control what data coaches see
- Granular permission settings
- Progress photos default to private
- HIPAA compliance considerations
- Data export for clients

### Security
- Encrypted health data
- Secure photo storage
- Access logs for sensitive data
- Coach certification verification
- Report abuse mechanisms

---

**Next Steps:**
1. Review and approve this plan
2. Start Phase 1: Health Journey Foundation
3. Design UI mockups for components
4. Set up development environment
5. Begin implementation
