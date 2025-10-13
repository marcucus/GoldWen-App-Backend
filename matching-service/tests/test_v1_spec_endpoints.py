"""
Tests for the V1 specification endpoints.

These tests verify the new endpoints that match the TACHES_BACKEND.md specification:
- POST /api/matching/generate-selection
- POST /api/matching/calculate-compatibility
"""

import pytest
from httpx import AsyncClient
from fastapi import status

from main import app


# Test API key
TEST_API_KEY = "matching-service-secret-key"


class TestGenerateMatchReasons:
    """Tests for the generate_match_reasons function."""
    
    def test_high_compatibility_all_areas(self):
        """Test match reasons generation for high compatibility."""
        from services.compatibility_calculator import CompatibilityCalculator
        
        breakdown = {
            "personality": 85.0,
            "interests": 75.0,
            "values": 80.0,
        }
        shared_interests = ["hiking", "reading", "travel"]
        personality_details = {
            "communication": 0.80,
            "values": 0.85,
            "lifestyle": 0.78,
            "personality": 0.82,
        }
        
        reasons = CompatibilityCalculator.generate_match_reasons(
            breakdown, shared_interests, personality_details
        )
        
        assert len(reasons) > 0
        assert any("compatibilité de personnalité" in r.lower() for r in reasons)
        assert any("intérêts communs" in r.lower() for r in reasons)
    
    def test_low_compatibility_generic_reason(self):
        """Test that low compatibility still generates a reason."""
        from services.compatibility_calculator import CompatibilityCalculator
        
        breakdown = {
            "personality": 40.0,
            "interests": 30.0,
            "values": 35.0,
        }
        shared_interests = []
        personality_details = {
            "communication": 0.40,
            "values": 0.35,
            "lifestyle": 0.38,
            "personality": 0.42,
        }
        
        reasons = CompatibilityCalculator.generate_match_reasons(
            breakdown, shared_interests, personality_details
        )
        
        assert len(reasons) > 0
        assert any("profil intéressant" in r.lower() for r in reasons)
    
    def test_shared_interests_mentioned(self):
        """Test that shared interests are mentioned in reasons."""
        from services.compatibility_calculator import CompatibilityCalculator
        
        breakdown = {
            "personality": 70.0,
            "interests": 75.0,
            "values": 65.0,
        }
        shared_interests = ["yoga", "photography"]
        personality_details = {
            "communication": 0.70,
            "values": 0.65,
            "lifestyle": 0.72,
            "personality": 0.68,
        }
        
        reasons = CompatibilityCalculator.generate_match_reasons(
            breakdown, shared_interests, personality_details
        )
        
        # Check that at least one shared interest is mentioned
        reasons_text = " ".join(reasons).lower()
        assert "yoga" in reasons_text or "photography" in reasons_text or "centres d'intérêt" in reasons_text


