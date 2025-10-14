# Before and After Comparison

## API Behavior Changes

### GET /api/v1/profiles/prompts

**Before:**
```json
{
  "prompts": [
    {
      "id": "uuid-1",
      "text": "What makes you laugh the most?",
      "isRequired": true,
      "order": 1
    },
    {
      "id": "uuid-2",
      "text": "Describe your perfect weekend.",
      "isRequired": true,
      "order": 2
    },
    {
      "id": "uuid-3",
      "text": "What are you most passionate about?",
      "isRequired": true,
      "order": 3
    },
    {
      "id": "uuid-4",
      "text": "What is your hidden talent?",
      "isRequired": false,
      "order": 4
    },
    {
      "id": "uuid-5",
      "text": "What book or movie changed your perspective?",
      "isRequired": false,
      "order": 5
    }
  ]
}
```

**After:**
```json
{
  "prompts": [
    {
      "id": "uuid-1",
      "text": "What makes you laugh the most?",
      "isRequired": true,
      "order": 1
    },
    {
      "id": "uuid-2",
      "text": "Describe your perfect weekend.",
      "isRequired": true,
      "order": 2
    },
    {
      "id": "uuid-3",
      "text": "What are you most passionate about?",
      "isRequired": true,
      "order": 3
    }
  ]
}
```

**Note:** Only 3 prompts are returned, required prompts are prioritized.

---

### POST /api/v1/profiles/me/prompt-answers

**Before:**
Request with 4 prompts would be accepted:
```json
{
  "answers": [
    { "promptId": "uuid-1", "answer": "Comedy and jokes" },
    { "promptId": "uuid-2", "answer": "Hiking in nature" },
    { "promptId": "uuid-3", "answer": "Technology and innovation" },
    { "promptId": "uuid-4", "answer": "I can juggle" }
  ]
}
```
✅ Would succeed (minimum 3 met)

**After:**
Request with 4 prompts is now rejected:
```json
{
  "answers": [
    { "promptId": "uuid-1", "answer": "Comedy and jokes" },
    { "promptId": "uuid-2", "answer": "Hiking in nature" },
    { "promptId": "uuid-3", "answer": "Technology and innovation" },
    { "promptId": "uuid-4", "answer": "I can juggle" }
  ]
}
```
❌ Validation error: "answers must contain no more than 3 elements"

Correct request (exactly 3):
```json
{
  "answers": [
    { "promptId": "uuid-1", "answer": "Comedy and jokes" },
    { "promptId": "uuid-2", "answer": "Hiking in nature" },
    { "promptId": "uuid-3", "answer": "Technology and innovation" }
  ]
}
```
✅ Would succeed (exactly 3)

---

### GET /api/v1/profiles/completion

**Before:**
```json
{
  "isComplete": false,
  "completionPercentage": 75,
  "requirements": {
    "minimumPrompts": {
      "required": 3,  // Based on number of required prompts in DB
      "current": 2,
      "satisfied": false,
      "missing": [
        { "id": "uuid-3", "text": "What are you most passionate about?" }
      ]
    }
  }
}
```

**After:**
```json
{
  "isComplete": false,
  "completionPercentage": 75,
  "requirements": {
    "minimumPrompts": {
      "required": 3,  // Always 3, aligned with frontend
      "current": 2,
      "satisfied": false,
      "missing": [
        { "id": "uuid-3", "text": "What are you most passionate about?" }
      ]
    }
  },
  "nextStep": "Answer 1 more prompt"  // Clear message
}
```

---

## Validation Logic Changes

### Before: Complex Required Prompts Validation
```typescript
// Get required prompts to validate answers
const requiredPrompts = await this.promptRepository.find({
  where: { isActive: true, isRequired: true },
});

// Validate that all required prompts are answered
const answeredPromptIds = new Set(answers.map((a) => a.promptId));
const missingRequired = requiredPrompts.filter(
  (p) => !answeredPromptIds.has(p.id),
);

if (missingRequired.length > 0) {
  throw new BadRequestException({
    message: `Missing answers for required prompts: ${missingRequired.map((p) => p.text).join(', ')}`,
    missingPrompts: missingRequired.map((p) => p.id),
  });
}
```

### After: Simple Active Prompts Validation
```typescript
// Validate that answered prompts exist and are active
const allPrompts = await this.promptRepository.find({
  where: { isActive: true },
});
const activePromptIds = new Set(allPrompts.map((p) => p.id));

const invalidAnswers = answers.filter(
  (a) => !activePromptIds.has(a.promptId),
);

if (invalidAnswers.length > 0) {
  throw new BadRequestException(
    'Some prompts are invalid or inactive: ' +
      invalidAnswers.map((a) => a.promptId).join(', '),
  );
}
```

**Note:** The DTO validation (`@ArrayMinSize(3)` and `@ArrayMaxSize(3)`) ensures exactly 3 prompts, so no need to check in the service.

---

## Profile Completion Check Changes

### Before: Check All Required Prompts
```typescript
// Get required prompts and check if user has answered all of them
const requiredPrompts = await this.promptRepository.find({
  where: { isActive: true, isRequired: true },
});

const answeredPromptIds = new Set(
  (user.profile.promptAnswers || []).map((a) => a.promptId),
);

const missingRequiredPrompts = requiredPrompts.filter(
  (p) => !answeredPromptIds.has(p.id),
);

const hasPrompts = missingRequiredPrompts.length === 0;
```

### After: Check Exactly 3 Prompts
```typescript
// Check if user has answered exactly 3 prompts (required for completion)
const promptsCount = user.profile.promptAnswers?.length || 0;
const hasPrompts = promptsCount >= 3;

// Get available prompts for missing information (only the 3 prompts we offer)
const availablePrompts = await this.promptRepository.find({
  where: { isActive: true },
  order: { isRequired: 'DESC', order: 'ASC' },
  take: 3,
});

const answeredPromptIds = new Set(
  (user.profile.promptAnswers || []).map((a) => a.promptId),
);

const missingPrompts = availablePrompts.filter(
  (p) => !answeredPromptIds.has(p.id),
);
```

**Note:** Much simpler logic, just checks if count >= 3.

---

## Summary

The changes make the system:
1. **More consistent** - Backend matches frontend limitation
2. **Simpler** - Less complex validation logic
3. **Clearer** - Users know they need exactly 3 prompts
4. **Better UX** - Fewer choices makes decision easier
