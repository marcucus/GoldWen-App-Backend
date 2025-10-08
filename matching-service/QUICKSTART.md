# Quick Start Guide - Matching Service V2

This guide helps you get the matching service running quickly.

## Prerequisites

- Python 3.12+ installed
- pip package manager

## Installation

1. Navigate to the matching-service directory:
```bash
cd matching-service
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Running the Service

### Development Mode

```bash
python main.py
```

The service will start on `http://localhost:8000`

### Production Mode

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## Testing the Service

### Run all tests
```bash
pytest
```

### Run tests with coverage
```bash
pytest --cov=services --cov=main --cov-report=html
```

### Run performance benchmark
```bash
python benchmark.py
```

## API Documentation

Once the service is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Quick API Test

### Health Check
```bash
curl http://localhost:8000/health
```

### Calculate Compatibility V2
```bash
curl -X POST http://localhost:8000/api/v1/matching/calculate-compatibility-v2 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: matching-service-secret-key" \
  -d '{
    "user1Profile": {
      "userId": "user1",
      "age": 28,
      "interests": ["hiking", "reading"],
      "personalityAnswers": [
        {"questionId": "q1", "numericAnswer": 7, "category": "values"}
      ],
      "lastActiveAt": "2025-01-07T12:00:00Z",
      "messagesSent": 50,
      "messagesReceived": 50,
      "matchesCount": 5
    },
    "user2Profile": {
      "userId": "user2",
      "age": 30,
      "interests": ["reading", "travel"],
      "personalityAnswers": [
        {"questionId": "q1", "numericAnswer": 8, "category": "values"}
      ],
      "lastActiveAt": "2025-01-07T10:00:00Z",
      "messagesSent": 40,
      "messagesReceived": 45,
      "matchesCount": 4
    }
  }'
```

## Integration with Main API

The main NestJS API automatically connects to this service. Ensure:

1. Matching service is running on `http://localhost:8000`
2. API key matches in both services (default: `matching-service-secret-key`)
3. Main API environment variable `MATCHING_SERVICE_URL` is set correctly

## Environment Variables

Create a `.env` file (optional):

```env
# API Configuration
API_KEY=matching-service-secret-key
HOST=0.0.0.0
PORT=8000

# Logging
LOG_LEVEL=info
```

## Troubleshooting

### Service won't start
- Check Python version: `python --version` (need 3.12+)
- Reinstall dependencies: `pip install -r requirements.txt --force-reinstall`

### Tests failing
- Ensure all dependencies installed
- Run: `pip install pytest pytest-asyncio httpx`

### Connection refused from main API
- Verify matching service is running on port 8000
- Check firewall settings
- Verify API key matches

## Next Steps

- Review the [README.md](README.md) for detailed documentation
- Check [API_ROUTES.md](../API_ROUTES.md) for endpoint specifications
- Run the benchmark to understand performance characteristics

## Support

For issues or questions, please refer to the main repository documentation.
