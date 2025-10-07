"""
Unit tests for compatibility calculator.
"""

import pytest
from datetime import datetime, timedelta
from services.compatibility_calculator import CompatibilityCalculator


class TestPersonalityScore:
    """Test suite for personality score calculation."""

    def test_no_answers_neutral_score(self):
        """Users with no personality answers should get neutral score."""
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=[],
            user2_answers=[],
        )
        
        assert result["personalityScore"] == 0.5
        assert result["communication"] == 0.5
        assert result["values"] == 0.5

    def test_identical_numeric_answers_perfect_score(self):
        """Identical numeric answers should give perfect score."""
        answers1 = [
            {"questionId": "q1", "numericAnswer": 7, "category": "values"}
        ]
        answers2 = [
            {"questionId": "q1", "numericAnswer": 7, "category": "values"}
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 1.0

    def test_opposite_numeric_answers_low_score(self):
        """Opposite numeric answers (1 vs 10) should give low score."""
        answers1 = [
            {"questionId": "q1", "numericAnswer": 1, "category": "values"}
        ]
        answers2 = [
            {"questionId": "q1", "numericAnswer": 10, "category": "values"}
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] < 0.2

    def test_identical_boolean_answers_perfect_score(self):
        """Identical boolean answers should give perfect score."""
        answers1 = [
            {"questionId": "q1", "booleanAnswer": True, "category": "lifestyle"}
        ]
        answers2 = [
            {"questionId": "q1", "booleanAnswer": True, "category": "lifestyle"}
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 1.0

    def test_opposite_boolean_answers_zero_score(self):
        """Opposite boolean answers should give zero score."""
        answers1 = [
            {"questionId": "q1", "booleanAnswer": True, "category": "lifestyle"}
        ]
        answers2 = [
            {"questionId": "q1", "booleanAnswer": False, "category": "lifestyle"}
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 0.0

    def test_multiple_choice_all_same_perfect_score(self):
        """All same multiple choice answers should give perfect score."""
        answers1 = [
            {
                "questionId": "q1",
                "multipleChoiceAnswer": ["a", "b", "c"],
                "category": "communication",
            }
        ]
        answers2 = [
            {
                "questionId": "q1",
                "multipleChoiceAnswer": ["a", "b", "c"],
                "category": "communication",
            }
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 1.0

    def test_multiple_choice_partial_overlap_partial_score(self):
        """Partial overlap in multiple choice should give partial score."""
        answers1 = [
            {
                "questionId": "q1",
                "multipleChoiceAnswer": ["a", "b"],
                "category": "communication",
            }
        ]
        answers2 = [
            {
                "questionId": "q1",
                "multipleChoiceAnswer": ["b", "c"],
                "category": "communication",
            }
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        # Overlap: {b}, Total: {a, b, c} = 1/3
        assert abs(result["personalityScore"] - 0.333) < 0.01

    def test_text_answers_identical_high_score(self):
        """Identical text answers should give high score."""
        answers1 = [
            {
                "questionId": "q1",
                "textAnswer": "Adventure",
                "category": "personality",
            }
        ]
        answers2 = [
            {
                "questionId": "q1",
                "textAnswer": "Adventure",
                "category": "personality",
            }
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 1.0

    def test_text_answers_different_moderate_score(self):
        """Different text answers should give moderate score."""
        answers1 = [
            {
                "questionId": "q1",
                "textAnswer": "Adventure",
                "category": "personality",
            }
        ]
        answers2 = [
            {
                "questionId": "q1",
                "textAnswer": "Relaxation",
                "category": "personality",
            }
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["personalityScore"] == 0.5

    def test_category_breakdown(self):
        """Test that category breakdown is calculated correctly."""
        answers1 = [
            {"questionId": "q1", "booleanAnswer": True, "category": "communication"},
            {"questionId": "q2", "booleanAnswer": True, "category": "values"},
            {"questionId": "q3", "booleanAnswer": True, "category": "lifestyle"},
        ]
        answers2 = [
            {"questionId": "q1", "booleanAnswer": True, "category": "communication"},
            {"questionId": "q2", "booleanAnswer": False, "category": "values"},
            {"questionId": "q3", "booleanAnswer": True, "category": "lifestyle"},
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        assert result["communication"] == 1.0
        assert result["values"] == 0.0
        assert result["lifestyle"] == 1.0

    def test_mixed_answer_types(self):
        """Test handling of mixed answer types."""
        answers1 = [
            {"questionId": "q1", "numericAnswer": 7, "category": "values"},
            {"questionId": "q2", "booleanAnswer": True, "category": "lifestyle"},
            {
                "questionId": "q3",
                "multipleChoiceAnswer": ["a", "b"],
                "category": "communication",
            },
        ]
        answers2 = [
            {"questionId": "q1", "numericAnswer": 8, "category": "values"},
            {"questionId": "q2", "booleanAnswer": True, "category": "lifestyle"},
            {
                "questionId": "q3",
                "multipleChoiceAnswer": ["b", "c"],
                "category": "communication",
            },
        ]
        
        result = CompatibilityCalculator.calculate_personality_score(
            user1_answers=answers1,
            user2_answers=answers2,
        )
        
        # Should handle all types correctly
        assert 0.0 <= result["personalityScore"] <= 1.0


class TestSharedInterests:
    """Test suite for shared interests extraction."""

    def test_no_interests_empty_list(self):
        """No interests should return empty list."""
        result = CompatibilityCalculator.extract_shared_interests(
            user1_interests=[],
            user2_interests=[],
        )
        
        assert result == []

    def test_no_overlap_empty_list(self):
        """No overlapping interests should return empty list."""
        result = CompatibilityCalculator.extract_shared_interests(
            user1_interests=["hiking", "reading"],
            user2_interests=["cooking", "gaming"],
        )
        
        assert result == []

    def test_some_overlap_returns_shared(self):
        """Some overlapping interests should return shared ones."""
        result = CompatibilityCalculator.extract_shared_interests(
            user1_interests=["hiking", "reading", "travel"],
            user2_interests=["reading", "gaming", "travel"],
        )
        
        assert set(result) == {"reading", "travel"}

    def test_case_insensitive_matching(self):
        """Interest matching should be case insensitive."""
        result = CompatibilityCalculator.extract_shared_interests(
            user1_interests=["Hiking", "READING"],
            user2_interests=["hiking", "reading"],
        )
        
        assert set(result) == {"hiking", "reading"}

    def test_all_same_returns_all(self):
        """All same interests should return all."""
        interests = ["hiking", "reading", "travel"]
        result = CompatibilityCalculator.extract_shared_interests(
            user1_interests=interests,
            user2_interests=interests,
        )
        
        assert set(result) == set(interests)


class TestCompatibilityV1:
    """Test suite for V1 compatibility calculation."""

    def test_v1_returns_required_fields(self):
        """V1 compatibility should return all required fields."""
        profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking", "reading"],
        }
        profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 8, "category": "values"}
            ],
            "interests": ["reading", "travel"],
        }
        
        result = CompatibilityCalculator.calculate_compatibility_v1(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert "compatibilityScore" in result
        assert "details" in result
        assert "sharedInterests" in result

    def test_v1_score_in_valid_range(self):
        """V1 score should be between 0 and 100."""
        profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
        }
        profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 3, "category": "values"}
            ],
            "interests": ["reading"],
        }
        
        result = CompatibilityCalculator.calculate_compatibility_v1(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert 0 <= result["compatibilityScore"] <= 100


class TestCompatibilityV2:
    """Test suite for V2 compatibility calculation."""

    def test_v2_returns_required_fields(self):
        """V2 compatibility should return all required fields."""
        now = datetime.now()
        profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking", "reading"],
            "lastActiveAt": now - timedelta(hours=12),
            "lastLoginAt": now - timedelta(hours=10),
            "createdAt": now - timedelta(days=30),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
        }
        profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 8, "category": "values"}
            ],
            "interests": ["reading", "travel"],
            "lastActiveAt": now - timedelta(hours=8),
            "lastLoginAt": now - timedelta(hours=6),
            "createdAt": now - timedelta(days=25),
            "messagesSent": 40,
            "messagesReceived": 45,
            "matchesCount": 4,
        }
        
        result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert "compatibilityScore" in result
        assert "version" in result
        assert result["version"] == "v2"
        assert "details" in result
        assert "advancedFactors" in result
        assert "sharedInterests" in result
        assert "scoringWeights" in result

    def test_v2_has_advanced_factors(self):
        """V2 should include advanced factors breakdown."""
        now = datetime.now()
        profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(hours=12),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
        }
        profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 8, "category": "values"}
            ],
            "interests": ["reading"],
            "lastActiveAt": now - timedelta(hours=8),
            "messagesSent": 40,
            "messagesReceived": 45,
            "matchesCount": 4,
        }
        
        result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        factors = result["advancedFactors"]
        assert "activityScore" in factors
        assert "responseRateScore" in factors
        assert "reciprocityScore" in factors
        assert "details" in factors

    def test_v2_score_in_valid_range(self):
        """V2 score should be between 0 and 100."""
        now = datetime.now()
        profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 1, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(days=40),
            "messagesSent": 0,
            "messagesReceived": 50,
            "matchesCount": 5,
        }
        profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 10, "category": "values"}
            ],
            "interests": ["reading"],
            "lastActiveAt": now - timedelta(days=35),
            "messagesSent": 0,
            "messagesReceived": 40,
            "matchesCount": 4,
        }
        
        result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert 0 <= result["compatibilityScore"] <= 100

    def test_v2_active_users_higher_than_inactive(self):
        """V2 should score active users higher than inactive ones."""
        now = datetime.now()
        
        # Active users with good personality match
        active_profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(hours=2),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
        }
        active_profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(hours=3),
            "messagesSent": 45,
            "messagesReceived": 50,
            "matchesCount": 4,
        }
        
        # Inactive users with same personality match
        inactive_profile1 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(days=40),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
        }
        inactive_profile2 = {
            "personalityAnswers": [
                {"questionId": "q1", "numericAnswer": 7, "category": "values"}
            ],
            "interests": ["hiking"],
            "lastActiveAt": now - timedelta(days=35),
            "messagesSent": 45,
            "messagesReceived": 50,
            "matchesCount": 4,
        }
        
        active_result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=active_profile1,
            user2_profile=active_profile2,
        )
        
        inactive_result = CompatibilityCalculator.calculate_compatibility_v2(
            user1_profile=inactive_profile1,
            user2_profile=inactive_profile2,
        )
        
        # Active users should score higher
        assert active_result["compatibilityScore"] > inactive_result["compatibilityScore"]


