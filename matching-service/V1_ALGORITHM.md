# V1 Matching Algorithm Implementation

## Overview

The V1 matching algorithm implements content-based filtering using personality quiz responses, shared interests, and values alignment to calculate compatibility scores between users.

## Algorithm Components

### 1. Personality Compatibility (40% weight)

Calculates similarity based on personality quiz answers across four categories:

#### Categories
- **Communication** (25%): How users prefer to communicate and express themselves
- **Values** (25%): Core life values and priorities
- **Lifestyle** (25%): Daily routines, habits, and lifestyle preferences
- **Personality** (25%): Core personality traits and characteristics

#### Calculation Methods

##### Numeric Answers (Scale 1-10)
```python
similarity = (max_distance - distance) / max_distance
```
Where `distance = abs(answer1 - answer2)` and `max_distance = 10`

**Example:**
- User 1 answers: 8 (extroverted)
- User 2 answers: 7 (extroverted)
- Distance: 1
- Similarity: (10 - 1) / 10 = 0.9 (90%)

##### Boolean Answers (Yes/No)
```python
similarity = 1.0 if answer1 == answer2 else 0.0
```

**Example:**
- Q: "Do you want children?"
- Both answer: Yes → 100% similarity
- Different answers → 0% similarity

##### Multiple Choice Answers
Uses Jaccard similarity coefficient:
```python
similarity = len(common) / len(total)
```

**Example:**
- User 1 interests: ["hiking", "reading", "travel"]
- User 2 interests: ["reading", "travel", "cooking"]
- Common: {"reading", "travel"} = 2
- Total: 5 unique interests
- Similarity: 2/5 = 0.4 (40%)

##### Text Answers
Normalized string comparison (case-insensitive):
```python
similarity = 1.0 if text1.lower() == text2.lower() else 0.5
```

### 2. Interests Compatibility (30% weight)

Calculates overlap in declared interests and hobbies.

#### Shared Interests Detection
```python
shared = set(user1_interests) & set(user2_interests)
total = set(user1_interests) | set(user2_interests)
score = len(shared) / len(total) if total else 0.0
```

#### Scoring Rules
- No shared interests: 30% baseline score
- 1-2 shared interests: 50-70% score
- 3+ shared interests: 70-100% score

**Example:**
- User 1: ["yoga", "photography", "cooking", "travel"]
- User 2: ["yoga", "travel", "reading"]
- Shared: {"yoga", "travel"} = 2 interests
- Score: ~65%

### 3. Values Compatibility (30% weight)

Evaluates alignment on relationship goals and life priorities.

#### Values Categories
- Relationship intentions (serious, casual, friendship)
- Family planning preferences
- Career priorities
- Location/travel preferences
- Religious/spiritual views
- Political views

#### Calculation
Based on specific personality questions tagged with `category: "values"`:
```python
values_answers = [a for a in answers if a.category == "values"]
values_score = calculate_similarity(values_answers)
```

### 4. Final Score Calculation

```python
final_score = (
    personality_score * 0.40 +
    interests_score * 0.30 +
    values_score * 0.30
) * 100
```

Result is normalized to 0-100 scale.

## Match Reasons Generation

The algorithm generates human-readable explanations based on compatibility breakdown:

### High Compatibility (80-100)
- "Très forte compatibilité de personnalité"
- "Objectifs relationnels très compatibles"

### Good Compatibility (65-79)
- "Bonne compatibilité de personnalité"
- "Objectifs relationnels compatibles"

### Moderate Compatibility (50-64)
- "Compatibilité de personnalité prometteuse"

### Specific Factors
- Communication: "Style de communication compatible"
- Lifestyle: "Style de vie similaire"
- Values: "Valeurs de vie alignées"

### Shared Interests
- 3+ interests: "Intérêts communs : [list up to 3]"
- 1-2 interests: "X centres d'intérêt en commun"

## Filtering Criteria

Before calculating compatibility, profiles are filtered by basic criteria:

### Required Filters
1. **Active Profile**: Profile status must be "active"
2. **Self-Exclusion**: Current user is excluded
3. **Manual Exclusion**: Users in `excludeUserIds` are excluded

### Preference-Based Filters (Future Enhancement)
1. **Age Range**: User age within target's min/max age preference
2. **Gender**: User gender matches target's interested genders
3. **Distance**: Geographic distance within max distance preference
4. **Relationship Status**: Compatible relationship intentions

## Performance Characteristics

### Time Complexity
- Single compatibility calculation: O(n) where n = number of questions
- Selection generation: O(m * n) where m = available profiles
- Typical execution time: <100ms per calculation

### Caching Strategy
- Results cached with Redis (1-hour TTL)
- Cache key: `compat:v1:{user1_id}:{user2_id}`
- Bidirectional caching: same result for (A,B) and (B,A)

## Example Calculation

Given two user profiles:

**User A:**
```json
{
  "personalityAnswers": [
    {"questionId": "q1", "category": "personality", "numericAnswer": 8},
    {"questionId": "q2", "category": "values", "booleanAnswer": true},
    {"questionId": "q3", "category": "lifestyle", "numericAnswer": 7}
  ],
  "interests": ["hiking", "reading", "travel"]
}
```

**User B:**
```json
{
  "personalityAnswers": [
    {"questionId": "q1", "category": "personality", "numericAnswer": 7},
    {"questionId": "q2", "category": "values", "booleanAnswer": true},
    {"questionId": "q3", "category": "lifestyle", "numericAnswer": 6}
  ],
  "interests": ["hiking", "photography", "travel"]
}
```

**Calculation:**

1. **Personality Score:**
   - Q1: (10 - |8-7|) / 10 = 0.9
   - Q2: 1.0 (both true)
   - Q3: (10 - |7-6|) / 10 = 0.9
   - Average: 0.933

2. **Interests Score:**
   - Shared: {"hiking", "travel"} = 2
   - Total: 4 unique interests
   - Score: 2/4 = 0.5 → Adjusted to 0.65

3. **Values Score:**
   - Q2 (values): 1.0
   - Score: 1.0

4. **Final Score:**
   ```
   (0.933 × 0.40) + (0.65 × 0.30) + (1.0 × 0.30) = 0.868
   0.868 × 100 = 86.8
   ```

5. **Match Reasons:**
   - "Très forte compatibilité de personnalité"
   - "Intérêts communs : hiking, travel"
   - "Objectifs relationnels très compatibles"

**Result:** 86.8% compatibility

## Strengths

1. **Interpretable**: Clear breakdown of score components
2. **Balanced**: Equal weight to personality, interests, and values
3. **Fast**: Simple calculations, easily cached
4. **Privacy-Friendly**: No behavioral tracking required
5. **Fair**: Same algorithm for all users

## Limitations

1. **Cold Start**: Requires complete profile and quiz responses
2. **Static**: Doesn't learn from user behavior
3. **No Context**: Doesn't consider activity level or response rates
4. **Binary Matches**: Doesn't model reciprocity likelihood

## Future Enhancements (V2)

V2 algorithm addresses V1 limitations by adding:
- Activity-based scoring
- Response rate analysis
- Reciprocity prediction
- Machine learning components

See V2 documentation for details.

---

## Implementation Notes

### Code Location
- Main algorithm: `services/compatibility_calculator.py`
- Endpoints: `main.py` (lines 373-547)
- Tests: `tests/test_v1_spec_endpoints.py`

### Database Requirements
- PostgreSQL with `users`, `profiles`, `personality_answers` tables
- Read-only access sufficient
- Connection is optional (fallback to full-profile endpoints)

### Configuration
```bash
# Required for V1 spec endpoints
DATABASE_URL=postgresql://user:pass@host:5432/db

# Optional for performance
REDIS_HOST=localhost
CACHE_ENABLED=true
```

---

**Last Updated:** October 13, 2025  
**Algorithm Version:** 1.0  
**Implementation Status:** ✅ Complete
