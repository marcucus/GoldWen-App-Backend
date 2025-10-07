"""
GoldWen Matching Service - FastAPI Application

This service provides advanced matching algorithms for the GoldWen dating app.
It calculates compatibility scores using both personality-based (V1) and
advanced behavioral scoring (V2).
"""

import logging
from datetime import datetime
from typing import Dict

from fastapi import FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import (
    AlgorithmStats,
    BatchCompatibilityRequest,
    BatchCompatibilityResult,
    CompatibilityRequest,
    CompatibilityRequestV2,
    CompatibilityResult,
    CompatibilityResultV2,
    DailySelectionRequest,
    DailySelectionResult,
    HealthCheckResponse,
)
from services.compatibility_calculator import CompatibilityCalculator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="GoldWen Matching Service",
    description="Advanced matching algorithm service with V1 and V2 scoring",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key for authentication
API_KEY = "matching-service-secret-key"  # Should be in environment variable in production

# Statistics tracking
stats = {
    "total_calculations": 0,
    "total_v2_calculations": 0,
    "average_score": 0.0,
    "last_update": datetime.now().isoformat(),
}


def verify_api_key(x_api_key: str = Header(...)) -> None:
    """Verify the API key from request headers."""
    if x_api_key != API_KEY:
        logger.warning(f"Invalid API key attempt: {x_api_key}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )


@app.get("/health", response_model=HealthCheckResponse)
async def health_check() -> HealthCheckResponse:
    """Health check endpoint."""
    return HealthCheckResponse(
        status="healthy",
        version="2.0.0",
        timestamp=datetime.now().isoformat(),
    )


@app.post(
    "/api/v1/matching-service/calculate-compatibility",
    response_model=CompatibilityResult,
    dependencies=[],
)
async def calculate_compatibility(
    request: CompatibilityRequest,
    x_api_key: str = Header(...),
) -> CompatibilityResult:
    """
    Calculate V1 compatibility score between two user profiles.
    
    This endpoint uses personality-based scoring only.
    """
    verify_api_key(x_api_key)
    
    try:
        logger.info(
            f"Calculating V1 compatibility: {request.user1Profile.userId} <-> {request.user2Profile.userId}"
        )
        
        result = CompatibilityCalculator.calculate_compatibility_v1(
            user1_profile=request.user1Profile.model_dump(),
            user2_profile=request.user2Profile.model_dump(),
        )
        
        # Update statistics
        stats["total_calculations"] += 1
        current_avg = stats["average_score"]
        total = stats["total_calculations"]
        stats["average_score"] = (
            (current_avg * (total - 1) + result["compatibilityScore"]) / total
        )
        stats["last_update"] = datetime.now().isoformat()
        
        logger.info(
            f"V1 Compatibility calculated: {result['compatibilityScore']}"
        )
        
        return CompatibilityResult(**result)
        
    except Exception as e:
        logger.error(f"Error calculating V1 compatibility: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating compatibility: {str(e)}",
        )


@app.post(
    "/api/v1/matching/calculate-compatibility-v2",
    response_model=CompatibilityResultV2,
    dependencies=[],
)
async def calculate_compatibility_v2(
    request: CompatibilityRequestV2,
    x_api_key: str = Header(...),
) -> CompatibilityResultV2:
    """
    Calculate V2 compatibility score with advanced factors.
    
    This endpoint uses:
    - Personality-based scoring (V1) - 60%
    - Advanced factors (V2) - 40%:
      - User activity
      - Response rate
      - Potential reciprocity
    """
    verify_api_key(x_api_key)
    
    try:
        logger.info(
            f"Calculating V2 compatibility: {request.user1Profile.userId} <-> {request.user2Profile.userId}"
        )
        
        result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=request.user1Profile.model_dump(),
            user2_profile=request.user2Profile.model_dump(),
        )
        
        # Update statistics
        stats["total_calculations"] += 1
        stats["total_v2_calculations"] += 1
        current_avg = stats["average_score"]
        total = stats["total_calculations"]
        stats["average_score"] = (
            (current_avg * (total - 1) + result["compatibilityScore"]) / total
        )
        stats["last_update"] = datetime.now().isoformat()
        
        logger.info(
            f"V2 Compatibility calculated: {result['compatibilityScore']}, "
            f"Advanced factors: activity={result['advancedFactors']['activityScore']}, "
            f"response={result['advancedFactors']['responseRateScore']}, "
            f"reciprocity={result['advancedFactors']['reciprocityScore']}"
        )
        
        return CompatibilityResultV2(**result)
        
    except Exception as e:
        logger.error(f"Error calculating V2 compatibility: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating V2 compatibility: {str(e)}",
        )


