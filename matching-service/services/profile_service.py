"""
Profile fetching service.

This service provides functions to fetch user profiles from the database
and convert them to the format expected by the compatibility calculator.
"""

import logging
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from models.database_models import User, Profile, PersonalityAnswer

logger = logging.getLogger(__name__)


def fetch_user_profile(db: Session, user_id: str) -> Optional[Dict[str, Any]]:
    """
    Fetch a complete user profile from the database.
    
    Args:
        db: Database session
        user_id: User UUID
        
    Returns:
        User profile dictionary or None if not found
    """
    try:
        # Fetch user with profile and personality answers
        user = db.query(User).filter(User.id == user_id).first()
        
        if not user or not user.profile:
            logger.warning(f"User {user_id} not found or has no profile")
            return None
        
        profile = user.profile
        
        # Convert personality answers to expected format
        personality_answers = []
        for answer in user.personality_answers:
            answer_dict = {
                "questionId": str(answer.questionId),
                "category": answer.category or "personality",
            }
            
            if answer.numericAnswer is not None:
                answer_dict["numericAnswer"] = answer.numericAnswer
            if answer.booleanAnswer is not None:
                answer_dict["booleanAnswer"] = answer.booleanAnswer
            if answer.multipleChoiceAnswer is not None:
                answer_dict["multipleChoiceAnswer"] = answer.multipleChoiceAnswer
            if answer.textAnswer is not None:
                answer_dict["textAnswer"] = answer.textAnswer
            
            personality_answers.append(answer_dict)
        
        # Build profile dictionary
        user_profile = {
            "userId": str(user.id),
            "age": _calculate_age(profile.birthDate) if profile.birthDate else None,
            "gender": profile.gender.value if profile.gender else None,
            "interests": profile.interests or [],
            "languages": profile.languages or [],
            "personalityAnswers": personality_answers,
            "preferences": {
                "minAge": profile.minAge,
                "maxAge": profile.maxAge,
                "gender": None,  # Would need to map from interestedInGenders
                "maxDistance": profile.maxDistance,
            },
            "latitude": profile.latitude,
            "longitude": profile.longitude,
            "lastActiveAt": user.lastActiveAt.isoformat() if user.lastActiveAt else None,
            "lastLoginAt": user.lastActiveAt.isoformat() if user.lastActiveAt else None,
            "createdAt": user.createdAt.isoformat() if user.createdAt else None,
            "messagesSent": 0,  # Would need to query messages table
            "messagesReceived": 0,  # Would need to query messages table
            "matchesCount": 0,  # Would need to query matches table
        }
        
        return user_profile
        
    except Exception as e:
        logger.error(f"Error fetching user profile {user_id}: {str(e)}", exc_info=True)
        return None


def fetch_available_profiles(
    db: Session,
    user_id: str,
    exclude_user_ids: List[str],
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """
    Fetch available profiles for matching, excluding specified users.
    
    Args:
        db: Database session
        user_id: Current user's UUID
        exclude_user_ids: List of user UUIDs to exclude
        limit: Maximum number of profiles to return
        
    Returns:
        List of user profile dictionaries
    """
    try:
        # Fetch user's own profile first to apply filters
        current_user_profile = fetch_user_profile(db, user_id)
        if not current_user_profile:
            logger.warning(f"Could not fetch current user profile: {user_id}")
            return []
        
        # Build exclude list (current user + explicitly excluded)
        all_exclude_ids = set(exclude_user_ids + [user_id])
        
        # Query for active profiles
        # Note: In production, add more filters based on preferences
        query = (
            db.query(User)
            .join(Profile)
            .filter(
                Profile.status == "active",
                ~User.id.in_(all_exclude_ids),
            )
            .limit(limit)
        )
        
        users = query.all()
        
        # Convert to profile dictionaries
        profiles = []
        for user in users:
            profile = fetch_user_profile(db, str(user.id))
            if profile:
                profiles.append(profile)
        
        logger.info(f"Fetched {len(profiles)} available profiles for user {user_id}")
        return profiles
        
    except Exception as e:
        logger.error(f"Error fetching available profiles: {str(e)}", exc_info=True)
        return []


def _calculate_age(birth_date) -> Optional[int]:
    """Calculate age from birth date."""
    if not birth_date:
        return None
    
    from datetime import datetime
    today = datetime.now()
    age = today.year - birth_date.year
    
    # Adjust if birthday hasn't occurred this year
    if today.month < birth_date.month or (
        today.month == birth_date.month and today.day < birth_date.day
    ):
        age -= 1
    
    return age
