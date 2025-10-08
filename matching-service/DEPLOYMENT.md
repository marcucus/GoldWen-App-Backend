# Matching Service - Deployment Guide

This guide covers different deployment scenarios for the GoldWen Matching Service.

## Table of Contents
1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Monitoring](#monitoring)
6. [Troubleshooting](#troubleshooting)

## Local Development

### Requirements
- Python 3.12+
- Redis (optional, for caching)

### Setup

1. Install dependencies:
```bash
cd matching-service
pip install -r requirements.txt
```

2. Run the service:
```bash
python main.py
```

The service will be available at `http://localhost:8000`

## Docker Deployment

### Using Docker Compose (Recommended)

This is the easiest way to run the matching service with all dependencies.

1. From the repository root:
```bash
docker compose up matching-service
```

2. Or build and run all services:
```bash
docker compose up --build
```

3. Access the service:
- API: http://localhost:8000
- Health Check: http://localhost:8000/health
- API Docs: http://localhost:8000/docs

### Using Docker Only

1. Build the image:
```bash
cd matching-service
docker build -t goldwen-matching-service .
```

2. Run with Redis:
```bash
docker run -d \
  --name matching-service \
  -p 8000:8000 \
  -e REDIS_HOST=redis \
  -e REDIS_PORT=6379 \
  --network goldwen_network \
  goldwen-matching-service
```

3. Run without Redis:
```bash
docker run -d \
  --name matching-service \
  -p 8000:8000 \
  -e CACHE_ENABLED=false \
  goldwen-matching-service
```

## Production Deployment

### Prerequisites

- Docker and Docker Compose installed
- Redis instance (can be part of docker-compose)
- Reverse proxy (nginx/traefik) for HTTPS
- Monitoring tools (Prometheus/Grafana recommended)

### Steps

1. **Configure Environment Variables**

Create a `.env` file:
```env
# API Security
MATCHING_SERVICE_API_KEY=your-secure-random-key-here

# Redis Configuration
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
CACHE_TTL=3600
CACHE_ENABLED=true

# Server Configuration
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=info
```

2. **Update docker-compose.yml for production**

Add resource limits and restart policies:
```yaml
matching-service:
  build:
    context: ./matching-service
    dockerfile: Dockerfile
  container_name: goldwen_matching_service
  env_file:
    - .env
  ports:
    - "8000:8000"
  depends_on:
    - redis
  restart: unless-stopped
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
      reservations:
        cpus: '0.5'
        memory: 512M
```

3. **Deploy**

```bash
docker compose up -d
```

4. **Verify Deployment**

```bash
# Check health
curl http://localhost:8000/health

# Check logs
docker logs goldwen_matching_service

# Monitor resource usage
docker stats goldwen_matching_service
```

### Scaling

For high traffic, you can run multiple instances:

```bash
# Scale to 3 instances
docker compose up -d --scale matching-service=3
```

Use a load balancer (nginx/traefik) to distribute traffic.

## Environment Configuration

### Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `MATCHING_SERVICE_API_KEY` | API authentication key | `matching-service-secret-key` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis server hostname | `localhost` |
| `REDIS_PORT` | Redis server port | `6379` |
| `REDIS_DB` | Redis database number | `0` |
| `CACHE_TTL` | Cache time-to-live (seconds) | `3600` |
| `CACHE_ENABLED` | Enable/disable Redis caching | `true` |
| `HOST` | Service bind address | `0.0.0.0` |
| `PORT` | Service port | `8000` |
| `LOG_LEVEL` | Logging level | `info` |

### Security Best Practices

1. **Never commit API keys** - Use environment variables
2. **Use strong API keys** - Generate with: `openssl rand -hex 32`
3. **Enable HTTPS** - Use reverse proxy with SSL certificates
4. **Restrict CORS** - Configure allowed origins in production
5. **Monitor logs** - Watch for suspicious API key usage

## Monitoring

### Health Checks

The service includes built-in health checks:

```bash
# Docker health check
docker inspect --format='{{.State.Health.Status}}' goldwen_matching_service

# Direct health check
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "2.0.0",
  "timestamp": "2025-01-08T12:00:00.000000"
}
```

### Metrics

Check algorithm statistics:
```bash
curl -H "X-API-Key: your-api-key" http://localhost:8000/api/v1/matching-service/algorithm/stats
```

Response includes:
- Total calculations
- Average compatibility score
- Last update timestamp
- Service status

### Logs

View service logs:
```bash
# Follow logs
docker logs -f goldwen_matching_service

# Last 100 lines
docker logs --tail 100 goldwen_matching_service

# Logs with timestamps
docker logs --timestamps goldwen_matching_service
```

### Redis Monitoring

Check Redis cache status:
```bash
# Connect to Redis
docker exec -it goldwen_redis redis-cli

# Check keys
KEYS compatibility:*

# Monitor commands
MONITOR
```

## Troubleshooting

### Service Won't Start

**Check logs:**
```bash
docker logs goldwen_matching_service
```

**Common issues:**
- Port 8000 already in use
- Redis connection failed (service will run without cache)
- Missing dependencies (rebuild image)

### High Memory Usage

**Check stats:**
```bash
docker stats goldwen_matching_service
```

**Solutions:**
- Reduce cache TTL
- Limit Redis memory: `maxmemory 256mb` in redis.conf
- Scale horizontally instead of vertically

### Slow Response Times

**Possible causes:**
1. Redis not connected (check logs)
2. Complex calculations (expected for V2 algorithm)
3. Network latency

**Solutions:**
- Enable Redis caching
- Use batch endpoints for multiple calculations
- Monitor with application performance monitoring (APM)

### API Key Rejected

**Verify:**
1. Header format: `X-API-Key: your-key-here`
2. Key matches environment variable
3. No extra spaces or characters

**Test:**
```bash
curl -H "X-API-Key: matching-service-secret-key" \
  http://localhost:8000/api/v1/matching-service/algorithm/stats
```

### Redis Connection Failed

**Service will continue without caching**

**Check:**
```bash
# Test Redis connection
docker exec -it goldwen_redis redis-cli ping

# Verify network
docker network inspect goldwen_network
```

**Fix:**
- Ensure Redis is running
- Check REDIS_HOST and REDIS_PORT
- Verify network connectivity
- Set CACHE_ENABLED=false as temporary workaround

## Backup and Recovery

### Backup Strategies

**Application State:**
- Service is stateless
- No data persistence needed
- Configuration in environment variables

**Redis Cache:**
- Optional backup (cache is regenerable)
- Use Redis RDB snapshots if needed
- Configure in redis.conf:
  ```
  save 900 1
  save 300 10
  save 60 10000
  ```

### Disaster Recovery

1. **Service Failure:**
   ```bash
   docker compose restart matching-service
   ```

2. **Complete Rebuild:**
   ```bash
   docker compose down
   docker compose up --build -d
   ```

3. **Redis Failure:**
   - Service continues without cache
   - Restart Redis to restore caching
   - Cache will rebuild automatically

## Performance Optimization

### Recommendations

1. **Enable Redis caching** - 10-100x faster for repeated calculations
2. **Use batch endpoints** - Process multiple profiles efficiently
3. **Set appropriate cache TTL** - Balance freshness vs performance
4. **Monitor resource usage** - Scale when needed
5. **Use connection pooling** - If integrating with databases

### Benchmarking

Run performance tests:
```bash
cd matching-service
python benchmark.py
```

Expected performance (without Redis):
- V1 compatibility: ~1-2ms per calculation
- V2 compatibility: ~2-5ms per calculation
- Batch processing: ~100-500 profiles/second

With Redis caching:
- Cached results: <1ms retrieval time

## Support

For issues or questions:
1. Check logs: `docker logs goldwen_matching_service`
2. Review documentation: [README.md](README.md)
3. Check health endpoint: `/health`
4. Review API docs: `/docs`