@app.post(
    "/api/v1/matching-service/batch-compatibility",
    response_model=BatchCompatibilityResult,
    dependencies=[],
)
async def batch_compatibility(
    request: BatchCompatibilityRequest,
    x_api_key: str = Header(...),
) -> BatchCompatibilityResult:
    """
    Calculate compatibility scores for multiple profiles against a base profile.
    
    Uses V1 algorithm for batch processing.
    """
    verify_api_key(x_api_key)
    
    try:
        logger.info(
            f"Calculating batch compatibility for {request.baseProfile.userId} "
            f"against {len(request.profilesToCompare)} profiles"
        )
        
        results = {}
        base_profile_dict = request.baseProfile.model_dump()
        
        for profile in request.profilesToCompare:
            result = CompatibilityCalculator.calculate_compatibility_v1(
                user1_profile=base_profile_dict,
                user2_profile=profile.model_dump(),
            )
            results[profile.userId] = CompatibilityResult(**result)
        
        # Update statistics
        stats["total_calculations"] += len(request.profilesToCompare)
        stats["last_update"] = datetime.now().isoformat()
        
        logger.info(f"Batch compatibility calculated for {len(results)} profiles")
        
        return BatchCompatibilityResult(results=results)
        
    except Exception as e:
        logger.error(f"Error calculating batch compatibility: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error calculating batch compatibility: {str(e)}",
        )


@app.post(
    "/api/v1/matching-service/generate-daily-selection",
    response_model=DailySelectionResult,
    dependencies=[],
)
async def generate_daily_selection(
    request: DailySelectionRequest,
    x_api_key: str = Header(...),
) -> DailySelectionResult:
    """
    Generate daily selection of profiles for a user.
    
    Calculates compatibility with all available profiles and returns
    the top N matches.
    """
    verify_api_key(x_api_key)
    
    try:
        logger.info(
            f"Generating daily selection for {request.userId}, "
            f"size: {request.selectionSize}, "
            f"available profiles: {len(request.availableProfiles)}"
        )
        
        scores: Dict[str, float] = {}
        user_profile_dict = request.userProfile.model_dump()
        
        for profile in request.availableProfiles:
            result = CompatibilityCalculator.calculate_compatibility_v1(
                user1_profile=user_profile_dict,
                user2_profile=profile.model_dump(),
            )
            scores[profile.userId] = result["compatibilityScore"]
        
        # Sort by score and select top N
        sorted_profiles = sorted(
            scores.items(),
            key=lambda x: x[1],
            reverse=True,
        )
        
        selected_profiles = [
            user_id for user_id, _ in sorted_profiles[: request.selectionSize]
        ]
        
        logger.info(
            f"Daily selection generated: {len(selected_profiles)} profiles selected"
        )
        
        return DailySelectionResult(
            selectedProfiles=selected_profiles,
            scores=scores,
        )
        
    except Exception as e:
        logger.error(f"Error generating daily selection: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating daily selection: {str(e)}",
        )


@app.get(
    "/api/v1/matching-service/algorithm/stats",
    response_model=AlgorithmStats,
    dependencies=[],
)
async def get_algorithm_stats(
    x_api_key: str = Header(...),
) -> AlgorithmStats:
    """Get algorithm statistics."""
    verify_api_key(x_api_key)
    
    return AlgorithmStats(
        totalCalculations=stats["total_calculations"],
        averageScore=round(stats["average_score"], 2),
        lastUpdate=stats["last_update"],
        status="online",
        version="v2",
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info",
    )
