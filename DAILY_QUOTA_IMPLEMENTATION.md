# Daily Quota System Implementation

## Overview

The daily quota system enforces strict limits on the number of profile choices users can make per day, based on their subscription tier:
- **Free users**: 1 choice per day
- **GoldWen Plus subscribers**: 3 choices per day

Quotas automatically reset at midnight (00:00) and new selections are generated at noon (12:00).

## Architecture

### Components

1. **QuotaGuard** (`main-api/src/modules/matching/guards/quota.guard.ts`)
   - NestJS guard that runs before route handlers
   - Validates that users have remaining choices before allowing profile selection
   - Attaches quota information to the request object for use in controllers

2. **DailySelection Entity** (`main-api/src/database/entities/daily-selection.entity.ts`)
   - Tracks daily profile selections for each user
   - Fields:
     - `choicesUsed`: Number of choices made today
     - `maxChoicesAllowed`: Maximum choices based on subscription (1 or 3)
     - `selectedProfileIds`: Array of profiles shown to the user
     - `chosenProfileIds`: Array of profiles the user has chosen
     - `selectionDate`: Date of the selection (normalized to midnight)

3. **Error Codes** (`main-api/src/common/enums/error-codes.enum.ts`)
   - `DAILY_QUOTA_EXCEEDED`: Generic quota exceeded error
   - `QUOTA_LIMIT_REACHED`: Specific quota limit reached error

## API Endpoints

### POST /api/v1/matching/choose/:targetUserId

Choose a profile from the daily selection.

**Guards**: JwtAuthGuard, ProfileCompletionGuard, QuotaGuard

**Request**:
```json
{
  "choice": "like" | "pass"
}
```

**Response (Success - 201)**:
```json
{
  "success": true,
  "data": {
    "isMatch": false,
    "choicesRemaining": 2,
    "message": "Votre choix a été enregistré ! Il vous reste 2 choix aujourd'hui.",
    "canContinue": true
  }
}
```

**Response (Quota Exceeded - 403)**:
```json
{
  "statusCode": 403,
  "message": "Vous avez utilisé vos 3 choix quotidiens. Revenez demain pour de nouveaux profils !",
  "error": "Forbidden"
}
```

**Response (Free User Quota Exceeded - 403)**:
```json
{
  "statusCode": 403,
  "message": "Votre choix quotidien a été utilisé. Passez à GoldWen Plus pour 3 choix par jour ou revenez demain !",
  "error": "Forbidden"
}
```

### GET /api/v1/subscriptions/usage

Get current quota usage and subscription information.

**Guards**: JwtAuthGuard

**Response (200)**:
```json
{
  "dailyChoices": {
    "limit": 3,
    "used": 1,
    "remaining": 2,
    "resetTime": "2025-01-XX T12:00:00.000Z"
  },
  "subscription": {
    "tier": "premium",
    "isActive": true
  }
}
```

## Quota Enforcement Flow

1. **User initiates choice**: POST to `/matching/choose/:targetUserId`

2. **QuotaGuard validates**:
   - Checks if user is authenticated
   - Retrieves today's DailySelection
   - Validates that `choicesUsed < maxChoicesAllowed`
   - If quota exceeded, throws ForbiddenException with appropriate message
   - If valid, attaches `quotaInfo` to request and allows continuation

3. **MatchingService processes choice**:
   - Validates target user is in daily selection
   - Increments `choicesUsed`
   - Updates `chosenProfileIds`
   - Creates/updates Match if choice is "like"
   - Returns quota information in response

4. **Response includes**:
   - `choicesRemaining`: Remaining choices for today
   - `canContinue`: Boolean indicating if more choices can be made
   - `message`: User-friendly message about quota status

## Quota Messages

### Free User (1 choice/day)

- **After making choice**: 
  - "Votre choix est fait. Revenez demain pour de nouveaux profils !"

- **When quota exceeded**:
  - "Votre choix quotidien a été utilisé. Passez à GoldWen Plus pour 3 choix par jour ou revenez demain !"

### Premium User (3 choices/day)