class TestGenerateSelectionEndpoint:
    """Tests for POST /api/matching/generate-selection endpoint."""
    
    @pytest.mark.asyncio
    async def test_generate_selection_no_api_key(self):
        """Test that endpoint requires API key."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/generate-selection",
                json={
                    "userId": "user-123",
                    "count": 5,
                    "excludeUserIds": [],
                },
            )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_generate_selection_invalid_api_key(self):
        """Test that endpoint rejects invalid API key."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/generate-selection",
                json={
                    "userId": "user-123",
                    "count": 5,
                    "excludeUserIds": [],
                },
                headers={"X-API-Key": "invalid-key"},
            )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_generate_selection_without_db(self):
        """Test endpoint behavior without database connection."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/generate-selection",
                json={
                    "userId": "user-123",
                    "count": 5,
                    "excludeUserIds": [],
                },
                headers={"X-API-Key": TEST_API_KEY},
            )
        
        # Should return 503 if DB not available, or process if DB is available
        assert response.status_code in [
            status.HTTP_503_SERVICE_UNAVAILABLE,
            status.HTTP_404_NOT_FOUND,  # User not found (expected with test DB)
            status.HTTP_200_OK,
        ]
    
    @pytest.mark.asyncio
    async def test_generate_selection_validates_count(self):
        """Test that count parameter is validated (3-5)."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try count = 2 (too low)
            response = await client.post(
                "/api/matching/generate-selection",
                json={
                    "userId": "user-123",
                    "count": 2,
                    "excludeUserIds": [],
                },
                headers={"X-API-Key": TEST_API_KEY},
            )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
        
        async with AsyncClient(app=app, base_url="http://test") as client:
            # Try count = 6 (too high)
            response = await client.post(
                "/api/matching/generate-selection",
                json={
                    "userId": "user-123",
                    "count": 6,
                    "excludeUserIds": [],
                },
                headers={"X-API-Key": TEST_API_KEY},
            )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestCalculateCompatibilityV1Spec:
    """Tests for POST /api/matching/calculate-compatibility endpoint."""
    
    @pytest.mark.asyncio
    async def test_calculate_compatibility_no_api_key(self):
        """Test that endpoint requires API key."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/calculate-compatibility",
                json={
                    "userId1": "user-1",
                    "userId2": "user-2",
                },
            )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    
    @pytest.mark.asyncio
    async def test_calculate_compatibility_invalid_api_key(self):
        """Test that endpoint rejects invalid API key."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/calculate-compatibility",
                json={
                    "userId1": "user-1",
                    "userId2": "user-2",
                },
                headers={"X-API-Key": "invalid-key"},
            )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
    
    @pytest.mark.asyncio
    async def test_calculate_compatibility_without_db(self):
        """Test endpoint behavior without database connection."""
        async with AsyncClient(app=app, base_url="http://test") as client:
            response = await client.post(
                "/api/matching/calculate-compatibility",
                json={
                    "userId1": "user-1",
                    "userId2": "user-2",
                },
                headers={"X-API-Key": TEST_API_KEY},
            )
        
        # Should return 503 if DB not available, or process if DB is available
        assert response.status_code in [
            status.HTTP_503_SERVICE_UNAVAILABLE,
            status.HTTP_404_NOT_FOUND,  # Users not found (expected with test DB)
            status.HTTP_200_OK,
        ]


class TestResponseFormats:
    """Tests for response format compliance with specification."""
    
    def test_score_breakdown_format(self):
        """Test that ScoreBreakdown matches specification."""
        from models.schemas import ScoreBreakdown
        
        breakdown = ScoreBreakdown(
            personality=85.0,
            interests=70.0,
            values=80.0,
        )
        
        assert breakdown.personality == 85.0
        assert breakdown.interests == 70.0
        assert breakdown.values == 80.0
    
    def test_selection_profile_format(self):
        """Test that SelectionProfile matches specification."""
        from models.schemas import SelectionProfile, ScoreBreakdown
        
        profile = SelectionProfile(
            userId="user-123",
            compatibilityScore=82.5,
            scoreBreakdown=ScoreBreakdown(
                personality=85.0,
                interests=75.0,
                values=85.0,
            ),
            matchReasons=["Bonne compatibilité de personnalité", "3 centres d'intérêt en commun"],
        )
        
        assert profile.userId == "user-123"
        assert 0 <= profile.compatibilityScore <= 100
        assert len(profile.matchReasons) > 0
    
    def test_generate_selection_response_format(self):
        """Test that GenerateSelectionResponse matches specification."""
        from models.schemas import GenerateSelectionResponse, SelectionProfile, ScoreBreakdown
        from datetime import datetime
        
        response = GenerateSelectionResponse(
            selection=[
                SelectionProfile(
                    userId="user-1",
                    compatibilityScore=85.0,
                    scoreBreakdown=ScoreBreakdown(
                        personality=80.0,
                        interests=85.0,
                        values=90.0,
                    ),
                    matchReasons=["Match reason 1"],
                )
            ],
            generatedAt=datetime.now().isoformat(),
        )
        
        assert len(response.selection) == 1
        assert response.generatedAt is not None
    
    def test_calculate_compatibility_response_format(self):
        """Test that CalculateCompatibilityResponseV1 matches specification."""
        from models.schemas import CalculateCompatibilityResponseV1, ScoreBreakdown
        
        response = CalculateCompatibilityResponseV1(
            score=78.5,
            breakdown=ScoreBreakdown(
                personality=75.0,
                interests=80.0,
                values=80.0,
            ),
            matchReasons=["Reason 1", "Reason 2"],
        )
        
        assert 0 <= response.score <= 100
        assert response.breakdown is not None
        assert len(response.matchReasons) >= 0
