# Food Journal Service Documentation

## Overview

The Food Journal service provides robust, validated logging of meals and associated feelings/reactions. It includes comprehensive edge case handling, validation, duplicate detection, and transaction safety.

## Service Functions

### `logFoodJournalEntry(userId, entryData, options)`

Creates a new food journal entry with full validation and duplicate checking.

**Parameters:**
- `userId` (string, optional): User ID (defaults to current user)
- `entryData` (object): Entry data to log
- `options` (object, optional):
  - `checkDuplicates` (boolean): Enable duplicate detection (default: true)
  - `allowWarnings` (boolean): Allow warnings without blocking (default: false)

**Returns:** `Promise<{entry, warnings}>`
- `entry`: The created entry object
- `warnings`: Array of warning objects

**Throws:**
- `ValidationError`: Invalid input data
- `Error`: Document size limit exceeded or other errors

**Example:**
```javascript
const result = await logFoodJournalEntry(userId, {
  mealName: 'Grilled Chicken Salad',
  date: new Date().toISOString(),
  energyBefore: 3,
  energyAfter: 4,
  physicalFeelings: ['Satisfied', 'Energized'],
  notes: 'Felt great after eating!'
}, {
  checkDuplicates: true,
  allowWarnings: true
});

// Check for warnings
if (result.warnings.length > 0) {
  console.log('Warnings:', result.warnings);
}
```

### `updateFoodJournalEntry(userId, entryId, updates)`

Updates an existing journal entry with validation.

**Parameters:**
- `userId` (string, optional): User ID
- `entryId` (string, required): Entry ID to update
- `updates` (object, required): Updates to apply

**Returns:** `Promise<Object>` - Updated entry

**Throws:**
- `ValidationError`: Invalid update data
- `Error`: Entry not found

**Example:**
```javascript
await updateFoodJournalEntry(userId, 'journal_123456_abc', {
  energyAfter: 5,
  notes: 'Updated: Felt even better!'
});
```

### `getFoodJournalEntries(userId, filters)`

Retrieves journal entries with optional filtering.

**Parameters:**
- `userId` (string, optional): User ID
- `filters` (object, optional):
  - `startDate` (Date): Filter entries after this date
  - `endDate` (Date): Filter entries before this date
  - `mealPlanId` (string): Filter by meal plan ID

**Returns:** `Promise<Array>` - Array of entries (sorted newest first)

### `deleteFoodJournalEntry(userId, entryId)`

Deletes a journal entry.

**Parameters:**
- `userId` (string, optional): User ID
- `entryId` (string, required): Entry ID to delete

**Returns:** `Promise<void>`

### `getFoodInsights(userId)`

Generates insights from journal entries.

**Returns:** `Promise<Object>` - Insights object containing:
- `totalEntries`: Total number of entries
- `averageEnergy`: Average energy level
- `commonFeelings`: Most common feelings
- `positiveReactions`: Count of positive reactions
- `negativeReactions`: Count of negative reactions
- `topPositiveFoods`: Foods with most positive reactions
- `topNegativeFoods`: Foods with most negative reactions

## Validation Rules

### Required Fields
- ✅ `mealName`: 1-200 characters, required
- ✅ `date`: Valid ISO date, not in future, not before 2020

### Energy Levels
- ✅ Range: 1-5 (integer)
- ✅ Auto-clamped if outside range
- ✅ Null allowed

### Physical Feelings
- ✅ Allowed values: Satisfied, Energized, Light, Comfortable, Bloated, Heavy, Sluggish, Hungry, Full, Nauseous
- ✅ Maximum 10 feelings per entry
- ✅ Invalid values filtered out

### Strings
- ✅ `mealName`: Max 200 characters
- ✅ `notes`: Max 1000 characters
- ✅ Control characters removed
- ✅ Trimmed whitespace

## Edge Cases Handled

### 1. ID Collisions ✅
**Issue:** Multiple entries created in same millisecond could get duplicate IDs

**Solution:** IDs use `timestamp + random string` format
```javascript
id: "journal_1701234567890_x3k9m2p"
```

### 2. Energy Value Validation ✅
**Issue:** Invalid or out-of-range energy values

**Solution:** Values clamped to 1-5 range, NaN converted to null
```javascript
validateEnergyLevel(7) // Returns: 5
validateEnergyLevel(-1) // Returns: 1
validateEnergyLevel('invalid') // Returns: null
```

### 3. Array Size Limits ✅
**Issue:** Unlimited entries could exceed Firestore 1MB document limit

**Solution:**
- Hard limit at 2000 entries
- Warning at 1500 entries
- Blocks new entries when limit reached

```javascript
// User sees: "Entry limit reached (2000/2000). Please contact support."
```

### 4. Date Validation ✅
**Issue:** Future dates or invalid date strings

**Solution:**
- Rejects future dates
- Rejects dates before 2020-01-01
- Validates ISO string format

### 5. Race Conditions ✅
**Issue:** Concurrent updates could overwrite each other

**Solution:** Uses Firestore transactions for atomic read-modify-write
```javascript
await runTransaction(db, async (transaction) => {
  // Atomic operation
});
```

