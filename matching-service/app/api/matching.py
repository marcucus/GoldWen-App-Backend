from fastapi import APIRouter, HTTPException
from typing import List
import logging

from app.models.matching import (
    CompatibilityRequest,
    CompatibilityResponse,
    DailySelectionRequest,
    DailySelectionResponse,
    BatchCompatibilityRequest,
    BatchCompatibilityResponse,
    AlgorithmStatsResponse,
)
from app.services.matching_algorithm import MatchingAlgorithm

router = APIRouter()
logger = logging.getLogger(__name__)

# Initialize matching algorithm
matching_algorithm = MatchingAlgorithm()

@router.post("/calculate-compatibility", response_model=CompatibilityResponse)
async def calculate_compatibility(request: CompatibilityRequest):
    """
    Calculate compatibility score between two user profiles.
    """
    try:
        result = await matching_algorithm.calculate_compatibility(
            request.user1_profile,
            request.user2_profile
        )
        return result
    except Exception as e:
        logger.error(f"Error calculating compatibility: {str(e)}")
        raise HTTPException(status_code=500, detail="Error calculating compatibility")

@router.post("/generate-daily-selection", response_model=DailySelectionResponse)
async def generate_daily_selection(request: DailySelectionRequest):
    """
    Generate daily selection of profiles for a user based on compatibility.
    """
    try:
        result = await matching_algorithm.generate_daily_selection(
            request.user_profile,
            request.available_profiles,
            request.selection_size
        )
        return result
    except Exception as e:
        logger.error(f"Error generating daily selection: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating daily selection")

@router.post("/batch-compatibility", response_model=BatchCompatibilityResponse)
async def batch_compatibility(request: BatchCompatibilityRequest):
    """
    Calculate compatibility scores for multiple profiles against a base profile.
    """
    try:
        result = await matching_algorithm.batch_compatibility_calculation(
            request.base_profile,
            request.profiles_to_compare
        )
        return result
    except Exception as e:
        logger.error(f"Error in batch compatibility calculation: {str(e)}")
        raise HTTPException(status_code=500, detail="Error in batch compatibility calculation")

@router.get("/algorithm/stats", response_model=AlgorithmStatsResponse)
async def get_algorithm_stats():
    """
    Get statistics about the matching algorithm performance.
    """
    try:
        result = await matching_algorithm.get_algorithm_stats()
        return result
    except Exception as e:
        logger.error(f"Error getting algorithm stats: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting algorithm stats")