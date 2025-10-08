# GoldWen Matching Service

Advanced matching algorithm service with V1 and V2 scoring for the GoldWen dating app.

## Features

### V1 Algorithm (Personality-Based)
- Content-based filtering using personality quiz answers
- Compatibility scoring across multiple categories:
  - Communication style
  - Core values
  - Lifestyle preferences
  - Personality traits
- Shared interests detection
- **Redis caching for improved performance**

### V2 Algorithm (Advanced Scoring)
V2 enhances V1 with behavioral and activity-based factors:

#### Advanced Scoring Factors
1. **User Activity Score (30% weight)**
   - Recent login and activity tracking
   - Exponential decay scoring (more weight to recent activity)
   - Encourages matching with active users

2. **Response Rate Score (40% weight)**
   - Message sending/receiving ratio
   - Penalizes non-responsive users
   - Rewards balanced conversation participants
   - Detects spam behavior

3. **Potential Reciprocity Score (30% weight)**
   - Mutual interests matching
   - Dealbreaker alignment (age, distance, gender preferences)
   - Personality compatibility baseline

### Scoring Weights
- V1 (Personality): 60%
- V2 (Advanced): 40%

## Installation

```bash
pip install -r requirements.txt
```

## Running the Service

```bash
# Development
python main.py

# Production with uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000
```

The service will be available at `http://localhost:8000`

## API Documentation

Once running, visit:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API Endpoints

### Health Check
```
GET /health
```

### V1 Compatibility (Personality-Based)
```
POST /api/v1/matching-service/calculate-compatibility
Headers: X-API-Key: <api-key>
```

### V2 Compatibility (Advanced Scoring)
```
POST /api/v1/matching/calculate-compatibility-v2
Headers: X-API-Key: <api-key>
```

### Batch Compatibility
```
POST /api/v1/matching-service/batch-compatibility
Headers: X-API-Key: <api-key>
```

### Generate Daily Selection
```
POST /api/v1/matching-service/generate-daily-selection
Headers: X-API-Key: <api-key>
```

### Get Recommendations
```
GET /api/v1/matching/recommendations/:userId
Headers: X-API-Key: <api-key>
```

### Algorithm Statistics
```
GET /api/v1/matching-service/algorithm/stats
Headers: X-API-Key: <api-key>
```

## Testing

Run all tests:
```bash
pytest
```

Run with coverage:
```bash
pytest --cov=services --cov=main
```

Run specific test file:
```bash
pytest tests/test_advanced_scoring.py
```

## Configuration

### Environment Variables

The matching service supports the following environment variables:

```bash
# API Key (recommended for production)
export MATCHING_SERVICE_API_KEY=your-secret-key

# Redis Configuration
export REDIS_HOST=localhost        # Default: localhost
export REDIS_PORT=6379             # Default: 6379
export REDIS_DB=0                  # Default: 0
export CACHE_TTL=3600              # Cache TTL in seconds, Default: 3600 (1 hour)
export CACHE_ENABLED=true          # Enable/disable caching, Default: true
```

### Docker Deployment

Build and run with Docker Compose:
```bash
# Build and start all services (including Redis)
docker-compose up --build matching-service

# Or run individually
cd matching-service
docker build -t goldwen-matching-service .
docker run -p 8000:8000 -e REDIS_HOST=redis goldwen-matching-service
```

The service includes:
- Health checks for monitoring
- Redis caching for performance
- Graceful fallback when Redis is unavailable
- Multi-stage Docker build for optimized image size

## Architecture

```
matching-service/
├── main.py                      # FastAPI application
├── models/
│   └── schemas.py              # Pydantic request/response models
├── services/
│   ├── advanced_scoring.py     # V2 advanced scoring algorithms
│   └── compatibility_calculator.py  # V1 & V2 compatibility logic
├── tests/
│   ├── test_advanced_scoring.py     # Unit tests for advanced scoring
│   ├── test_compatibility_calculator.py  # Unit tests for calculator
│   └── test_api.py                 # Integration tests for API
├── requirements.txt            # Python dependencies
└── README.md                   # This file
```

## Performance Considerations

- All scoring algorithms are optimized for O(n) complexity
- Batch processing supported for multiple profile comparisons
- Stateless design allows horizontal scaling
- In-memory statistics tracking (consider Redis for production)

## Security

- API key authentication required for all endpoints
- CORS configured (adjust for production)
- Input validation via Pydantic models
- Error handling and logging

## Future Enhancements

- Machine learning model integration
- Caching layer for frequently calculated scores
- A/B testing framework for algorithm versions
- Real-time score updates based on user interactions
- Feedback loop for continuous improvement
