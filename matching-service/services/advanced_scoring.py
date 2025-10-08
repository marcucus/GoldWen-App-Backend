"""
Advanced Scoring Module for Matching Algorithm V2

This module implements advanced scoring factors:
- User activity scoring
- Response rate scoring
- Potential reciprocity scoring
"""

from datetime import datetime, timedelta
from typing import Dict, Optional


class AdvancedScoringService:
    """Service for calculating advanced scoring factors in the matching algorithm."""

    # Weights for different scoring components (must sum to 1.0)
    ACTIVITY_WEIGHT = 0.3
    RESPONSE_RATE_WEIGHT = 0.4
    RECIPROCITY_WEIGHT = 0.3

    @staticmethod
    def calculate_activity_score(
        last_active_at: Optional[datetime],
        last_login_at: Optional[datetime],
        account_created_at: datetime,
    ) -> float:
        """
        Calculate user activity score based on recent activity.
        
        Args:
            last_active_at: When the user was last active
            last_login_at: When the user last logged in
            account_created_at: When the account was created
            
        Returns:
            Activity score between 0.0 and 1.0
        """
        from datetime import timezone
        
        now = datetime.now(timezone.utc)
        
        # Ensure all datetimes are timezone-aware
        if last_active_at and last_active_at.tzinfo is None:
            last_active_at = last_active_at.replace(tzinfo=timezone.utc)
        if last_login_at and last_login_at.tzinfo is None:
            last_login_at = last_login_at.replace(tzinfo=timezone.utc)
        if account_created_at and account_created_at.tzinfo is None:
            account_created_at = account_created_at.replace(tzinfo=timezone.utc)
        
        # If no activity data, return neutral score
        if not last_active_at and not last_login_at:
            return 0.5
        
        # Use the most recent activity indicator
        most_recent = last_active_at or last_login_at
        if last_login_at and last_active_at:
            most_recent = max(last_active_at, last_login_at)
        
        # Calculate hours since last activity
        hours_since_activity = (now - most_recent).total_seconds() / 3600
        
        # Score based on recency (exponential decay)
        # Active within 24h: 0.9-1.0
        # Active within 3 days: 0.7-0.9
        # Active within 7 days: 0.5-0.7
        # Active within 30 days: 0.3-0.5
        # Older than 30 days: 0.0-0.3
        
        if hours_since_activity <= 24:
            return 1.0 - (hours_since_activity / 24) * 0.1  # 0.9-1.0
        elif hours_since_activity <= 72:  # 3 days
            return 0.9 - ((hours_since_activity - 24) / 48) * 0.2  # 0.7-0.9
        elif hours_since_activity <= 168:  # 7 days
            return 0.7 - ((hours_since_activity - 72) / 96) * 0.2  # 0.5-0.7
        elif hours_since_activity <= 720:  # 30 days
            return 0.5 - ((hours_since_activity - 168) / 552) * 0.2  # 0.3-0.5
        else:
            # Very inactive users get minimal score
            return max(0.0, 0.3 - ((hours_since_activity - 720) / 720) * 0.3)

    @staticmethod
    def calculate_response_rate_score(
        messages_sent: int,
        messages_received: int,
        matches_count: int,
    ) -> float:
        """
        Calculate response rate score based on messaging activity.
        
        A good response rate indicates an engaged user who actively participates
        in conversations rather than just collecting matches.
        
        Args:
            messages_sent: Number of messages sent by the user
            messages_received: Number of messages received by the user
            matches_count: Total number of matches the user has
            
        Returns:
            Response rate score between 0.0 and 1.0
        """
        # No matches yet - return neutral score
        if matches_count == 0:
            return 0.7  # Give benefit of doubt to new users
        
        # No messages exchanged - low score
        if messages_sent == 0 and messages_received == 0:
            return 0.3
        
        # Calculate response ratio
        # Ideal ratio is close to 1.0 (balanced conversation)
        if messages_received == 0:
            # User sends messages but gets no replies - moderate score
            return 0.5
        
        if messages_sent == 0:
            # User receives but doesn't respond - low score
            return 0.2
        
        # Calculate ratio (balanced around 1.0)
        ratio = messages_sent / messages_received
        
        # Optimal range: 0.7 to 1.5 (slightly favoring responsive users)
        if 0.7 <= ratio <= 1.5:
            score = 1.0
        elif ratio < 0.7:
            # Not responsive enough
            score = max(0.2, ratio / 0.7)
        else:
            # Too eager (potential spam/desperate behavior)
            score = max(0.5, 1.0 - (ratio - 1.5) * 0.2)
        
        # Adjust based on absolute activity level
        # Users with higher absolute message counts get slight bonus
        message_activity = min(messages_sent + messages_received, 100) / 100
        activity_bonus = message_activity * 0.1
        
        return min(1.0, score + activity_bonus)

    @staticmethod
    def calculate_reciprocity_score(
        mutual_interests_count: int,
        mutual_dealbreaker_alignment: float,
        personality_compatibility: float,
    ) -> float:
        """
        Calculate potential reciprocity score based on mutual indicators.
        
        This predicts the likelihood of mutual interest based on:
        - Shared interests
        - Alignment on dealbreakers
        - Personality compatibility
        
        Args:
            mutual_interests_count: Number of shared interests
            mutual_dealbreaker_alignment: How well dealbreakers align (0.0-1.0)
            personality_compatibility: Base personality score (0.0-1.0)
            
        Returns:
            Reciprocity score between 0.0 and 1.0
        """
        # Interest score: More shared interests = higher score
        # Assuming typical users have 5-10 interests
        interest_score = min(1.0, mutual_interests_count / 5)
        
        # Dealbreaker alignment is critical
        # Weight it heavily as misalignment = likely rejection
        dealbreaker_score = mutual_dealbreaker_alignment
        
        # Personality compatibility as baseline
        personality_score = personality_compatibility
        
        # Weighted combination
        # Dealbreakers are most important (40%)
        # Personality is very important (35%)
        # Shared interests matter (25%)
        reciprocity = (
            dealbreaker_score * 0.40
            + personality_score * 0.35
            + interest_score * 0.25
        )
        
        return min(1.0, max(0.0, reciprocity))

    @classmethod
    def calculate_advanced_score(
        cls,
        user_data: Dict,
        target_user_data: Dict,
        personality_compatibility: float,
    ) -> Dict[str, float]:
        """
        Calculate the complete advanced score combining all factors.
        
        Args:
            user_data: Dictionary containing user's data
            target_user_data: Dictionary containing target user's data
            personality_compatibility: Base personality compatibility score (0.0-1.0)
            
        Returns:
            Dictionary with detailed scores and final advanced score
        """
        # Extract user activity data
        user_activity = cls.calculate_activity_score(
            last_active_at=user_data.get("lastActiveAt"),
            last_login_at=user_data.get("lastLoginAt"),
            account_created_at=user_data.get("createdAt", datetime.now()),
        )
        
        target_activity = cls.calculate_activity_score(
            last_active_at=target_user_data.get("lastActiveAt"),
            last_login_at=target_user_data.get("lastLoginAt"),
            account_created_at=target_user_data.get("createdAt", datetime.now()),
        )
        
        # Average activity score (both users should be active)
        activity_score = (user_activity + target_activity) / 2
        
        # Calculate response rate for both users
        user_response = cls.calculate_response_rate_score(
            messages_sent=user_data.get("messagesSent", 0),
            messages_received=user_data.get("messagesReceived", 0),
            matches_count=user_data.get("matchesCount", 0),
        )
        
        target_response = cls.calculate_response_rate_score(
            messages_sent=target_user_data.get("messagesSent", 0),
            messages_received=target_user_data.get("messagesReceived", 0),
            matches_count=target_user_data.get("matchesCount", 0),
        )
        
        # Average response rate
        response_rate_score = (user_response + target_response) / 2
        
        # Calculate reciprocity score
        reciprocity_score = cls.calculate_reciprocity_score(
            mutual_interests_count=user_data.get("mutualInterests", 0),
            mutual_dealbreaker_alignment=user_data.get(
                "dealbreakerAlignment", 0.7
            ),  # Default neutral
            personality_compatibility=personality_compatibility,
        )
        
        # Weighted combination of all factors
        final_score = (
            activity_score * cls.ACTIVITY_WEIGHT
            + response_rate_score * cls.RESPONSE_RATE_WEIGHT
            + reciprocity_score * cls.RECIPROCITY_WEIGHT
        )
        
        return {
            "activityScore": round(activity_score, 3),
            "responseRateScore": round(response_rate_score, 3),
            "reciprocityScore": round(reciprocity_score, 3),
            "advancedScore": round(final_score, 3),
            "details": {
                "userActivity": round(user_activity, 3),
                "targetActivity": round(target_activity, 3),
                "userResponseRate": round(user_response, 3),
                "targetResponseRate": round(target_response, 3),
            },
        }
