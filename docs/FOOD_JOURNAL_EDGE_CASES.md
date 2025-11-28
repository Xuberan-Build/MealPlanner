# Food Journal Edge Cases & Handling

## Identified Edge Cases

### 1. **ID Generation Conflicts**
- **Issue**: Using `Date.now()` could create duplicate IDs if entries are created in the same millisecond
- **Risk**: Medium - Could overwrite entries or cause data loss
- **Solution**: Use `Date.now()` + random string or use Firestore's auto-generated IDs

### 2. **Energy Value Validation**
- **Issue**: No validation that energy values are between 1-5
- **Risk**: High - Invalid data could break charts/insights
- **Current**: `energyBefore: entryData.energyBefore || null`
- **Solution**: Validate and clamp values between 1-5

### 3. **Array Size Limits**
- **Issue**: No limit on number of journal entries
- **Risk**: High - Firestore document size limit is 1MB, could be exceeded
- **Impact**: ~1000-2000 entries could hit limit
- **Solution**: Implement archiving or pagination strategy

### 4. **Date Validation**
- **Issue**: No validation of future dates or invalid ISO strings
- **Risk**: Medium - Could log entries for years in the future
- **Solution**: Validate date is valid and not too far in the future/past

### 5. **String Length Limits**
- **Issue**: No max length on notes (could be megabytes)
- **Risk**: Medium - Could quickly fill document size
- **Solution**: Enforce max lengths (e.g., notes: 1000 chars, mealName: 200 chars)

### 6. **Race Conditions**
- **Issue**: Multiple simultaneous updates could overwrite each other
- **Risk**: High - Could lose data during concurrent updates
- **Current**: Read → Modify → Write pattern is not atomic
- **Solution**: Use Firestore transactions or arrayUnion (but we can't due to timestamp issue)

### 7. **Required Field Validation**
- **Issue**: mealName could be empty string or whitespace
- **Risk**: Low - Just creates unclear entries
- **Solution**: Validate required fields exist and have content

### 8. **Physical Feelings Validation**
- **Issue**: No validation on array contents (could contain invalid values)
- **Risk**: Low - Just display issues
- **Solution**: Validate against allowed feelings list

### 9. **Duplicate Entry Detection**
- **Issue**: Could log same meal multiple times accidentally
- **Risk**: Low - User could make mistakes
- **Solution**: Optional duplicate detection (same meal + date within 1 hour)

### 10. **Update Conflicts**
- **Issue**: When updating, entry might have been deleted by another session
- **Risk**: Medium - Could restore deleted entries
- **Solution**: Check entry exists before updating

### 11. **Malformed Data Migration**
- **Issue**: Existing data might not have all required fields
- **Risk**: Medium - Could break insights calculations
- **Solution**: Defensive programming in getters, normalize data

### 12. **XSS/Injection**
- **Issue**: User input (notes, mealName) not sanitized
- **Risk**: Medium - Could inject malicious content
- **Solution**: Sanitize strings, use React's built-in escaping

## Firestore-Specific Considerations

### Document Size Limit
- Max: 1MB per document
- Entry size estimate: ~500 bytes average
- Max entries before limit: ~2000 entries
- **Recommendation**: Archive entries older than 1 year to subcollection

### Array Operations
- Can't use `arrayUnion` with `serverTimestamp()` (we already handle this)
- Array size limit: 20,000 elements (theoretical, but document size hits first)

### Transaction Safety
```javascript
// Current approach (NOT atomic):
1. Read document
2. Modify array in memory
3. Write entire array back

// Risk: Step 3 could overwrite changes from another client

// Better approach:
Use Firestore transaction to ensure atomicity
```

## Recommended Validation Rules

```javascript
const VALIDATION_RULES = {
  mealName: {
    required: true,
    minLength: 1,
    maxLength: 200,
    pattern: /^[a-zA-Z0-9\s\-,.'()]+$/ // Allow common meal characters
  },
  notes: {
    maxLength: 1000
  },
  energyLevel: {
    min: 1,
    max: 5,
    type: 'integer'
  },
  date: {
    required: true,
    minDate: '2020-01-01', // Reasonable start date
    maxDate: () => new Date() // No future dates
  },
  physicalFeelings: {
    maxItems: 10,
    allowedValues: [
      'Satisfied', 'Energized', 'Light', 'Comfortable',
      'Bloated', 'Heavy', 'Sluggish', 'Hungry', 'Full', 'Nauseous'
    ]
  },
  maxEntriesPerDocument: 2000
};
```

## Error Handling Strategy

1. **Input Validation Errors**: Return clear error messages to user
2. **Firestore Errors**: Retry with exponential backoff
3. **Document Size Errors**: Trigger archiving process
4. **Concurrent Update Conflicts**: Use transactions or inform user to retry
5. **Missing Document**: Initialize with defaults

## Data Sanitization

```javascript
// String sanitization
- Trim whitespace
- Remove null bytes
- Limit length
- Optional: Remove HTML/script tags

// Number sanitization
- Parse to integer/float
- Clamp to valid range
- Handle NaN/Infinity

// Array sanitization
- Filter out invalid values
- Remove duplicates
- Limit array size
```

## Archiving Strategy

When entries exceed threshold (~1500):
1. Move old entries (>1 year) to `users/{userId}/archivedJournalEntries` subcollection
2. Keep recent entries in main document for fast access
3. Update UI to fetch from both locations when needed
4. Show warning at ~1800 entries
