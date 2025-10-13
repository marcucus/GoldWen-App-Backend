"""
Compatibility Calculator Module

This module handles the calculation of compatibility scores between users,
integrating both V1 (personality-based) and V2 (advanced) scoring algorithms.
"""

from typing import Dict, List, Optional
from .advanced_scoring import AdvancedScoringService


class CompatibilityCalculator:
    """Main compatibility calculator integrating V1 and V2 algorithms."""

    # Weights for V1 vs V2 scoring
    V1_WEIGHT = 0.6  # Personality-based scoring
    V2_WEIGHT = 0.4  # Advanced scoring (activity, response, reciprocity)

    @staticmethod
    def calculate_personality_score(
        user1_answers: List[Dict],
        user2_answers: List[Dict],
    ) -> Dict[str, float]:
        """
        Calculate V1 personality-based compatibility score.
        
        This implements content-based filtering based on personality quiz answers.
        
        Args:
            user1_answers: List of personality answers for user 1
            user2_answers: List of personality answers for user 2
            
        Returns:
            Dictionary with personality score and category breakdowns
        """
        if not user1_answers or not user2_answers:
            return {
                "personalityScore": 0.5,
                "communication": 0.5,
                "values": 0.5,
                "lifestyle": 0.5,
                "personality": 0.5,
            }

        total_score = 0.0
        common_questions = 0
        category_scores = {
            "communication": [],
            "values": [],
            "lifestyle": [],
            "personality": [],
        }

        # Create answer lookup for user2
        user2_answer_map = {a["questionId"]: a for a in user2_answers}

        for answer1 in user1_answers:
            question_id = answer1["questionId"]
            answer2 = user2_answer_map.get(question_id)

            if not answer2:
                continue

            common_questions += 1
            similarity = 0.0

            # Calculate similarity based on answer type
            if (
                "numericAnswer" in answer1
                and answer1["numericAnswer"] is not None
                and "numericAnswer" in answer2
                and answer2["numericAnswer"] is not None
            ):
                # For scale questions (e.g., 1-10)
                max_distance = 10
                distance = abs(answer1["numericAnswer"] - answer2["numericAnswer"])
                similarity = (max_distance - distance) / max_distance

            elif (
                "booleanAnswer" in answer1
                and answer1["booleanAnswer"] is not None
                and "booleanAnswer" in answer2
                and answer2["booleanAnswer"] is not None
            ):
                # For yes/no questions
                similarity = 1.0 if answer1["booleanAnswer"] == answer2["booleanAnswer"] else 0.0

            elif (
                "multipleChoiceAnswer" in answer1
                and answer1["multipleChoiceAnswer"]
                and "multipleChoiceAnswer" in answer2
                and answer2["multipleChoiceAnswer"]
            ):
                # For multiple choice questions
                choices1 = set(answer1["multipleChoiceAnswer"])
                choices2 = set(answer2["multipleChoiceAnswer"])
                common = choices1 & choices2
                total = choices1 | choices2
                similarity = len(common) / len(total) if total else 0.0

            elif (
                "textAnswer" in answer1
                and answer1["textAnswer"]
                and "textAnswer" in answer2
                and answer2["textAnswer"]
            ):
                # Basic text similarity
                similarity = (
                    1.0
                    if answer1["textAnswer"].lower() == answer2["textAnswer"].lower()
                    else 0.5
                )

            total_score += similarity

            # Categorize the question for detailed breakdown
            category = answer1.get("category", "personality")
            if category in category_scores:
                category_scores[category].append(similarity)

        # Calculate overall personality score
        personality_score = total_score / common_questions if common_questions > 0 else 0.5

        # Calculate category averages
        category_averages = {}
        for category, scores in category_scores.items():
            if scores:
                category_averages[category] = sum(scores) / len(scores)
            else:
                category_averages[category] = 0.5  # Neutral if no data

        return {
            "personalityScore": round(personality_score, 3),
            "communication": round(category_averages.get("communication", 0.5), 3),
            "values": round(category_averages.get("values", 0.5), 3),
            "lifestyle": round(category_averages.get("lifestyle", 0.5), 3),
            "personality": round(category_averages.get("personality", 0.5), 3),
        }

    @staticmethod
    def extract_shared_interests(
        user1_interests: List[str],
        user2_interests: List[str],
    ) -> List[str]:
        """
        Extract shared interests between two users.
        
        Args:
            user1_interests: List of interests for user 1
            user2_interests: List of interests for user 2
            
        Returns:
            List of shared interests
        """
        if not user1_interests or not user2_interests:
            return []

        interests1 = set(i.lower() for i in user1_interests)
        interests2 = set(i.lower() for i in user2_interests)

        return sorted(list(interests1 & interests2))

    @classmethod
    def calculate_compatibility_v1(
        cls,
        user1_profile: Dict,
        user2_profile: Dict,
    ) -> Dict:
        """
        Calculate V1 compatibility (personality-based only).
        
        Args:
            user1_profile: Complete profile data for user 1
            user2_profile: Complete profile data for user 2
            
        Returns:
            V1 compatibility result with score and details
        """
        personality_result = cls.calculate_personality_score(
            user1_answers=user1_profile.get("personalityAnswers", []),
            user2_answers=user2_profile.get("personalityAnswers", []),
        )

        shared_interests = cls.extract_shared_interests(
            user1_interests=user1_profile.get("interests", []),
            user2_interests=user2_profile.get("interests", []),
        )

        # Convert to percentage scale (0-100)
        compatibility_score = round(personality_result["personalityScore"] * 100, 1)

        return {
            "compatibilityScore": compatibility_score,
            "details": {
                "communication": personality_result["communication"],
                "values": personality_result["values"],
                "lifestyle": personality_result["lifestyle"],
                "personality": personality_result["personality"],
            },
            "sharedInterests": shared_interests,
        }

    @classmethod
    def calculate_compatibility_v2(
        cls,
        user1_profile: Dict,
        user2_profile: Dict,
    ) -> Dict:
        """
        Calculate V2 compatibility (personality + advanced scoring).
        
        This integrates:
        - V1 personality-based scoring (60%)
        - V2 advanced scoring: activity, response rate, reciprocity (40%)
        
        Args:
            user1_profile: Complete profile data for user 1
            user2_profile: Complete profile data for user 2
            
        Returns:
            V2 compatibility result with enhanced scoring
        """
        # Calculate V1 personality score
        personality_result = cls.calculate_personality_score(
            user1_answers=user1_profile.get("personalityAnswers", []),
            user2_answers=user2_profile.get("personalityAnswers", []),
        )

        personality_score = personality_result["personalityScore"]

        # Extract shared interests
        shared_interests = cls.extract_shared_interests(
            user1_interests=user1_profile.get("interests", []),
            user2_interests=user2_profile.get("interests", []),
        )

        # Prepare data for advanced scoring
        user1_data = {
            "lastActiveAt": user1_profile.get("lastActiveAt"),
            "lastLoginAt": user1_profile.get("lastLoginAt"),
            "createdAt": user1_profile.get("createdAt"),
            "messagesSent": user1_profile.get("messagesSent", 0),
            "messagesReceived": user1_profile.get("messagesReceived", 0),
            "matchesCount": user1_profile.get("matchesCount", 0),
            "mutualInterests": len(shared_interests),
            "dealbreakerAlignment": cls._calculate_dealbreaker_alignment(
                user1_profile, user2_profile
            ),
        }

        user2_data = {
            "lastActiveAt": user2_profile.get("lastActiveAt"),
            "lastLoginAt": user2_profile.get("lastLoginAt"),
            "createdAt": user2_profile.get("createdAt"),
            "messagesSent": user2_profile.get("messagesSent", 0),
            "messagesReceived": user2_profile.get("messagesReceived", 0),
            "matchesCount": user2_profile.get("matchesCount", 0),
            "mutualInterests": len(shared_interests),
            "dealbreakerAlignment": cls._calculate_dealbreaker_alignment(
                user2_profile, user1_profile
            ),
        }

        # Calculate advanced scores
        advanced_result = AdvancedScoringService.calculate_advanced_score(
            user_data=user1_data,
            target_user_data=user2_data,
            personality_compatibility=personality_score,
        )

        # Combine V1 and V2 scores
        final_score = (
            personality_score * cls.V1_WEIGHT
            + advanced_result["advancedScore"] * cls.V2_WEIGHT
        )

        # Convert to percentage scale (0-100)
        compatibility_score = round(final_score * 100, 1)

        return {
            "compatibilityScore": compatibility_score,
            "version": "v2",
            "details": {
                "communication": personality_result["communication"],
                "values": personality_result["values"],
                "lifestyle": personality_result["lifestyle"],
                "personality": personality_result["personality"],
            },
            "advancedFactors": {
                "activityScore": advanced_result["activityScore"],
                "responseRateScore": advanced_result["responseRateScore"],
                "reciprocityScore": advanced_result["reciprocityScore"],
                "details": advanced_result["details"],
            },
            "sharedInterests": shared_interests,
            "scoringWeights": {
                "personalityWeight": cls.V1_WEIGHT,
                "advancedWeight": cls.V2_WEIGHT,
            },
        }

    @staticmethod
    def _calculate_dealbreaker_alignment(
        user1_profile: Dict,
        user2_profile: Dict,
    ) -> float:
        """
        Calculate alignment on dealbreakers (preferences that must match).
        
        Args:
            user1_profile: Profile of user 1
            user2_profile: Profile of user 2
            
        Returns:
            Alignment score between 0.0 and 1.0
        """
        # Check critical preferences
        alignment_score = 1.0
        checks_performed = 0

        # Get preferences safely
        preferences = user1_profile.get("preferences") or {}

        # Age preference
        user2_age = user2_profile.get("age")
        if user2_age:
            min_age = preferences.get("minAge", 18)
            max_age = preferences.get("maxAge", 100)
            checks_performed += 1
            if not (min_age <= user2_age <= max_age):
                alignment_score -= 0.3

        # Distance preference (if location data available)
        user1_lat = user1_profile.get("latitude")
        user1_lon = user1_profile.get("longitude")
        user2_lat = user2_profile.get("latitude")
        user2_lon = user2_profile.get("longitude")
        max_distance = preferences.get("maxDistance")

        if all([user1_lat, user1_lon, user2_lat, user2_lon, max_distance]):
            checks_performed += 1
            # Simplified distance check (would use proper geo calculation in production)
            lat_diff = abs(user1_lat - user2_lat)
            lon_diff = abs(user1_lon - user2_lon)
            # Rough approximation: 1 degree ≈ 111km
            approx_distance = ((lat_diff ** 2 + lon_diff ** 2) ** 0.5) * 111
            if approx_distance > max_distance:
                alignment_score -= 0.2

        # Gender preference (if specified)
        preferred_gender = preferences.get("gender")
        user2_gender = user2_profile.get("gender")
        if preferred_gender and user2_gender:
            checks_performed += 1
            if preferred_gender != user2_gender and preferred_gender != "any":
                alignment_score -= 0.4

        # If no checks were performed, return neutral score
        if checks_performed == 0:
            return 0.7

        return max(0.0, min(1.0, alignment_score))

    @staticmethod
    def generate_match_reasons(
        breakdown: Dict[str, float],
        shared_interests: List[str],
        personality_details: Dict[str, float],
    ) -> List[str]:
        """
        Generate human-readable match reasons based on compatibility breakdown.
        
        Args:
            breakdown: Score breakdown (personality, interests, values)
            shared_interests: List of shared interests
            personality_details: Detailed personality category scores
            
        Returns:
            List of match reason strings
        """
        reasons = []
        
        # Personality compatibility
        personality_score = breakdown.get("personality", 0)
        if personality_score >= 80:
            reasons.append("Très forte compatibilité de personnalité")
        elif personality_score >= 65:
            reasons.append("Bonne compatibilité de personnalité")
        elif personality_score >= 50:
            reasons.append("Compatibilité de personnalité prometteuse")
        
        # Category-specific reasons
        if personality_details.get("communication", 0) >= 0.75:
            reasons.append("Style de communication compatible")
        
        if personality_details.get("values", 0) >= 0.75:
            reasons.append("Valeurs de vie alignées")
        
        if personality_details.get("lifestyle", 0) >= 0.75:
            reasons.append("Style de vie similaire")
        
        # Interests
        interests_score = breakdown.get("interests", 0)
        if interests_score >= 70 and shared_interests:
            num_interests = min(len(shared_interests), 3)
            interests_list = ", ".join(shared_interests[:num_interests])
            reasons.append(f"Intérêts communs : {interests_list}")
        elif interests_score >= 50 and shared_interests:
            reasons.append(f"{len(shared_interests)} centres d'intérêt en commun")
        
        # Values
        values_score = breakdown.get("values", 0)
        if values_score >= 80:
            reasons.append("Objectifs relationnels très compatibles")
        elif values_score >= 65:
            reasons.append("Objectifs relationnels compatibles")
        
        # If no specific reasons, add a general one
        if not reasons:
            reasons.append("Profil intéressant à découvrir")
        
        return reasons

