"""
Integration tests for the matching service API endpoints.
"""

import pytest
from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)
API_KEY = "matching-service-secret-key"


class TestHealthEndpoint:
    """Test suite for health check endpoint."""

    def test_health_check_success(self):
        """Health check should return 200 OK."""
        response = client.get("/health")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.0.0"
        assert "timestamp" in data


class TestCalculateCompatibilityV1:
    """Test suite for V1 compatibility endpoint."""

    def test_calculate_compatibility_v1_success(self):
        """V1 compatibility calculation should succeed with valid data."""
        now = datetime.now()
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "age": 28,
                "interests": ["hiking", "reading"],
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 7, "category": "values"}
                ],
            },
            "user2Profile": {
                "userId": "user2",
                "age": 30,
                "interests": ["reading", "travel"],
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 8, "category": "values"}
                ],
            },
        }
        
        response = client.post(
            "/api/v1/matching-service/calculate-compatibility",
            json=request_data,
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "compatibilityScore" in data
        assert "details" in data
        assert "sharedInterests" in data
        assert 0 <= data["compatibilityScore"] <= 100
        assert "reading" in data["sharedInterests"]

    def test_calculate_compatibility_v1_no_api_key(self):
        """V1 endpoint should reject requests without API key."""
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "personalityAnswers": [],
            },
            "user2Profile": {
                "userId": "user2",
                "personalityAnswers": [],
            },
        }
        
        response = client.post(
            "/api/v1/matching-service/calculate-compatibility",
            json=request_data,
        )
        
        assert response.status_code == 422  # Missing required header

    def test_calculate_compatibility_v1_invalid_api_key(self):
        """V1 endpoint should reject invalid API key."""
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "personalityAnswers": [],
            },
            "user2Profile": {
                "userId": "user2",
                "personalityAnswers": [],
            },
        }
        
        response = client.post(
            "/api/v1/matching-service/calculate-compatibility",
            json=request_data,
            headers={"X-API-Key": "invalid-key"},
        )
        
        assert response.status_code == 401


class TestCalculateCompatibilityV2:
    """Test suite for V2 compatibility endpoint."""

    def test_calculate_compatibility_v2_success(self):
        """V2 compatibility calculation should succeed with valid data."""
        now = datetime.now()
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "age": 28,
                "interests": ["hiking", "reading"],
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 7, "category": "values"}
                ],
                "lastActiveAt": (now - timedelta(hours=12)).isoformat(),
                "lastLoginAt": (now - timedelta(hours=10)).isoformat(),
                "createdAt": (now - timedelta(days=30)).isoformat(),
                "messagesSent": 50,
                "messagesReceived": 50,
                "matchesCount": 5,
            },
            "user2Profile": {
                "userId": "user2",
                "age": 30,
                "interests": ["reading", "travel"],
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 8, "category": "values"}
                ],
                "lastActiveAt": (now - timedelta(hours=8)).isoformat(),
                "lastLoginAt": (now - timedelta(hours=6)).isoformat(),
                "createdAt": (now - timedelta(days=25)).isoformat(),
                "messagesSent": 40,
                "messagesReceived": 45,
                "matchesCount": 4,
            },
        }
        
        response = client.post(
            "/api/v1/matching/calculate-compatibility-v2",
            json=request_data,
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "compatibilityScore" in data
        assert data["version"] == "v2"
        assert "details" in data
        assert "advancedFactors" in data
        assert "sharedInterests" in data
        assert "scoringWeights" in data
        assert 0 <= data["compatibilityScore"] <= 100

    def test_calculate_compatibility_v2_has_advanced_factors(self):
        """V2 response should include all advanced factors."""
        now = datetime.now()
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 7, "category": "values"}
                ],
                "lastActiveAt": (now - timedelta(hours=12)).isoformat(),
                "messagesSent": 50,
                "messagesReceived": 50,
                "matchesCount": 5,
            },
            "user2Profile": {
                "userId": "user2",
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 8, "category": "values"}
                ],
                "lastActiveAt": (now - timedelta(hours=8)).isoformat(),
                "messagesSent": 40,
                "messagesReceived": 45,
                "matchesCount": 4,
            },
        }
        
        response = client.post(
            "/api/v1/matching/calculate-compatibility-v2",
            json=request_data,
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        factors = data["advancedFactors"]
        assert "activityScore" in factors
        assert "responseRateScore" in factors
        assert "reciprocityScore" in factors
        assert "details" in factors

    def test_calculate_compatibility_v2_no_api_key(self):
        """V2 endpoint should reject requests without API key."""
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "personalityAnswers": [],
            },
            "user2Profile": {
                "userId": "user2",
                "personalityAnswers": [],
            },
        }
        
        response = client.post(
            "/api/v1/matching/calculate-compatibility-v2",
            json=request_data,
        )
        
        assert response.status_code == 422  # Missing required header

    def test_calculate_compatibility_v2_invalid_api_key(self):
        """V2 endpoint should reject invalid API key."""
        request_data = {
            "user1Profile": {
                "userId": "user1",
                "personalityAnswers": [],
            },
            "user2Profile": {
                "userId": "user2",
                "personalityAnswers": [],
            },
        }
        
        response = client.post(
            "/api/v1/matching/calculate-compatibility-v2",
            json=request_data,
            headers={"X-API-Key": "invalid-key"},
        )
        
        assert response.status_code == 401


