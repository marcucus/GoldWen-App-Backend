"""
Redis caching service for compatibility scores.

This module provides caching functionality to improve performance
and reduce redundant calculations.
"""

import json
import logging
from typing import Optional, Dict, Any
import redis
from redis.exceptions import RedisError

logger = logging.getLogger(__name__)


class CacheService:
    """Redis-based cache service for compatibility results."""
    
    def __init__(
        self,
        host: str = "localhost",
        port: int = 6379,
        db: int = 0,
        ttl: int = 3600,  # 1 hour default TTL
        enabled: bool = True,
    ):
        """
        Initialize cache service.
        
        Args:
            host: Redis host
            port: Redis port
            db: Redis database number
            ttl: Time-to-live for cached entries in seconds
            enabled: Whether caching is enabled
        """
        self.ttl = ttl
        self.enabled = enabled
        self.redis_client: Optional[redis.Redis] = None
        
        if enabled:
            try:
                self.redis_client = redis.Redis(
                    host=host,
                    port=port,
                    db=db,
                    decode_responses=True,
                    socket_connect_timeout=5,
                    socket_timeout=5,
                )
                # Test connection
                self.redis_client.ping()
                logger.info(f"Redis cache connected to {host}:{port}")
            except RedisError as e:
                logger.warning(f"Redis connection failed: {e}. Caching disabled.")
                self.enabled = False
                self.redis_client = None
    
    def _make_key(self, user1_id: str, user2_id: str, version: str = "v1") -> str:
        """
        Create a cache key for a compatibility calculation.
        
        Args:
            user1_id: First user ID
            user2_id: Second user ID
            version: Algorithm version (v1 or v2)
            
        Returns:
            Cache key string
        """
        # Sort user IDs to ensure consistency regardless of order
        sorted_ids = tuple(sorted([user1_id, user2_id]))
        return f"compatibility:{version}:{sorted_ids[0]}:{sorted_ids[1]}"
    
    def get(self, user1_id: str, user2_id: str, version: str = "v1") -> Optional[Dict[str, Any]]:
        """
        Retrieve cached compatibility result.
        
        Args:
            user1_id: First user ID
            user2_id: Second user ID
            version: Algorithm version
            
        Returns:
            Cached result dictionary or None if not found
        """
        if not self.enabled or not self.redis_client:
            return None
        
        try:
            key = self._make_key(user1_id, user2_id, version)
            cached = self.redis_client.get(key)
            
            if cached:
                logger.debug(f"Cache hit for {key}")
                return json.loads(cached)
            
            logger.debug(f"Cache miss for {key}")
            return None
            
        except RedisError as e:
            logger.error(f"Redis get error: {e}")
            return None
    
    def set(
        self,
        user1_id: str,
        user2_id: str,
        result: Dict[str, Any],
        version: str = "v1",
        ttl: Optional[int] = None,
    ) -> bool:
        """
        Cache a compatibility result.
        
        Args:
            user1_id: First user ID
            user2_id: Second user ID
            result: Compatibility result to cache
            version: Algorithm version
            ttl: Optional custom TTL (uses default if not provided)
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            key = self._make_key(user1_id, user2_id, version)
            ttl_to_use = ttl if ttl is not None else self.ttl
            
            self.redis_client.setex(
                key,
                ttl_to_use,
                json.dumps(result),
            )
            
            logger.debug(f"Cached result for {key} with TTL {ttl_to_use}s")
            return True
            
        except RedisError as e:
            logger.error(f"Redis set error: {e}")
            return False
    
    def invalidate(self, user1_id: str, user2_id: str, version: str = "v1") -> bool:
        """
        Invalidate a cached compatibility result.
        
        Args:
            user1_id: First user ID
            user2_id: Second user ID
            version: Algorithm version
            
        Returns:
            True if invalidated successfully, False otherwise
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            key = self._make_key(user1_id, user2_id, version)
            deleted = self.redis_client.delete(key)
            
            if deleted:
                logger.debug(f"Invalidated cache for {key}")
            
            return bool(deleted)
            
        except RedisError as e:
            logger.error(f"Redis delete error: {e}")
            return False
    
    def clear_user_cache(self, user_id: str) -> int:
        """
        Clear all cached results for a specific user.
        
        Useful when a user updates their profile or preferences.
        
        Args:
            user_id: User ID to clear cache for
            
        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.redis_client:
            return 0
        
        try:
            # Find all keys containing this user ID
            pattern = f"compatibility:*:*{user_id}*"
            keys = list(self.redis_client.scan_iter(match=pattern))
            
            if keys:
                deleted = self.redis_client.delete(*keys)
                logger.info(f"Cleared {deleted} cached entries for user {user_id}")
                return deleted
            
            return 0
            
        except RedisError as e:
            logger.error(f"Redis clear user cache error: {e}")
            return 0
    
    def health_check(self) -> bool:
        """
        Check if Redis is available.
        
        Returns:
            True if Redis is healthy, False otherwise
        """
        if not self.enabled or not self.redis_client:
            return False
        
        try:
            return self.redis_client.ping()
        except RedisError:
            return False
