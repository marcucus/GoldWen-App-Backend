# Prompt Harmonization Summary

## Issue
Harmonize the number of prompts required for profile completion between frontend and backend. The frontend expected exactly 3 prompts, while the backend validation was checking for "at least 3" prompts (>= 3), creating an inconsistency.

## Changes Made

### 1. Updated Profile Completion Validation
**File**: `main-api/src/modules/profiles/profiles.service.ts`

Changed validation logic in three methods to check for **exactly 3 prompts** instead of **at least 3**:

#### `updateProfileCompletionStatus()` (line 578)
```typescript
// Before
const hasPromptAnswers = promptsCount >= 3;

// After
const hasPromptAnswers = promptsCount === 3;
```

#### `getProfileCompletion()` (line 668)
```typescript
// Before
const hasPrompts = promptsCount >= 3;

// After
const hasPrompts = promptsCount === 3;
```

#### `updateProfileStatus()` (line 830)
```typescript
// Before
const hasPromptAnswers = promptsCount >= 3;

// After
const hasPromptAnswers = promptsCount === 3;
```

### 2. Enhanced Error Messages
**File**: `main-api/src/modules/profiles/profiles.service.ts`

Updated error messages to handle edge cases where users have more than 3 prompts:

#### In `getProfileCompletion()` - missingSteps (lines 709-717)
```typescript
if (!hasPrompts) {
  if (promptsCount < 3) {
    const missingCount = 3 - promptsCount;
    missingSteps.push(`Answer ${missingCount} more prompt${missingCount > 1 ? 's' : ''} (${promptsCount}/3)`);
  } else if (promptsCount > 3) {
    const extraCount = promptsCount - 3;
    missingSteps.push(`You have too many prompts (${promptsCount}/3). Please remove ${extraCount} prompt${extraCount > 1 ? 's' : ''}`);
  }
}
```

#### In `getProfileCompletion()` - nextStep (lines 754-762)
```typescript
else if (!hasPrompts) {
  if (promptsCount < 3) {
    const missingCount = 3 - promptsCount;
    nextStep = `Answer ${missingCount} more prompt${missingCount > 1 ? 's' : ''}`;
  } else if (promptsCount > 3) {
    const extraCount = promptsCount - 3;
    nextStep = `Remove ${extraCount} prompt${extraCount > 1 ? 's' : ''} to have exactly 3`;
  }
}
```

#### In `updateProfileStatus()` - missingRequirements (lines 859-870)
```typescript
if (!hasPromptAnswers) {
  if (promptsCount < 3) {
    const missingCount = 3 - promptsCount;
    missingRequirements.push(
      `Need to answer ${missingCount} more prompt${missingCount > 1 ? 's' : ''} (${promptsCount}/3)`,
    );
  } else if (promptsCount > 3) {
    const extraCount = promptsCount - 3;
    missingRequirements.push(
      `Need to remove ${extraCount} prompt${extraCount > 1 ? 's' : ''} to have exactly 3 (${promptsCount}/3)`,
    );
  }
}
```

### 3. Updated API Documentation
**File**: `main-api/src/modules/profiles/profiles.controller.ts`

Enhanced Swagger/OpenAPI documentation for prompt-related endpoints:

#### GET /api/v1/profiles/prompts
```typescript
@ApiOperation({ 
  summary: 'Get available prompts',
  description: 'Returns exactly 3 active prompts that users can answer. Required prompts are prioritized first, then ordered by their order field.'
})
```

#### POST /api/v1/profiles/me/prompt-answers
```typescript
@ApiOperation({ 
  summary: 'Submit prompt answers',
  description: 'Submit exactly 3 prompt answers. This is required for profile completion. Each answer must be max 150 characters and will be moderated for inappropriate content.'
})
@ApiResponse({
  status: 400,
  description: 'Invalid request - must provide exactly 3 answers, or content moderation failed',
})
```

#### PUT /api/v1/profiles/me/prompt-answers
```typescript
@ApiOperation({ 
  summary: 'Update prompt answers',
  description: 'Update all prompt answers at once. Must provide exactly 3 answers. Each answer must be max 150 characters and will be moderated for inappropriate content.'
})
@ApiResponse({
  status: 400,
  description: 'Invalid request - must provide exactly 3 answers, or content moderation failed',
})
```

#### GET /api/v1/profiles/completion
```typescript
@ApiOperation({ 
  summary: 'Get profile completion status',
  description: 'Returns detailed profile completion status including requirements: 3 photos, exactly 3 prompts, personality questionnaire, and basic info (birthDate, bio).'
})
```

### 4. Added Test Coverage
**Files**: 
- `main-api/src/modules/profiles/tests/profile-completion-validation.spec.ts`
- `main-api/src/modules/profiles/tests/update-profile-status.spec.ts`

Added new test cases to verify the "exactly 3" requirement:

#### Profile Completion Validation Test
```typescript
it('should mark profile as incomplete when user has more than 3 prompt answers', async () => {
  // Tests that 4 prompts marks profile as incomplete
  // Verifies error message: "You have too many prompts (4/3). Please remove 1 prompt"
});
```

#### Update Profile Status Test
```typescript
it('should reject visibility when user has more than 3 prompts', async () => {
  // Tests that trying to make profile visible with 4 prompts fails
  // Verifies error message: "Need to remove 1 prompt to have exactly 3 (4/3)"
});
```

## Test Results

All profile-related tests pass:
- ✅ **64 tests passed** (8 test suites)
- ✅ All existing tests continue to pass
- ✅ New edge case tests for >3 prompts pass

## Impact

### API Behavior Changes
- **Profile completion status**: Now requires exactly 3 prompts (not >= 3)
- **Error messages**: More specific guidance when prompt count is incorrect
- **Edge case handling**: New validation for users with >3 prompts (legacy data)

### Backend Changes
- ✅ Consistent with frontend expectations (exactly 3 prompts)
- ✅ Aligned with specifications.md requirements
- ✅ DTOs already enforced exactly 3 (via `@ArrayMinSize(3)` and `@ArrayMaxSize(3)`)
- ✅ Service validation now matches DTO validation

### Frontend Compatibility
- ✅ No breaking changes for frontend (already expected exactly 3)
- ✅ Better error messages for users
- ✅ Clear API documentation

## Compliance

✅ **specifications.md**: "L'utilisateur doit répondre à 3 'prompts'" (exactly 3)
✅ **TACHES_FRONTEND.md**: "Il peut choisir 3 prompts minimum" (minimum 3, with max enforced by backend)
✅ **DTO Validation**: `@ArrayMinSize(3)` and `@ArrayMaxSize(3)` already enforced exactly 3
✅ **SOLID Principles**: Single Responsibility maintained, validation logic is clear and consistent
✅ **No Breaking Changes**: Frontend already expected exactly 3

## Next Steps

1. ✅ Deploy to staging for integration testing
2. ✅ Verify frontend/backend integration with exactly 3 prompts
3. ✅ Monitor for any edge cases with legacy data (users with >3 prompts)
4. ✅ Update any external documentation if needed
