import numpy as np
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime
import logging
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import StandardScaler

from app.models.matching import (
    UserProfile,
    CompatibilityResponse,
    DailySelectionResponse,
    BatchCompatibilityResponse,
    AlgorithmStatsResponse,
    PersonalityAnswer,
)
from app.core.config import settings

logger = logging.getLogger(__name__)

class MatchingAlgorithm:
    def __init__(self):
        self.scaler = StandardScaler()
        self.calculation_count = 0
        self.total_compatibility_score = 0.0
        self.algorithm_version = "1.0.0"
        
    async def calculate_compatibility(
        self, 
        user1_profile: UserProfile, 
        user2_profile: UserProfile
    ) -> CompatibilityResponse:
        """
        Calculate compatibility score between two user profiles.
        Uses personality answers, preferences, and shared interests.
        """
        logger.info(f"Calculating compatibility between {user1_profile.user_id} and {user2_profile.user_id}")
        
        # Check basic compatibility (age, gender preferences, distance)
        basic_compatibility = self._check_basic_compatibility(user1_profile, user2_profile)
        if not basic_compatibility:
            return CompatibilityResponse(
                compatibility_score=0.0,
                personality_compatibility=0.0,
                preferences_compatibility=0.0,
                shared_interests=[],
                reasons=["Basic compatibility criteria not met"]
            )
        
        # Calculate personality compatibility
        personality_score = self._calculate_personality_compatibility(
            user1_profile.personality_answers,
            user2_profile.personality_answers
        )
        
        # Calculate preferences compatibility
        preferences_score = self._calculate_preferences_compatibility(
            user1_profile, user2_profile
        )
        
        # Calculate shared interests
        shared_interests = self._find_shared_interests(
            user1_profile.interests,
            user2_profile.interests
        )
        
        # Calculate final compatibility score
        final_score = (
            personality_score * settings.COMPATIBILITY_WEIGHTS_PERSONALITY +
            preferences_score * settings.COMPATIBILITY_WEIGHTS_PREFERENCES
        )
        
        # Boost score based on shared interests
        interest_boost = min(len(shared_interests) * 0.05, 0.2)
        final_score = min(final_score + interest_boost, 1.0)
        
        # Update statistics
        self.calculation_count += 1
        self.total_compatibility_score += final_score
        
        # Generate reasons for compatibility
        reasons = self._generate_compatibility_reasons(
            personality_score, preferences_score, shared_interests
        )
        
        return CompatibilityResponse(
            compatibility_score=round(final_score, 3),
            personality_compatibility=round(personality_score, 3),
            preferences_compatibility=round(preferences_score, 3),
            shared_interests=shared_interests,
            reasons=reasons
        )
    
    async def generate_daily_selection(
        self,
        user_profile: UserProfile,
        available_profiles: List[UserProfile],
        selection_size: int = 5
    ) -> DailySelectionResponse:
        """
        Generate daily selection of best matching profiles.
        """
        logger.info(f"Generating daily selection for user {user_profile.user_id}")
        
        if not available_profiles:
            return DailySelectionResponse(
                user_id=user_profile.user_id,
                selected_profiles=[],
                compatibility_scores={},
                selection_date=datetime.now().isoformat()
            )
        
        # Calculate compatibility with all available profiles
        compatibility_scores = {}
        compatible_profiles = []
        
        for profile in available_profiles:
            compatibility = await self.calculate_compatibility(user_profile, profile)
            
            # Only include profiles above minimum threshold
            if compatibility.compatibility_score >= settings.MIN_COMPATIBILITY_SCORE:
                compatibility_scores[profile.user_id] = compatibility.compatibility_score
                compatible_profiles.append(profile)
        
        # Sort by compatibility score (descending)
        compatible_profiles.sort(
            key=lambda p: compatibility_scores[p.user_id],
            reverse=True
        )
        
        # Select top profiles
        selected_profiles = compatible_profiles[:selection_size]
        selected_scores = {
            profile.user_id: compatibility_scores[profile.user_id]
            for profile in selected_profiles
        }
        
        return DailySelectionResponse(
            user_id=user_profile.user_id,
            selected_profiles=selected_profiles,
            compatibility_scores=selected_scores,
            selection_date=datetime.now().isoformat()
        )
    
    async def batch_compatibility_calculation(
        self,
        base_profile: UserProfile,
        profiles_to_compare: List[UserProfile]
    ) -> BatchCompatibilityResponse:
        """
        Calculate compatibility scores for multiple profiles against a base profile.
        """
        logger.info(f"Batch compatibility calculation for {len(profiles_to_compare)} profiles")
        
        compatibility_results = {}
        
        for profile in profiles_to_compare:
            compatibility = await self.calculate_compatibility(base_profile, profile)
            compatibility_results[profile.user_id] = compatibility
        
        return BatchCompatibilityResponse(
            base_user_id=base_profile.user_id,
            compatibility_results=compatibility_results
        )
    
    async def get_algorithm_stats(self) -> AlgorithmStatsResponse:
        """
        Get algorithm performance statistics.
        """
        average_score = (
            self.total_compatibility_score / self.calculation_count
            if self.calculation_count > 0 else 0.0
        )
        
        return AlgorithmStatsResponse(
            total_calculations=self.calculation_count,
            average_compatibility_score=round(average_score, 3),
            algorithm_version=self.algorithm_version,
            last_updated=datetime.now().isoformat()
        )
    
    def _check_basic_compatibility(
        self, 
        user1: UserProfile, 
        user2: UserProfile
    ) -> bool:
        """
        Check basic compatibility criteria (age, gender preferences, distance).
        """
        # Check age preferences
        if not (user1.preferences.min_age <= user2.age <= user1.preferences.max_age):
            return False
        if not (user2.preferences.min_age <= user1.age <= user2.preferences.max_age):
            return False
        
        # Check gender preferences
        if user2.gender not in user1.preferences.interested_in_genders:
            return False
        if user1.gender not in user2.preferences.interested_in_genders:
            return False
        
        # Check distance (simplified calculation)
        distance = self._calculate_distance(
            user1.location["latitude"], user1.location["longitude"],
            user2.location["latitude"], user2.location["longitude"]
        )
        
        if distance > user1.preferences.max_distance or distance > user2.preferences.max_distance:
            return False
        
        return True
    
    def _calculate_personality_compatibility(
        self,
        answers1: List[PersonalityAnswer],
        answers2: List[PersonalityAnswer]
    ) -> float:
        """
        Calculate personality compatibility based on questionnaire answers.
        """
        if not answers1 or not answers2:
            return 0.5  # Default score if no personality data
        
        # Create answer vectors for comparison
        vector1 = self._create_personality_vector(answers1)
        vector2 = self._create_personality_vector(answers2)
        
        if len(vector1) == 0 or len(vector2) == 0:
            return 0.5
        
        # Calculate cosine similarity
        similarity = cosine_similarity([vector1], [vector2])[0][0]
        
        # Convert to 0-1 scale (cosine similarity ranges from -1 to 1)
        compatibility_score = (similarity + 1) / 2
        
        return max(0.0, min(1.0, compatibility_score))
    
    def _calculate_preferences_compatibility(
        self,
        user1: UserProfile,
        user2: UserProfile
    ) -> float:
        """
        Calculate preferences compatibility.
        """
        score = 0.0
        factors = 0
        
        # Age preference overlap
        age_overlap = self._calculate_age_preference_overlap(user1, user2)
        score += age_overlap
        factors += 1
        
        # Distance preference compatibility
        distance = self._calculate_distance(
            user1.location["latitude"], user1.location["longitude"],
            user2.location["latitude"], user2.location["longitude"]
        )
        
        max_distance = min(user1.preferences.max_distance, user2.preferences.max_distance)
        distance_score = max(0, 1 - (distance / max_distance)) if max_distance > 0 else 1.0
        score += distance_score
        factors += 1
        
        return score / factors if factors > 0 else 0.5
    
    def _find_shared_interests(
        self,
        interests1: List[str],
        interests2: List[str]
    ) -> List[str]:
        """
        Find shared interests between two users.
        """
        if not interests1 or not interests2:
            return []
        
        shared = list(set(interests1) & set(interests2))
        return shared
    
    def _generate_compatibility_reasons(
        self,
        personality_score: float,
        preferences_score: float,
        shared_interests: List[str]
    ) -> List[str]:
        """
        Generate human-readable reasons for compatibility score.
        """
        reasons = []
        
        if personality_score > 0.7:
            reasons.append("Highly compatible personalities")
        elif personality_score > 0.5:
            reasons.append("Good personality match")
        
        if preferences_score > 0.7:
            reasons.append("Well-aligned preferences")
        elif preferences_score > 0.5:
            reasons.append("Compatible preferences")
        
        if len(shared_interests) > 2:
            reasons.append(f"Many shared interests: {', '.join(shared_interests[:3])}")
        elif len(shared_interests) > 0:
            reasons.append(f"Shared interests: {', '.join(shared_interests)}")
        
        if not reasons:
            reasons.append("Basic compatibility criteria met")
        
        return reasons
    
    def _create_personality_vector(self, answers: List[PersonalityAnswer]) -> List[float]:
        """
        Create a numerical vector from personality answers for comparison.
        """
        vector = []
        
        for answer in answers:
            if answer.numeric_answer is not None:
                vector.append(float(answer.numeric_answer))
            elif answer.boolean_answer is not None:
                vector.append(1.0 if answer.boolean_answer else 0.0)
            elif answer.multiple_choice_answer:
                # Convert multiple choice to numerical representation
                vector.append(float(len(answer.multiple_choice_answer)))
            elif answer.text_answer:
                # Simple text length as a numerical feature
                vector.append(float(len(answer.text_answer)) / 100.0)
        
        return vector
    
    def _calculate_age_preference_overlap(
        self,
        user1: UserProfile,
        user2: UserProfile
    ) -> float:
        """
        Calculate overlap in age preferences.
        """
        # Calculate the overlap between age preference ranges
        range1_start, range1_end = user1.preferences.min_age, user1.preferences.max_age
        range2_start, range2_end = user2.preferences.min_age, user2.preferences.max_age
        
        overlap_start = max(range1_start, range2_start)
        overlap_end = min(range1_end, range2_end)
        
        if overlap_start <= overlap_end:
            overlap_size = overlap_end - overlap_start + 1
            total_range = max(range1_end, range2_end) - min(range1_start, range2_start) + 1
            return overlap_size / total_range
        
        return 0.0
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """
        Calculate distance between two coordinates in kilometers.
        Using Haversine formula.
        """
        from math import radians, cos, sin, asin, sqrt
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        r = 6371  # Radius of earth in kilometers
        
        return c * r