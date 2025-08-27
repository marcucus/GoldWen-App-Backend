from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum

class Gender(str, Enum):
    MAN = "man"
    WOMAN = "woman"
    NON_BINARY = "non_binary"
    OTHER = "other"

class PersonalityAnswer(BaseModel):
    question_id: str
    text_answer: Optional[str] = None
    numeric_answer: Optional[int] = None
    boolean_answer: Optional[bool] = None
    multiple_choice_answer: Optional[List[str]] = None

class UserPreferences(BaseModel):
    min_age: int
    max_age: int
    max_distance: int
    interested_in_genders: List[Gender]

class UserProfile(BaseModel):
    user_id: str
    age: int
    gender: Gender
    location: Dict[str, float]  # {"latitude": float, "longitude": float}
    personality_answers: List[PersonalityAnswer]
    preferences: UserPreferences
    interests: List[str]
    education: Optional[str] = None
    job_title: Optional[str] = None

class CompatibilityRequest(BaseModel):
    user1_profile: UserProfile
    user2_profile: UserProfile

class CompatibilityResponse(BaseModel):
    compatibility_score: float = Field(..., ge=0, le=1)
    personality_compatibility: float = Field(..., ge=0, le=1)
    preferences_compatibility: float = Field(..., ge=0, le=1)
    shared_interests: List[str]
    reasons: List[str]

class DailySelectionRequest(BaseModel):
    user_id: str
    user_profile: UserProfile
    available_profiles: List[UserProfile]
    selection_size: int = Field(default=5, ge=1, le=10)

class DailySelectionResponse(BaseModel):
    user_id: str
    selected_profiles: List[UserProfile]
    compatibility_scores: Dict[str, float]  # profile_id -> score
    selection_date: str

class BatchCompatibilityRequest(BaseModel):
    base_profile: UserProfile
    profiles_to_compare: List[UserProfile]

class BatchCompatibilityResponse(BaseModel):
    base_user_id: str
    compatibility_results: Dict[str, CompatibilityResponse]  # user_id -> compatibility

class AlgorithmStatsResponse(BaseModel):
    total_calculations: int
    average_compatibility_score: float
    algorithm_version: str
    last_updated: str