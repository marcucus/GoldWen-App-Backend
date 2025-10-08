"""
Pydantic models for request and response schemas.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PersonalityAnswer(BaseModel):
    """Personality question answer model."""

    questionId: str
    category: Optional[str] = "personality"
    numericAnswer: Optional[int] = None
    booleanAnswer: Optional[bool] = None
    multipleChoiceAnswer: Optional[List[str]] = None
    textAnswer: Optional[str] = None


class UserPreferences(BaseModel):
    """User preferences model."""

    minAge: Optional[int] = 18
    maxAge: Optional[int] = 100
    gender: Optional[str] = None
    maxDistance: Optional[float] = None


class UserProfile(BaseModel):
    """User profile model for compatibility calculation."""

    userId: str
    age: Optional[int] = None
    gender: Optional[str] = None
    interests: List[str] = Field(default_factory=list)
    languages: List[str] = Field(default_factory=list)
    personalityAnswers: List[PersonalityAnswer] = Field(default_factory=list)
    preferences: Optional[UserPreferences] = None
    
    # Location data
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Activity metrics
    lastActiveAt: Optional[datetime] = None
    lastLoginAt: Optional[datetime] = None
    createdAt: Optional[datetime] = None
    
    # Messaging metrics
    messagesSent: int = 0
    messagesReceived: int = 0
    matchesCount: int = 0


class CompatibilityRequest(BaseModel):
    """Request model for calculate-compatibility endpoint."""

    user1Profile: UserProfile
    user2Profile: UserProfile


class CompatibilityRequestV2(BaseModel):
    """Request model for calculate-compatibility-v2 endpoint."""

    user1Profile: UserProfile
    user2Profile: UserProfile


class DetailedScores(BaseModel):
    """Detailed compatibility scores by category."""

    communication: float = Field(ge=0, le=1)
    values: float = Field(ge=0, le=1)
    lifestyle: float = Field(ge=0, le=1)
    personality: float = Field(ge=0, le=1)


class AdvancedFactorDetails(BaseModel):
    """Detailed breakdown of advanced factors."""

    userActivity: float = Field(ge=0, le=1)
    targetActivity: float = Field(ge=0, le=1)
    userResponseRate: float = Field(ge=0, le=1)
    targetResponseRate: float = Field(ge=0, le=1)


class AdvancedFactors(BaseModel):
    """Advanced scoring factors for V2."""

    activityScore: float = Field(ge=0, le=1)
    responseRateScore: float = Field(ge=0, le=1)
    reciprocityScore: float = Field(ge=0, le=1)
    details: AdvancedFactorDetails


class ScoringWeights(BaseModel):
    """Weights used in scoring calculation."""

    personalityWeight: float
    advancedWeight: float


class CompatibilityResult(BaseModel):
    """Response model for calculate-compatibility endpoint."""

    compatibilityScore: float = Field(ge=0, le=100, description="Compatibility score (0-100)")
    details: DetailedScores
    sharedInterests: List[str]


class CompatibilityResultV2(BaseModel):
    """Response model for calculate-compatibility-v2 endpoint."""

    compatibilityScore: float = Field(ge=0, le=100, description="Compatibility score (0-100)")
    version: str = "v2"
    details: DetailedScores
    advancedFactors: AdvancedFactors
    sharedInterests: List[str]
    scoringWeights: ScoringWeights


class BatchCompatibilityRequest(BaseModel):
    """Request model for batch-compatibility endpoint."""

    baseProfile: UserProfile
    profilesToCompare: List[UserProfile]


class BatchCompatibilityResult(BaseModel):
    """Response model for batch-compatibility endpoint."""

    results: Dict[str, CompatibilityResult]


class DailySelectionRequest(BaseModel):
    """Request model for generate-daily-selection endpoint."""

    userId: str
    userProfile: UserProfile
    availableProfiles: List[UserProfile]
    selectionSize: int = 5


class DailySelectionResult(BaseModel):
    """Response model for generate-daily-selection endpoint."""

    selectedProfiles: List[str]  # User IDs
    scores: Dict[str, float]


class AlgorithmStats(BaseModel):
    """Algorithm statistics response."""

    totalCalculations: int
    averageScore: float
    lastUpdate: str
    status: str = "online"
    version: str = "v2"


class HealthCheckResponse(BaseModel):
    """Health check response."""

    status: str = "healthy"
    version: str = "2.0.0"
    timestamp: str
