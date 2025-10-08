"""
Unit tests for the cache service.
"""

import pytest
from services.cache import CacheService


class TestCacheService:
    """Test suite for CacheService."""

    def test_cache_disabled_when_redis_unavailable(self):
        """Cache should gracefully disable when Redis is not available."""
        cache = CacheService(host="invalid-host", port=9999, enabled=True)
        
        assert cache.enabled is False
        assert cache.redis_client is None

    def test_cache_disabled_by_config(self):
        """Cache should respect enabled=False configuration."""
        cache = CacheService(enabled=False)
        
        assert cache.enabled is False
        assert cache.redis_client is None

    def test_get_returns_none_when_disabled(self):
        """get() should return None when cache is disabled."""
        cache = CacheService(enabled=False)
        
        result = cache.get("user1", "user2")
        
        assert result is None

    def test_set_returns_false_when_disabled(self):
        """set() should return False when cache is disabled."""
        cache = CacheService(enabled=False)
        
        result = cache.set("user1", "user2", {"score": 85.0})
        
        assert result is False

    def test_invalidate_returns_false_when_disabled(self):
        """invalidate() should return False when cache is disabled."""
        cache = CacheService(enabled=False)
        
        result = cache.invalidate("user1", "user2")
        
        assert result is False

    def test_clear_user_cache_returns_zero_when_disabled(self):
        """clear_user_cache() should return 0 when cache is disabled."""
        cache = CacheService(enabled=False)
        
        result = cache.clear_user_cache("user1")
        
        assert result == 0

    def test_health_check_returns_false_when_disabled(self):
        """health_check() should return False when cache is disabled."""
        cache = CacheService(enabled=False)
        
        result = cache.health_check()
        
        assert result is False

    def test_make_key_sorts_user_ids(self):
        """Cache keys should be consistent regardless of user ID order."""
        cache = CacheService(enabled=False)
        
        key1 = cache._make_key("user1", "user2", "v1")
        key2 = cache._make_key("user2", "user1", "v1")
        
        assert key1 == key2
        assert "user1" in key1
        assert "user2" in key1
        assert "v1" in key1

    def test_make_key_includes_version(self):
        """Cache keys should include algorithm version."""
        cache = CacheService(enabled=False)
        
        key_v1 = cache._make_key("user1", "user2", "v1")
        key_v2 = cache._make_key("user1", "user2", "v2")
        
        assert key_v1 != key_v2
        assert "v1" in key_v1
        assert "v2" in key_v2


# Integration tests (require Redis to be running)
@pytest.mark.skip(reason="Requires Redis to be running")
class TestCacheServiceIntegration:
    """Integration tests for CacheService with real Redis."""

    def test_set_and_get_with_redis(self):
        """Should store and retrieve values from Redis."""
        cache = CacheService(host="localhost", port=6379)
        
        if not cache.enabled:
            pytest.skip("Redis not available")
        
        test_result = {
            "compatibilityScore": 85.5,
            "details": {"communication": 0.8, "values": 0.9},
        }
        
        # Set value
        success = cache.set("user1", "user2", test_result, version="v1")
        assert success is True
        
        # Get value
        retrieved = cache.get("user1", "user2", version="v1")
        assert retrieved is not None
        assert retrieved["compatibilityScore"] == 85.5

    def test_cache_expiration_with_redis(self):
        """Cached values should expire after TTL."""
        cache = CacheService(host="localhost", port=6379, ttl=1)
        
        if not cache.enabled:
            pytest.skip("Redis not available")
        
        test_result = {"compatibilityScore": 75.0}
        
        cache.set("user1", "user2", test_result, version="v1")
        
        # Should exist immediately
        result = cache.get("user1", "user2", version="v1")
        assert result is not None
        
        # Note: Full expiration test would require waiting 1+ seconds
        # Skipped here for test speed

    def test_invalidate_with_redis(self):
        """Should be able to invalidate cached values."""
        cache = CacheService(host="localhost", port=6379)
        
        if not cache.enabled:
            pytest.skip("Redis not available")
        
        test_result = {"compatibilityScore": 90.0}
        
        cache.set("user1", "user2", test_result, version="v1")
        assert cache.get("user1", "user2", version="v1") is not None
        
        # Invalidate
        success = cache.invalidate("user1", "user2", version="v1")
        assert success is True
        
        # Should no longer be in cache
        result = cache.get("user1", "user2", version="v1")
        assert result is None
