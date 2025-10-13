# Matching Service API Documentation

## Overview

The GoldWen Matching Service is a FastAPI-based microservice that provides sophisticated matching algorithms for the dating app. It implements both V1 (personality-based) and V2 (advanced behavioral) scoring algorithms.

## Authentication

All endpoints (except `/health`) require an API key in the request header:

```
X-API-Key: your-api-key
```

Set the API key via environment variable:
```bash
export API_KEY=your-secret-key
```

## Endpoints

### 1. Health Check

Check if the service is running and healthy.

**Endpoint:** `GET /health`

**Headers:** None required

**Response:**
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2025-10-13T15:00:00.000Z"
}
```

---

### 2. Generate Selection (V1 Spec)

Generate a selection of 3-5 compatible profiles for a user using the V1 matching algorithm.

**Endpoint:** `POST /api/matching/generate-selection`

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "count": 5,
  "excludeUserIds": [
    "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "6ba7b811-9dad-11d1-80b4-00c04fd430c8"
  ]
}
```

**Request Parameters:**
- `userId` (string, required): UUID of the user requesting matches
- `count` (integer, required): Number of profiles to return (3-5)
- `excludeUserIds` (array, optional): UUIDs of users to exclude from selection

**Response:**
```json
{
  "selection": [
    {
      "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
      "compatibilityScore": 87.5,
      "scoreBreakdown": {
        "personality": 85.0,
        "interests": 90.0,
        "values": 88.0
      },
      "matchReasons": [
        "Très forte compatibilité de personnalité",
        "Intérêts communs : hiking, reading, travel",
        "Objectifs relationnels très compatibles"
      ]
    },
    {
      "userId": "8d9e7680-8536-51ef-a05c-f18fd2f91bf8",
      "compatibilityScore": 82.3,
      "scoreBreakdown": {
        "personality": 80.0,
        "interests": 85.0,
        "values": 82.0
      },
      "matchReasons": [
        "Bonne compatibilité de personnalité",
        "Style de communication compatible",
        "2 centres d'intérêt en commun"
      ]
    }
  ],
  "generatedAt": "2025-10-13T15:00:00.000Z"
}
```

**Algorithm Details:**

The V1 algorithm calculates compatibility based on three factors:

1. **Personality (40%)**: Based on personality quiz answers
   - Communication style compatibility
   - Values alignment
   - Lifestyle preferences
   - Core personality traits

2. **Interests (30%)**: Based on shared interests and hobbies
   - Direct interest matching
   - Interest category overlap

3. **Values (30%)**: Based on relationship goals and life values
   - Relationship intentions
   - Life priorities
   - Future goals

**Error Responses:**

- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: User not found in database
- `422 Unprocessable Entity`: Invalid request parameters (e.g., count not in 3-5 range)
- `503 Service Unavailable`: Database connection not available

---

### 3. Calculate Compatibility (V1 Spec)

Calculate the compatibility score between two specific users.

**Endpoint:** `POST /api/matching/calculate-compatibility`

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId1": "550e8400-e29b-41d4-a716-446655440000",
  "userId2": "7c9e6679-7425-40de-944b-e07fc1f90ae7"
}
```

**Response:**
```json
{
  "score": 87.5,
  "breakdown": {
    "personality": 85.0,
    "interests": 90.0,
    "values": 88.0
  },
  "matchReasons": [
    "Très forte compatibilité de personnalité",
    "Intérêts communs : hiking, reading, travel",
    "Valeurs de vie alignées",
    "Style de communication compatible"
  ]
}
```

**Error Responses:**

- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: One or both users not found
- `503 Service Unavailable`: Database connection not available

---

### 4. Calculate Compatibility V1 (Full Profile)

Calculate V1 compatibility when full profile data is provided (no database required).

**Endpoint:** `POST /api/v1/matching-service/calculate-compatibility`

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:**
```json
{
  "user1Profile": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "age": 28,
    "interests": ["hiking", "reading", "travel"],
    "personalityAnswers": [
      {
        "questionId": "q1",
        "category": "personality",
        "numericAnswer": 8
      }
    ],
    "preferences": {
      "minAge": 25,
      "maxAge": 35,
      "maxDistance": 50
    }
  },
  "user2Profile": {
    "userId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "age": 30,
    "interests": ["hiking", "photography", "travel"],
    "personalityAnswers": [
      {
        "questionId": "q1",
        "category": "personality",
        "numericAnswer": 7
      }
    ]
  }
}
```

**Response:**
```json
{
  "compatibilityScore": 87.5,
  "details": {
    "communication": 0.85,
    "values": 0.88,
    "lifestyle": 0.90,
    "personality": 0.82
  },
  "sharedInterests": ["hiking", "travel"]
}
```

---

### 5. Calculate Compatibility V2 (Advanced)

Calculate compatibility using both personality and behavioral factors.

**Endpoint:** `POST /api/v1/matching/calculate-compatibility-v2`

**Headers:**
```
X-API-Key: your-api-key
Content-Type: application/json
```

**Request Body:** Same as V1 but includes activity metrics:
```json
{
  "user1Profile": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "age": 28,
    "interests": ["hiking", "reading"],
    "personalityAnswers": [...],
    "lastActiveAt": "2025-10-13T14:30:00Z",
    "lastLoginAt": "2025-10-13T14:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "messagesSent": 50,
    "messagesReceived": 45,
    "matchesCount": 8
  },
  "user2Profile": {
    ...
  }
}
```

**Response:**
```json
{
  "compatibilityScore": 89.2,
  "version": "v2",
  "details": {
    "communication": 0.85,
    "values": 0.88,
    "lifestyle": 0.90,
    "personality": 0.82
  },
  "advancedFactors": {
    "userActivity": 0.92,
    "targetActivity": 0.88,
    "userResponseRate": 0.85,
    "targetResponseRate": 0.90,
    "potentialReciprocity": 0.87,
    "advancedScore": 0.88
  },
  "sharedInterests": ["hiking", "reading"],
  "scoringWeights": {
    "v1Weight": 0.6,
    "v2Weight": 0.4
  }
}
```

**V2 Algorithm Details:**

- **V1 Personality Score (60%)**: Same as V1 algorithm
- **V2 Advanced Score (40%)**: Based on:
  - User Activity (30%): Recent login and engagement
  - Response Rate (40%): Message conversation balance
  - Potential Reciprocity (30%): Mutual interest likelihood

---

### 6. Generate Daily Selection (Full Profiles)

Generate daily selection when full profile data is provided.

**Endpoint:** `POST /api/v1/matching-service/generate-daily-selection`

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userProfile": { /* full profile */ },
  "availableProfiles": [
    { /* profile 1 */ },
    { /* profile 2 */ }
  ],
  "selectionSize": 5
}
```

