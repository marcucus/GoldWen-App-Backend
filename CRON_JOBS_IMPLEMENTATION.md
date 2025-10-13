# Critical Cron Jobs Implementation

## Overview
This implementation provides automated scheduled tasks for the GoldWen backend, focusing on matching, chat, and general data cleanup functionalities.

## Module Organization

All cron jobs are now centralized in the **CronJobsModule** (`main-api/src/modules/cron-jobs/cron-jobs.module.ts`), which imports and organizes all schedulers from different modules for better maintainability and discoverability.

## Implemented Schedulers

### 1. Matching Scheduler (`matching.scheduler.ts`)

**Location:** `main-api/src/modules/matching/matching.scheduler.ts`

#### Jobs:

##### Daily Selection Generation
- **Schedule:** `0 12 * * *` (12:00 PM daily)
- **Timezone:** Europe/Paris
- **Purpose:** Generate daily match selections for all users with completed profiles
- **Features:**
  - Processes all eligible users
  - Sends push notifications after selection generation
  - Detailed metrics logging (success/error/skip counts)
  - Error rate monitoring with alerting
  - Graceful error handling (individual failures don't stop batch)

##### Daily Selections Cleanup
- **Schedule:** `0 0 * * *` (Midnight daily)
- **Timezone:** Europe/Paris
- **Purpose:** Clean up old daily selections (>30 days)
- **Features:**
  - Bulk deletion for performance
  - Detailed cleanup metrics logging

### 2. Chat Scheduler (`chat.scheduler.ts`)

**Location:** `main-api/src/modules/chat/chat.scheduler.ts`

#### Jobs:

##### Chat Expiration
- **Schedule:** Every hour
- **Purpose:** Expire chats that have passed their 24-hour limit
- **Features:**
  - Finds and expires active chats past their expiration time
  - Updates chat status to EXPIRED
  - Detailed logging per chat

##### Chat Expiration Warnings
- **Schedule:** Every hour
- **Purpose:** Warn users 2 hours before chat expires
- **Features:**
  - Sends notifications to both users in a chat
  - Calculates remaining time
  - Handles missing profile data gracefully
  - Notification failures don't stop other warnings

##### Old Chats Cleanup
- **Schedule:** `0 0 * * *` (Midnight daily)
- **Timezone:** Europe/Paris
- **Purpose:** Clean up expired chats and messages older than 90 days
- **Features:**
  - Deletes messages first, then chats (referential integrity)
  - Detailed cleanup metrics

### 3. Cleanup Scheduler (`cleanup.scheduler.ts`)

**Location:** `main-api/src/modules/cron-jobs/schedulers/cleanup.scheduler.ts`

#### Jobs:

##### General Data Cleanup
- **Schedule:** `0 3 * * *` (3:00 AM daily)
- **Timezone:** Europe/Paris
- **Purpose:** Clean up old data from various tables
- **Features:**
  - Deletes notifications older than 30 days
  - Comprehensive logging with deletion counts
  - Individual cleanup operations tracked separately
  - Future-ready for additional cleanup tasks (sessions, exports, etc.)

## Architecture Changes

### Before
- Cron jobs were defined directly in service files using `@Cron` decorators
- Mixed business logic with scheduling concerns
- Less detailed logging

### After
- Dedicated scheduler files for each module
- Separation of concerns: services handle business logic, schedulers handle timing
- Enhanced logging with job IDs, execution times, and detailed metrics
- Better error tracking and alerting

## Module Updates

### matching.module.ts
```typescript
providers: [MatchingService, MatchingIntegrationService, MatchingScheduler],
exports: [MatchingService, MatchingIntegrationService, MatchingScheduler],
```

### chat.module.ts
```typescript
providers: [ChatService, ChatGateway, ChatScheduler],
exports: [ChatService, ChatGateway, ChatScheduler],
```

### cron-jobs.module.ts
```typescript
// New centralized module for all schedulers
imports: [
  TypeOrmModule.forFeature([Notification]),
  MatchingModule,
  ChatModule,
],
providers: [CleanupScheduler],
exports: [CleanupScheduler],
```

### app.module.ts
```typescript
// Added to imports array
CronJobsModule,
```

## Testing

### Test Coverage
- **Matching Scheduler:** 11 tests
- **Chat Scheduler:** 13 tests
- **Cleanup Scheduler:** 7 tests
- **Total:** 31 tests, all passing ✅

### Test Categories
1. **Success scenarios:** Normal job execution
2. **Error handling:** Individual and catastrophic failures
3. **Edge cases:** Missing data, notification failures, empty results
4. **Manual triggers:** Development/testing support

## Logging & Monitoring

### Log Levels
- **INFO:** Job start/completion, metrics, user counts
- **WARN:** Individual errors, high error rates, notification failures
- **ERROR:** Catastrophic failures, job failures
- **DEBUG:** Individual item processing details

### Metrics Tracked
- Total items processed
- Success/error/skip counts
- Execution time (ms)
- Success rate (%)
- Error samples (first 5 errors)

### Alert Thresholds
- **WARNING:** Error rate > 0%
- **CRITICAL:** Error rate > 10%

## Development Features

### Manual Triggers
Each scheduler provides manual trigger methods for development/testing:

```typescript
// Matching Scheduler
await matchingScheduler.triggerDailySelectionGeneration();
await matchingScheduler.triggerCleanup();

// Chat Scheduler
await chatScheduler.triggerChatExpiration();
await chatScheduler.triggerExpirationWarnings();
await chatScheduler.triggerCleanup();

// Cleanup Scheduler
await cleanupScheduler.triggerCleanup();
```

**Note:** Manual triggers are only allowed in non-production environments.

## Future Improvements

### TODO Items in Code
1. **Multi-timezone Support:** Currently uses Europe/Paris timezone. Should implement user-specific timezone scheduling.
2. **Alert Integration:** Integrate with monitoring systems (Sentry, Slack, etc.) for critical alerts.
3. **Metrics Dashboard:** Export metrics to monitoring service for visualization.
4. **Rate Limiting:** Add rate limiting to prevent overload during high-volume periods.
5. **Job Queuing:** Consider moving heavy jobs to Bull queues for better scalability.

## Dependencies

- `@nestjs/schedule` (v6.0.0)
- Uses existing repositories and services
- No new external dependencies added

## Performance Considerations

### Optimizations
- Bulk operations for cleanup (single query instead of per-item)
- Early returns for empty result sets
- Async/await for parallel notification sending
- Error isolation (one user's error doesn't affect others)

### Potential Bottlenecks
- Large user base: Daily selection generation processes users sequentially
  - **Mitigation:** Could be parallelized or moved to queue-based processing
- Database cleanup: Large datasets may take time
  - **Mitigation:** Consider running during off-peak hours or implementing pagination

## Deployment Notes

1. **Timezone Configuration:** Ensure server timezone is set correctly or update cron timezone parameters
2. **Database Indexes:** Ensure indexes exist on:
   - `User.isProfileCompleted`
   - `Chat.status` and `Chat.expiresAt`
   - `DailySelection.createdAt`
   - `Chat.updatedAt`
3. **Monitoring:** Set up log aggregation to monitor job execution
4. **Alerts:** Configure alerting for job failures

## Related Files

- Scheduler files:
  - `main-api/src/modules/matching/matching.scheduler.ts`
  - `main-api/src/modules/chat/chat.scheduler.ts`
  - `main-api/src/modules/cron-jobs/schedulers/cleanup.scheduler.ts`
- Module files:
  - `main-api/src/modules/matching/matching.module.ts`
  - `main-api/src/modules/chat/chat.module.ts`
  - `main-api/src/modules/cron-jobs/cron-jobs.module.ts` (new)
  - `main-api/src/app.module.ts` (updated)
- Test files:
  - `main-api/src/modules/matching/tests/matching.scheduler.spec.ts`
  - `main-api/src/modules/chat/tests/chat.scheduler.spec.ts`
  - `main-api/src/modules/cron-jobs/tests/cleanup.scheduler.spec.ts` (new)