class TestDealbreakerAlignment:
    """Test suite for dealbreaker alignment calculation."""

    def test_age_outside_preference_lowers_score(self):
        """User outside age preference should lower alignment."""
        profile1 = {
            "personalityAnswers": [],
            "interests": [],
            "preferences": {"minAge": 25, "maxAge": 35},
        }
        profile2 = {
            "personalityAnswers": [],
            "interests": [],
            "age": 45,  # Outside range
        }
        
        alignment = CompatibilityCalculator._calculate_dealbreaker_alignment(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert alignment < 1.0

    def test_age_within_preference_good_score(self):
        """User within age preference should maintain good score."""
        profile1 = {
            "personalityAnswers": [],
            "interests": [],
            "preferences": {"minAge": 25, "maxAge": 35},
        }
        profile2 = {
            "personalityAnswers": [],
            "interests": [],
            "age": 30,  # Within range
        }
        
        alignment = CompatibilityCalculator._calculate_dealbreaker_alignment(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert alignment >= 0.9

    def test_no_preferences_neutral_score(self):
        """No preferences should return neutral score."""
        profile1 = {
            "personalityAnswers": [],
            "interests": [],
        }
        profile2 = {
            "personalityAnswers": [],
            "interests": [],
        }
        
        alignment = CompatibilityCalculator._calculate_dealbreaker_alignment(
            user1_profile=profile1,
            user2_profile=profile2,
        )
        
        assert alignment == 0.7
