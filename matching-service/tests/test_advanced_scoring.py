"""
Unit tests for advanced scoring service.
"""

import pytest
from datetime import datetime, timedelta
from services.advanced_scoring import AdvancedScoringService


class TestActivityScore:
    """Test suite for activity score calculation."""

    def test_very_recent_activity_high_score(self):
        """Users active within 24 hours should get high scores."""
        now = datetime.now()
        last_active = now - timedelta(hours=12)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=last_active,
            last_login_at=None,
            account_created_at=now - timedelta(days=30),
        )
        
        assert 0.9 <= score <= 1.0, f"Expected score 0.9-1.0, got {score}"

    def test_recent_activity_good_score(self):
        """Users active within 3 days should get good scores."""
        now = datetime.now()
        last_active = now - timedelta(days=2)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=last_active,
            last_login_at=None,
            account_created_at=now - timedelta(days=30),
        )
        
        assert 0.7 <= score <= 0.9, f"Expected score 0.7-0.9, got {score}"

    def test_week_old_activity_moderate_score(self):
        """Users active within a week should get moderate scores."""
        now = datetime.now()
        last_active = now - timedelta(days=5)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=last_active,
            last_login_at=None,
            account_created_at=now - timedelta(days=30),
        )
        
        assert 0.5 <= score <= 0.7, f"Expected score 0.5-0.7, got {score}"

    def test_month_old_activity_low_score(self):
        """Users active within a month should get low scores."""
        now = datetime.now()
        last_active = now - timedelta(days=20)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=last_active,
            last_login_at=None,
            account_created_at=now - timedelta(days=60),
        )
        
        assert 0.3 <= score <= 0.5, f"Expected score 0.3-0.5, got {score}"

    def test_very_old_activity_very_low_score(self):
        """Very inactive users should get very low scores."""
        now = datetime.now()
        last_active = now - timedelta(days=60)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=last_active,
            last_login_at=None,
            account_created_at=now - timedelta(days=90),
        )
        
        assert 0.0 <= score < 0.3, f"Expected score 0.0-0.3, got {score}"

    def test_no_activity_data_neutral_score(self):
        """Users with no activity data should get neutral score."""
        now = datetime.now()
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=None,
            last_login_at=None,
            account_created_at=now - timedelta(days=30),
        )
        
        assert score == 0.5

    def test_uses_most_recent_activity(self):
        """Should use the most recent of last_active or last_login."""
        now = datetime.now()
        recent = now - timedelta(hours=6)
        old = now - timedelta(days=10)
        
        score = AdvancedScoringService.calculate_activity_score(
            last_active_at=recent,
            last_login_at=old,
            account_created_at=now - timedelta(days=30),
        )
        
        assert 0.9 <= score <= 1.0


class TestResponseRateScore:
    """Test suite for response rate score calculation."""

    def test_new_user_neutral_score(self):
        """New users with no matches should get benefit of doubt."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=0,
            messages_received=0,
            matches_count=0,
        )
        
        assert score == 0.7

    def test_no_messages_with_matches_low_score(self):
        """Users with matches but no messages should get low score."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=0,
            messages_received=0,
            matches_count=5,
        )
        
        assert score == 0.3

    def test_balanced_conversation_high_score(self):
        """Users with balanced message ratio should get high score."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=50,
            messages_received=50,
            matches_count=5,
        )
        
        assert score >= 0.9

    def test_slightly_responsive_good_score(self):
        """Users slightly less responsive should still get good score."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=30,
            messages_received=50,
            matches_count=5,
        )
        
        assert score >= 0.7

    def test_no_responses_very_low_score(self):
        """Users who receive but don't respond should get very low score."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=0,
            messages_received=50,
            matches_count=5,
        )
        
        assert score == 0.2

    def test_sends_but_no_replies_moderate_score(self):
        """Users who send but get no replies should get moderate score."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=50,
            messages_received=0,
            matches_count=5,
        )
        
        assert score == 0.5

    def test_too_eager_penalized(self):
        """Users who send too many messages should be slightly penalized."""
        score = AdvancedScoringService.calculate_response_rate_score(
            messages_sent=100,
            messages_received=10,
            matches_count=5,
        )
        
        assert score < 0.7


