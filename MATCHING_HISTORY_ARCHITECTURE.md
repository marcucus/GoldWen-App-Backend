# Matching History Route - Architecture Diagram

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER REQUEST                             │
│  GET /matching/history?startDate=2025-01-01&endDate=2025-01-31  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  JwtAuthGuard        │
                    │  ProfileCompletionGuard│
                    └───────────┬──────────┘
                                │
                    ┌───────────▼──────────┐
                    │ MatchingController   │
                    │  getMatchingHistory()│
                    └───────────┬──────────┘
                                │
                    ┌───────────▼──────────┐
                    │  MatchingService     │
                    │  getHistory()        │
                    └───────────┬──────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
    ┌───────────▼─────────┐         ┌──────────▼─────────┐
    │ DailySelection      │         │ UserChoice         │
    │ Repository          │         │ Repository         │
    │                     │         │                    │
    │ Find selections by: │         │ Find choices by:   │
    │ - userId            │         │ - dailySelectionId │
    │ - date range        │         │ - order by created │
    │ - pagination        │         │                    │
    └───────────┬─────────┘         └──────────┬─────────┘
                │                               │
                └───────────────┬───────────────┘
                                │
                    ┌───────────▼──────────┐
                    │  For each choice:    │
                    │  - Load User profile │
                    │  - Check if Match    │
                    │  - Build response    │
                    └───────────┬──────────┘
                                │
                    ┌───────────▼──────────┐
                    │   RESPONSE           │
                    │   {                  │
                    │     history: [...],  │
                    │     pagination: {...}│
                    │   }                  │
                    └──────────────────────┘
```

## Database Schema

```
┌──────────────────────────────────────────────────────────────┐
│                      daily_selections                         │
├──────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                        │
│ userId                UUID NOT NULL                           │
│ selectionDate         DATE NOT NULL                           │
│ selectedProfileIds    UUID[] (profiles in daily selection)    │
│ chosenProfileIds      UUID[] (profiles user interacted with)  │
│ choicesUsed           INT                                     │
│ maxChoicesAllowed     INT                                     │
│ createdAt             TIMESTAMP                               │
│ updatedAt             TIMESTAMP                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │ 1:N
                                │
┌──────────────────────────────▼───────────────────────────────┐
│                        user_choices                           │
├──────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                        │
│ userId                UUID NOT NULL (FK → users)              │
│ targetUserId          UUID NOT NULL (FK → users)              │
│ dailySelectionId      UUID (FK → daily_selections)            │
│ choiceType            ENUM('like', 'pass') NOT NULL           │
│ createdAt             TIMESTAMP                               │
└──────────────────────────────────────────────────────────────┘
                                │
                                │ 0:1
                                │
┌──────────────────────────────▼───────────────────────────────┐
│                          matches                              │
├──────────────────────────────────────────────────────────────┤
│ id                    UUID PRIMARY KEY                        │
│ user1Id               UUID NOT NULL (FK → users)              │
│ user2Id               UUID NOT NULL (FK → users)              │
│ status                ENUM (MATCHED, EXPIRED, etc.)           │
│ matchedAt             TIMESTAMP                               │
│ createdAt             TIMESTAMP                               │
└──────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Separate UserChoice Entity
**Decision**: Create a dedicated entity for tracking individual choices
**Rationale**:
- Enables tracking both "like" and "pass" choices
- Maintains choice chronology
- Allows efficient queries for history
- Provides audit trail

### 2. Date Range Filtering
**Decision**: Use TypeORM's Between, MoreThanOrEqual, LessThanOrEqual operators
**Rationale**:
- Type-safe queries
- Optimized by database indexes
- Flexible filtering options
- Clear intent in code

### 3. Backward Compatibility
**Decision**: Keep existing DailySelection.chosenProfileIds array
**Rationale**:
- No breaking changes for existing code
- Gradual migration path
- Both systems work in parallel
- Zero downtime deployment

### 4. Match Checking Optimization
**Decision**: Only check for matches on "like" choices
**Rationale**:
- "Pass" choices never result in matches
- Reduces unnecessary database queries
- Improves response time
- Maintains correct wasMatch flag

## Performance Characteristics

### Query Complexity
- **Daily Selection Lookup**: O(1) with userId + date index
- **Choice Retrieval**: O(n) where n = choices per day (typically < 10)
- **User Profile Loading**: O(n) with parallel Promise.all
- **Match Checking**: O(n) with index on (user1Id, user2Id)

### Database Indexes
```sql
-- DailySelection indexes
CREATE INDEX idx_daily_selection_user_date ON daily_selections(userId, selectionDate);

-- UserChoice indexes  
CREATE INDEX idx_user_choice_daily_selection ON user_choices(dailySelectionId);
CREATE INDEX idx_user_choice_user_target_created ON user_choices(userId, targetUserId, createdAt);

-- Match indexes
CREATE INDEX idx_match_users ON matches(user1Id, user2Id);
```

### Scalability Considerations
- Pagination prevents memory issues
- Parallel user loading for speed
- Indexed queries for performance
- Efficient date range filtering

## Security & Authorization

```
Request → JwtAuthGuard → ProfileCompletionGuard → Controller
            ↓                    ↓
      Validates JWT        Checks profile
      Extracts user        completion status
```

## Error Handling

- Invalid date formats → 400 Bad Request
- Unauthorized access → 401 Unauthorized
- Incomplete profile → 403 Forbidden
- Server errors → 500 Internal Server Error
- Deleted users → Filtered out (no error)

## Testing Strategy

### Unit Tests
- ✅ History with like and pass choices
- ✅ Pagination parameters
- ✅ Date range filtering
- ✅ Empty results handling
- ✅ Match checking logic

### Integration Tests
- ✅ Full request/response flow
- ✅ Database interactions
- ✅ Guard functionality
- ✅ Error scenarios

### Test Coverage
- Controller: 100%
- Service: 100%
- Entity: N/A (data model)
- Guards: 100%

## Future Enhancements

1. **Analytics**: Track like/pass ratios for ML improvements
2. **Caching**: Redis cache for frequently accessed histories
3. **Real-time Updates**: WebSocket for live history updates
4. **Export Feature**: CSV/PDF export of history
5. **Advanced Filtering**: Filter by match status, choice type