**Response:**
```json
{
  "selectedProfiles": [
    "user-id-1",
    "user-id-2",
    "user-id-3"
  ],
  "scores": {
    "user-id-1": 87.5,
    "user-id-2": 85.2,
    "user-id-3": 82.8
  }
}
```

---

### 7. Batch Compatibility

Calculate compatibility scores for multiple profiles at once.

**Endpoint:** `POST /api/v1/matching-service/batch-compatibility`

**Request Body:**
```json
{
  "baseProfile": { /* full profile */ },
  "profilesToCompare": [
    { /* profile 1 */ },
    { /* profile 2 */ }
  ]
}
```

**Response:**
```json
{
  "results": {
    "user-id-1": {
      "compatibilityScore": 87.5,
      "details": { /* detailed scores */ },
      "sharedInterests": ["hiking"]
    },
    "user-id-2": {
      "compatibilityScore": 82.3,
      "details": { /* detailed scores */ },
      "sharedInterests": ["reading"]
    }
  }
}
```

---

### 8. Get Recommendations

Get pre-calculated recommendations for a user.

**Endpoint:** `GET /api/v1/matching/recommendations/{userId}`

**Response:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "recommendations": [
    {
      "userId": "user-id-1",
      "compatibilityScore": 87.5,
      "reasons": ["High personality match", "Shared interests"]
    }
  ],
  "totalAvailable": 10,
  "generatedAt": "2025-10-13T15:00:00.000Z"
}
```

---

### 9. Algorithm Statistics

Get statistics about the matching algorithm performance.

**Endpoint:** `GET /api/v1/matching-service/algorithm/stats`

**Response:**
```json
{
  "totalCalculations": 15420,
  "averageScore": 67.8,
  "lastUpdate": "2025-10-13T15:00:00.000Z",
  "status": "online",
  "version": "v2"
}
```

---

## Error Handling

All endpoints return standard HTTP status codes:

- `200 OK`: Successful request
- `401 Unauthorized`: Missing or invalid API key
- `404 Not Found`: Resource not found
- `422 Unprocessable Entity`: Invalid request parameters
- `500 Internal Server Error`: Server error
- `503 Service Unavailable`: Service dependency unavailable (e.g., database)

Error response format:
```json
{
  "detail": "Error message description"
}
```

---

## Rate Limiting

Currently, no rate limiting is implemented. For production deployment, consider implementing rate limiting at the API gateway level.

---

## Caching

The service uses Redis for caching compatibility calculations:

- Cache TTL: Configurable (default 1 hour)
- Cache keys include user IDs and algorithm version
- Automatic cache invalidation on profile updates (requires integration)

---

## Performance

Typical response times:
- Single compatibility calculation: < 100ms (cached: < 10ms)
- Generate selection (5 profiles): < 500ms
- Batch compatibility (10 profiles): < 800ms

---

## Testing

The service includes comprehensive tests with >80% coverage:

```bash
# Run all tests
pytest

# Run with coverage report
pytest --cov=. --cov-report=term-missing

# Run specific endpoint tests
pytest tests/test_v1_spec_endpoints.py
```

---

## Deployment

### Docker

```bash
docker build -t goldwen-matching-service .
docker run -p 8000:8000 \
  -e API_KEY=your-secret-key \
  -e DATABASE_URL=postgresql://user:pass@host:5432/db \
  goldwen-matching-service
```

### Docker Compose

```yaml
matching-service:
  build: ./matching-service
  ports:
    - "8000:8000"
  environment:
    - API_KEY=${API_KEY}
    - DATABASE_URL=${DATABASE_URL}
    - REDIS_HOST=redis
  depends_on:
    - redis
    - postgres
```

---

## Integration with NestJS API

The matching service is designed to be called by the main NestJS API:

```typescript
// NestJS service example
async calculateCompatibility(userId1: string, userId2: string) {
  const response = await fetch('http://matching-service:8000/api/matching/calculate-compatibility', {
    method: 'POST',
    headers: {
      'X-API-Key': process.env.MATCHING_SERVICE_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId1, userId2 })
  });
  
  return response.json();
}
```

---

## Support

For issues or questions, please refer to:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`
- GitHub Issues: [Repository Issues](https://github.com/marcucus/GoldWen-App-Backend/issues)
