"""
Integration test to verify the matching service is properly set up and accessible.

This test simulates how the NestJS API would call the matching service.
"""

import pytest
import httpx
from typing import Dict, Any


# Service configuration
MATCHING_SERVICE_URL = "http://localhost:8000"
API_KEY = "matching-service-secret-key"


@pytest.mark.asyncio
async def test_service_health():
    """Test that the matching service is running and healthy."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MATCHING_SERVICE_URL}/health")
        
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_v1_calculate_compatibility_with_profiles():
    """
    Test V1 compatibility calculation with full profile data.
    This is how NestJS would call when database is not shared.
    """
    request_data = {
        "user1Profile": {
            "userId": "user-1",
            "age": 28,
            "interests": ["hiking", "reading", "travel"],
            "personalityAnswers": [
                {
                    "questionId": "q1",
                    "category": "personality",
                    "numericAnswer": 8
                },
                {
                    "questionId": "q2",
                    "category": "values",
                    "booleanAnswer": True
                }
            ]
        },
        "user2Profile": {
            "userId": "user-2",
            "age": 30,
            "interests": ["hiking", "photography", "travel"],
            "personalityAnswers": [
                {
                    "questionId": "q1",
                    "category": "personality",
                    "numericAnswer": 7
                },
                {
                    "questionId": "q2",
                    "category": "values",
                    "booleanAnswer": True
                }
            ]
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MATCHING_SERVICE_URL}/api/v1/matching-service/calculate-compatibility",
            json=request_data,
            headers={"X-API-Key": API_KEY}
        )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert "compatibilityScore" in data
    assert 0 <= data["compatibilityScore"] <= 100
    assert "details" in data
    assert "sharedInterests" in data
    
    # Verify shared interests
    assert "hiking" in data["sharedInterests"]
    assert "travel" in data["sharedInterests"]


@pytest.mark.asyncio
async def test_generate_daily_selection_with_profiles():
    """
    Test daily selection generation with full profile data.
    This endpoint is used when the NestJS API provides all profile data.
    """
    request_data = {
        "userId": "user-1",
        "userProfile": {
            "userId": "user-1",
            "age": 28,
            "interests": ["hiking", "reading"],
            "personalityAnswers": [
                {"questionId": "q1", "category": "personality", "numericAnswer": 8}
            ]
        },
        "availableProfiles": [
            {
                "userId": "user-2",
                "age": 30,
                "interests": ["hiking", "travel"],
                "personalityAnswers": [
                    {"questionId": "q1", "category": "personality", "numericAnswer": 7}
                ]
            },
            {
                "userId": "user-3",
                "age": 27,
                "interests": ["reading", "cooking"],
                "personalityAnswers": [
                    {"questionId": "q1", "category": "personality", "numericAnswer": 6}
                ]
            }
        ],
        "selectionSize": 2
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{MATCHING_SERVICE_URL}/api/v1/matching-service/generate-daily-selection",
            json=request_data,
            headers={"X-API-Key": API_KEY}
        )
    
    assert response.status_code == 200
    data = response.json()
    
    # Verify response structure
    assert "selectedProfiles" in data
    assert "scores" in data
    assert len(data["selectedProfiles"]) <= 2
    
    # Verify scores are provided for selected profiles
    for user_id in data["selectedProfiles"]:
        assert user_id in data["scores"]
        assert 0 <= data["scores"][user_id] <= 100


@pytest.mark.asyncio
async def test_api_key_required():
    """Test that endpoints require valid API key."""
    async with httpx.AsyncClient() as client:
        # Try with invalid API key
        response = await client.post(
            f"{MATCHING_SERVICE_URL}/api/v1/matching-service/calculate-compatibility",
            json={
                "user1Profile": {
                    "userId": "user-1",
                    "personalityAnswers": []
                },
                "user2Profile": {
                    "userId": "user-2",
                    "personalityAnswers": []
                }
            },
            headers={"X-API-Key": "invalid-key"}
        )
    
    assert response.status_code == 401  # Unauthorized with wrong API key


@pytest.mark.asyncio
async def test_swagger_ui_accessible():
    """Test that Swagger UI documentation is accessible."""
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{MATCHING_SERVICE_URL}/docs")
    
    assert response.status_code == 200
    assert "swagger" in response.text.lower()


if __name__ == "__main__":
    """
    Run integration tests manually.
    
    Before running:
    1. Start the matching service: python main.py
    2. Run: python tests/test_integration.py
    """
    import asyncio
    
    async def run_tests():
        print("Running integration tests...")
        print("\n1. Testing service health...")
        await test_service_health()
        print("✓ Health check passed")
        
        print("\n2. Testing V1 compatibility calculation...")
        await test_v1_calculate_compatibility_with_profiles()
        print("✓ Compatibility calculation passed")
        
        print("\n3. Testing daily selection generation...")
        await test_generate_daily_selection_with_profiles()
        print("✓ Daily selection passed")
        
        print("\n4. Testing API key validation...")
        await test_api_key_required()
        print("✓ API key validation passed")
        
        print("\n5. Testing Swagger UI...")
        await test_swagger_ui_accessible()
        print("✓ Swagger UI accessible")
        
        print("\n✅ All integration tests passed!")
    
    asyncio.run(run_tests())