class TestReciprocityScore:
    """Test suite for reciprocity score calculation."""

    def test_many_shared_interests_high_score(self):
        """Many shared interests should contribute to high score."""
        score = AdvancedScoringService.calculate_reciprocity_score(
            mutual_interests_count=8,
            mutual_dealbreaker_alignment=1.0,
            personality_compatibility=0.8,
        )
        
        assert score >= 0.8

    def test_no_shared_interests_lower_score(self):
        """No shared interests should lower the score."""
        score = AdvancedScoringService.calculate_reciprocity_score(
            mutual_interests_count=0,
            mutual_dealbreaker_alignment=1.0,
            personality_compatibility=0.8,
        )
        
        assert score < 0.9

    def test_dealbreaker_misalignment_low_score(self):
        """Dealbreaker misalignment should significantly lower score."""
        score = AdvancedScoringService.calculate_reciprocity_score(
            mutual_interests_count=5,
            mutual_dealbreaker_alignment=0.2,
            personality_compatibility=0.8,
        )
        
        assert score < 0.65  # Dealbreaker at 0.2 still allows some compatibility

    def test_low_personality_compatibility_low_score(self):
        """Low personality compatibility should lower score."""
        score = AdvancedScoringService.calculate_reciprocity_score(
            mutual_interests_count=5,
            mutual_dealbreaker_alignment=1.0,
            personality_compatibility=0.2,
        )
        
        assert score < 0.75  # With perfect dealbreaker and interests, can still be moderate

    def test_all_perfect_high_score(self):
        """Perfect alignment on all factors should give high score."""
        score = AdvancedScoringService.calculate_reciprocity_score(
            mutual_interests_count=10,
            mutual_dealbreaker_alignment=1.0,
            personality_compatibility=1.0,
        )
        
        assert score >= 0.9


class TestAdvancedScore:
    """Test suite for complete advanced scoring."""

    def test_complete_scoring_structure(self):
        """Test that complete scoring returns all expected fields."""
        now = datetime.now()
        user_data = {
            "lastActiveAt": now - timedelta(hours=12),
            "lastLoginAt": now - timedelta(hours=10),
            "createdAt": now - timedelta(days=30),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
            "mutualInterests": 5,
            "dealbreakerAlignment": 0.9,
        }
        
        target_user_data = {
            "lastActiveAt": now - timedelta(hours=8),
            "lastLoginAt": now - timedelta(hours=6),
            "createdAt": now - timedelta(days=25),
            "messagesSent": 40,
            "messagesReceived": 45,
            "matchesCount": 4,
            "mutualInterests": 5,
            "dealbreakerAlignment": 0.9,
        }
        
        result = AdvancedScoringService.calculate_advanced_score(
            user_data=user_data,
            target_user_data=target_user_data,
            personality_compatibility=0.8,
        )
        
        # Check all required fields are present
        assert "activityScore" in result
        assert "responseRateScore" in result
        assert "reciprocityScore" in result
        assert "advancedScore" in result
        assert "details" in result
        
        # Check all scores are in valid range
        assert 0.0 <= result["activityScore"] <= 1.0
        assert 0.0 <= result["responseRateScore"] <= 1.0
        assert 0.0 <= result["reciprocityScore"] <= 1.0
        assert 0.0 <= result["advancedScore"] <= 1.0

    def test_both_users_very_active_high_activity_score(self):
        """Both active users should result in high activity score."""
        now = datetime.now()
        user_data = {
            "lastActiveAt": now - timedelta(hours=2),
            "lastLoginAt": now - timedelta(hours=1),
            "createdAt": now - timedelta(days=30),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
            "mutualInterests": 3,
            "dealbreakerAlignment": 0.8,
        }
        
        target_user_data = {
            "lastActiveAt": now - timedelta(hours=3),
            "lastLoginAt": now - timedelta(hours=2),
            "createdAt": now - timedelta(days=25),
            "messagesSent": 45,
            "messagesReceived": 50,
            "matchesCount": 4,
            "mutualInterests": 3,
            "dealbreakerAlignment": 0.8,
        }
        
        result = AdvancedScoringService.calculate_advanced_score(
            user_data=user_data,
            target_user_data=target_user_data,
            personality_compatibility=0.7,
        )
        
        assert result["activityScore"] >= 0.9

    def test_one_inactive_user_lowers_activity_score(self):
        """One inactive user should lower the activity score."""
        now = datetime.now()
        user_data = {
            "lastActiveAt": now - timedelta(hours=2),
            "lastLoginAt": now - timedelta(hours=1),
            "createdAt": now - timedelta(days=30),
            "messagesSent": 50,
            "messagesReceived": 50,
            "matchesCount": 5,
            "mutualInterests": 3,
            "dealbreakerAlignment": 0.8,
        }
        
        target_user_data = {
            "lastActiveAt": now - timedelta(days=40),
            "lastLoginAt": now - timedelta(days=40),
            "createdAt": now - timedelta(days=60),
            "messagesSent": 45,
            "messagesReceived": 50,
            "matchesCount": 4,
            "mutualInterests": 3,
            "dealbreakerAlignment": 0.8,
        }
        
        result = AdvancedScoringService.calculate_advanced_score(
            user_data=user_data,
            target_user_data=target_user_data,
            personality_compatibility=0.7,
        )
        
        assert result["activityScore"] < 0.6

    def test_weights_sum_correctly(self):
        """Test that the weights for factors sum to approximately 1.0."""
        total_weight = (
            AdvancedScoringService.ACTIVITY_WEIGHT
            + AdvancedScoringService.RESPONSE_RATE_WEIGHT
            + AdvancedScoringService.RECIPROCITY_WEIGHT
        )
        
        assert abs(total_weight - 1.0) < 0.001