- **After making choice (has remaining)**:
  - "Votre choix a été enregistré ! Il vous reste {N} choix aujourd'hui."

- **After making last choice**:
  - "Vos 3 choix sont faits. Revenez demain pour de nouveaux profils !"

- **When quota exceeded**:
  - "Vous avez utilisé vos 3 choix quotidiens. Revenez demain pour de nouveaux profils !"

## Quota Reset Schedule

Quotas are managed by the MatchingScheduler:

- **00:00 (Midnight)**: Old daily selections (>30 days) are cleaned up
- **12:00 (Noon)**: New daily selections are generated for all users
  - Each user receives 3-5 profiles to choose from
  - `maxChoicesAllowed` is set based on subscription tier
  - `choicesUsed` is reset to 0

## Testing

### Unit Tests

1. **QuotaGuard Tests** (`tests/quota.guard.spec.ts`)
   - ✅ Throws error if user not authenticated
   - ✅ Throws error if no daily selection exists
   - ✅ Throws error if free user quota exceeded
   - ✅ Throws error if premium user quota exceeded
   - ✅ Allows request when choices remaining
   - ✅ Attaches quota info to request
   - ✅ Validates today's selection date at midnight
   - Total: 8 tests

2. **Matching Service Quota Tests** (`tests/matching-quota.spec.ts`)
   - ✅ Validates target user in daily selection
   - ✅ Enforces daily quota limits
   - ✅ Prevents duplicate choices
   - ✅ Increments choicesUsed correctly
   - ✅ Returns correct choicesRemaining
   - ✅ Sets canContinue flag appropriately
   - ✅ Returns usage information
   - Total: 11 tests

### Running Tests

```bash
# Run all quota tests
npm test -- quota

# Run QuotaGuard tests only
npm test -- quota.guard.spec.ts

# Run matching quota tests only
npm test -- matching-quota.spec.ts

# Run all matching tests
npm test -- matching
```

## Integration with Subscription System

The quota system integrates with the subscription system:

1. **Subscription Features** (`SubscriptionsService.getSubscriptionFeatures`):
   - Returns `maxDailyChoices` based on subscription plan
   - Free: 1 choice
   - GoldWen Plus: 3 choices

2. **Daily Selection Generation** (`MatchingService.generateDailySelection`):
   - Calls `getMaxChoicesPerDay(userId)` to determine quota
   - Sets `maxChoicesAllowed` on DailySelection entity

3. **Usage Endpoint** (`SubscriptionsService.getUsage`):
   - Queries DailySelection to get actual usage
   - Returns limit, used, and remaining choices
   - Includes subscription tier information

## Error Handling

All quota-related errors use standard NestJS exception filters:

- **ForbiddenException (403)**: Quota exceeded
- **BadRequestException (400)**: Invalid choice or target not in selection
- **NotFoundException (404)**: User or selection not found

Error responses include:
- Clear, user-friendly messages in French
- Appropriate HTTP status codes
- Suggestions for upgrading (for free users)

## Business Events Logging

The QuotaGuard logs business events for monitoring:

```typescript
logger.logBusinessEvent('daily_quota_exceeded', {
  userId,
  choicesUsed,
  maxChoices,
  resetTime,
});
```

These events can be used for:
- Analytics and monitoring
- Identifying upgrade opportunities
- Detecting unusual usage patterns
- Performance optimization

## Security Considerations

1. **Guard-based enforcement**: Quota checks happen before route handlers
2. **Server-side validation**: All quota logic is server-side, preventing client manipulation
3. **Database-backed**: Quota state persisted in database, not client sessions
4. **Atomic updates**: DailySelection updates use database transactions
5. **Request correlation**: Quota info attached to request for consistent state

## Future Enhancements

Potential improvements for V2:

1. **Variable quota tiers**: Support for different subscription levels with different quotas
2. **Bonus choices**: One-time or promotional quota increases
3. **Quota rollover**: Allow unused choices to roll over (up to a limit)
4. **Analytics dashboard**: Real-time quota usage monitoring
5. **A/B testing**: Different quota limits for conversion optimization
6. **Notification improvements**: Warn users when approaching quota limit