class TestBatchCompatibility:
    """Test suite for batch compatibility endpoint."""

    def test_batch_compatibility_success(self):
        """Batch compatibility should calculate for multiple profiles."""
        request_data = {
            "baseProfile": {
                "userId": "user1",
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 7, "category": "values"}
                ],
                "interests": ["hiking", "reading"],
            },
            "profilesToCompare": [
                {
                    "userId": "user2",
                    "personalityAnswers": [
                        {"questionId": "q1", "numericAnswer": 8, "category": "values"}
                    ],
                    "interests": ["reading", "travel"],
                },
                {
                    "userId": "user3",
                    "personalityAnswers": [
                        {"questionId": "q1", "numericAnswer": 6, "category": "values"}
                    ],
                    "interests": ["hiking", "cooking"],
                },
            ],
        }
        
        response = client.post(
            "/api/v1/matching-service/batch-compatibility",
            json=request_data,
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "results" in data
        assert "user2" in data["results"]
        assert "user3" in data["results"]


class TestDailySelection:
    """Test suite for daily selection endpoint."""

    def test_generate_daily_selection_success(self):
        """Daily selection should generate top matches."""
        request_data = {
            "userId": "user1",
            "userProfile": {
                "userId": "user1",
                "personalityAnswers": [
                    {"questionId": "q1", "numericAnswer": 7, "category": "values"}
                ],
                "interests": ["hiking", "reading"],
            },
            "availableProfiles": [
                {
                    "userId": "user2",
                    "personalityAnswers": [
                        {"questionId": "q1", "numericAnswer": 8, "category": "values"}
                    ],
                    "interests": ["reading", "travel"],
                },
                {
                    "userId": "user3",
                    "personalityAnswers": [
                        {"questionId": "q1", "numericAnswer": 6, "category": "values"}
                    ],
                    "interests": ["hiking", "cooking"],
                },
                {
                    "userId": "user4",
                    "personalityAnswers": [
                        {"questionId": "q1", "numericAnswer": 2, "category": "values"}
                    ],
                    "interests": ["gaming"],
                },
            ],
            "selectionSize": 2,
        }
        
        response = client.post(
            "/api/v1/matching-service/generate-daily-selection",
            json=request_data,
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "selectedProfiles" in data
        assert "scores" in data
        assert len(data["selectedProfiles"]) == 2


class TestAlgorithmStats:
    """Test suite for algorithm stats endpoint."""

    def test_get_algorithm_stats_success(self):
        """Algorithm stats should return metrics."""
        response = client.get(
            "/api/v1/matching-service/algorithm/stats",
            headers={"X-API-Key": API_KEY},
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "totalCalculations" in data
        assert "averageScore" in data
        assert "lastUpdate" in data
        assert data["status"] == "online"
        assert data["version"] == "v2"

    def test_get_algorithm_stats_no_api_key(self):
        """Stats endpoint should reject requests without API key."""
        response = client.get("/api/v1/matching-service/algorithm/stats")
        
        assert response.status_code == 422

    def test_get_algorithm_stats_invalid_api_key(self):
        """Stats endpoint should reject invalid API key."""
        response = client.get(
            "/api/v1/matching-service/algorithm/stats",
            headers={"X-API-Key": "invalid-key"},
        )
        
        assert response.status_code == 401
