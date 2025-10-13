"""
Database models for the matching service.

These models mirror the TypeORM entities from the main NestJS API
to allow read-only access to user data for matching calculations.
"""

from sqlalchemy import Column, String, Integer, Boolean, ARRAY, DateTime, Float, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime
import enum

from database import Base


class GenderEnum(str, enum.Enum):
    """Gender enumeration."""
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class ProfileStatusEnum(str, enum.Enum):
    """Profile status enumeration."""
    INCOMPLETE = "incomplete"
    ACTIVE = "active"
    PAUSED = "paused"
    SUSPENDED = "suspended"


class User(Base):
    """User model matching the NestJS User entity."""
    
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    isEmailVerified = Column(Boolean, default=False)
    authProvider = Column(String(50), nullable=False)  # 'google', 'apple', 'email'
    externalId = Column(String(255), nullable=True)
    lastActiveAt = Column(DateTime, nullable=True)
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    profile = relationship("Profile", back_populates="user", uselist=False)
    personality_answers = relationship("PersonalityAnswer", back_populates="user")


class Profile(Base):
    """Profile model matching the NestJS Profile entity."""
    
    __tablename__ = "profiles"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False)
    
    # Basic info
    firstName = Column(String(50), nullable=True)
    lastName = Column(String(50), nullable=True)
    pseudo = Column(String(30), nullable=True)
    birthDate = Column(DateTime, nullable=True)
    gender = Column(SQLEnum(GenderEnum), nullable=True)
    interestedInGenders = Column(ARRAY(String), nullable=True)
    
    # Profile content
    bio = Column(Text, nullable=True)
    job = Column(String(100), nullable=True)
    company = Column(String(100), nullable=True)
    school = Column(String(100), nullable=True)
    
    # Interests and values
    interests = Column(ARRAY(String), default=[])
    languages = Column(ARRAY(String), default=[])
    
    # Location
    city = Column(String(100), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    maxDistance = Column(Integer, default=50)
    
    # Preferences
    minAge = Column(Integer, default=18)
    maxAge = Column(Integer, default=100)
    
    # Status
    status = Column(SQLEnum(ProfileStatusEnum), default=ProfileStatusEnum.INCOMPLETE)
    completionPercentage = Column(Integer, default=0)
    
    # Timestamps
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="profile")


class PersonalityAnswer(Base):
    """PersonalityAnswer model matching the NestJS PersonalityAnswer entity."""
    
    __tablename__ = "personality_answers"
    
    id = Column(UUID(as_uuid=True), primary_key=True)
    userId = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    questionId = Column(UUID(as_uuid=True), nullable=False)
    
    # Answer types (only one should be filled)
    textAnswer = Column(Text, nullable=True)
    numericAnswer = Column(Integer, nullable=True)
    booleanAnswer = Column(Boolean, nullable=True)
    multipleChoiceAnswer = Column(ARRAY(String), nullable=True)
    
    # Metadata
    category = Column(String(50), nullable=True)
    
    # Timestamps
    createdAt = Column(DateTime, default=datetime.utcnow)
    updatedAt = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="personality_answers")
