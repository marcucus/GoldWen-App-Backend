"""
Database configuration and connection for the matching service.

This module provides SQLAlchemy ORM connection to PostgreSQL
to fetch user profiles for matching calculations.
"""

import os
import logging
from typing import Optional
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

logger = logging.getLogger(__name__)

# Database URL from environment variable
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://goldwen_user:goldwen_password@localhost:5432/goldwen_db"
)

# Create SQLAlchemy engine
engine = None
SessionLocal = None
Base = declarative_base()


def init_database():
    """Initialize database connection."""
    global engine, SessionLocal
    
    try:
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,  # Verify connections before using them
            pool_size=10,
            max_overflow=20,
        )
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info("Database connection initialized successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to initialize database: {str(e)}")
        return False


def get_db() -> Session:
    """
    Get a database session.
    
    Yields:
        Database session
    """
    if SessionLocal is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def check_database_connection() -> bool:
    """
    Check if database connection is available.
    
    Returns:
        True if connection is working, False otherwise
    """
    if engine is None:
        return False
    
    try:
        with engine.connect() as conn:
            conn.execute("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database connection check failed: {str(e)}")
        return False