### 6. Duplicate Detection ✅
**Issue:** User might accidentally log same meal twice

**Solution:** Detects entries with:
- Same meal name (case-insensitive)
- Within 60 minutes

Warns user and allows override:
```javascript
warnings: [{
  type: 'POTENTIAL_DUPLICATE',
  message: 'Similar entry found for "Chicken Salad" at 2:30 PM'
}]
```

### 7. XSS/Injection ✅
**Issue:** Malicious input could break UI

**Solution:**
- Removes control characters
- React auto-escapes output
- Length limits enforced

### 8. Missing/Malformed Data ✅
**Issue:** Legacy data or corrupted entries

**Solution:** Defensive programming with defaults
```javascript
const entries = userData.healthJourney?.foodJournal?.entries || [];
```

### 9. Entry Updates on Deleted Data ✅
**Issue:** Updating an entry that was deleted elsewhere

**Solution:** Transaction checks entry exists before updating
```javascript
if (entryIndex === -1) {
  throw new Error(`Entry not found: ${entryId}`);
}
```

### 10. Document Size Tracking ✅
**Issue:** Unknown when approaching Firestore limits

**Solution:** `checkEntriesLimit()` provides warnings
```javascript
{
  count: 1450,
  isNearLimit: false,
  shouldArchive: false,
  remainingCapacity: 550
}
```

## Error Types

### ValidationError
Thrown when input validation fails
```javascript
{
  name: 'ValidationError',
  message: 'Meal name is required',
  field: 'mealName'
}
```

**Common validation errors:**
- Meal name empty or too long
- Date invalid or in future
- Energy level not an integer

### Document Limit Error
Thrown when entry limit reached
```javascript
{
  message: 'Entry limit reached (2000/2000). Please contact support for archiving.'
}
```

### Entry Not Found Error
Thrown when updating non-existent entry
```javascript
{
  message: 'Entry not found: journal_123456_abc'
}
```

## Warning Types

### POTENTIAL_DUPLICATE
Similar entry found recently
```javascript
{
  type: 'POTENTIAL_DUPLICATE',
  message: 'Similar entry found for "Pasta" at 12/15/2023 7:30 PM',
  duplicateId: 'journal_123456_xyz'
}
```

### APPROACHING_LIMIT
Nearing entry limit
```javascript
{
  type: 'APPROACHING_LIMIT',
  message: 'You have 450 entries remaining before archiving is needed.',
  count: 1550
}
```

## Transaction Safety

All write operations use Firestore transactions to ensure:
- ✅ Atomic read-modify-write operations
- ✅ No data loss from concurrent updates
- ✅ Consistent document state

```javascript
// Multiple clients updating simultaneously = SAFE
Client A: Read entries [A, B] → Add C → Write [A, B, C]
Client B: Read entries [A, B] → Add D → Write [A, B, D]

// Firestore transactions ensure both C and D are saved:
Final result: [A, B, C, D] ✅
```

## Performance Considerations

### Read Performance
- Single document read for all entries
- Fast queries (no subcollections)
- Client-side filtering

### Write Performance
- Transaction overhead: ~100-200ms
- Entire array rewritten on each update
- Good for <2000 entries

### Optimization Strategies (Future)
When entries exceed 1500:
1. Archive old entries to subcollection
2. Keep recent (1 year) in main document
3. Pagination for archived data

## Best Practices

### 1. Always Handle Warnings
```javascript
const result = await logFoodJournalEntry(userId, data, {
  allowWarnings: true
});

if (result.warnings.length > 0) {
  // Show warnings to user
  displayWarnings(result.warnings);
}
```

### 2. Use Try-Catch with Validation Errors
```javascript
try {
  await logFoodJournalEntry(userId, data);
} catch (error) {
  if (error.name === 'ValidationError') {
    // Show field-specific error
    showFieldError(error.field, error.message);
  } else {
    // Generic error
    showError('Failed to save entry');
  }
}
```

### 3. Validate on Frontend
Prevent unnecessary service calls:
```javascript
if (!mealName.trim()) {
  setError('Meal name is required');
  return;
}
```

### 4. Monitor Entry Counts
```javascript
const entries = await getFoodJournalEntries(userId);
const status = checkEntriesLimit(entries);

if (status.isNearLimit) {
  showWarning(`${status.remainingCapacity} entries remaining`);
}
```

## Testing Scenarios

### ✅ Normal Operation
- Create entry with all fields
- Update existing entry
- Delete entry
- Get entries with filters

### ✅ Edge Cases
- Create with minimal data (only mealName)
- Create with invalid energy (-1, 10, NaN)
- Create with future date
- Create 2000+ entries (should fail)
- Update non-existent entry (should fail)
- Create duplicate within 1 hour (should warn)

### ✅ Concurrent Operations
- Two users updating simultaneously
- Same user updating from two devices
- Entry deleted while being updated

### ✅ Malformed Data
- Very long strings (>1000 chars)
- Special characters in mealName
- Invalid date formats
- Non-array physicalFeelings
- Missing required fields

## Migration Notes

If updating from old service version:
1. Old entries without `timestamp` will be sanitized
2. Invalid energy values will be clamped
3. No data loss during migration
4. Backward compatible reads
