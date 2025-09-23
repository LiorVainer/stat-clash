# StatClash Ingestion Pipeline Implementation Guide
_Implementation roadmap using existing infrastructure with database-backed API usage tracking_

---

## Overview

This guide provides implementation steps for building the StatClash data ingestion pipeline using your **existing logging infrastructure** and **football API client**, now enhanced with **database-backed API usage tracking** for persistent monitoring and rate limiting.

## Logging & Usage Tracking Architecture

### Multi-Level Tracking System

**Database-Backed API Usage Tracking (NEW)**
- `apiUsageDaily` - Daily usage counts by provider for rate limiting
- `apiCalls` - Individual API call logs with structured parameters
- Persistent across service restarts
- Real-time usage monitoring
- Historical analytics and reporting

**`api_ingest_log` (Existing)** - **API Call Level**
- Tracks **individual HTTP requests** to external APIs
- One record per API call (e.g., GET /leagues → 200 OK)
- Focuses on: response times, status codes, endpoints, errors
- Used for: API quota monitoring, debugging failed requests

**`ingestion_logs` (Existing)** - **Job Level** 
- Tracks **entire ingestion job runs** (e.g., "ingest all players")
- One record per job execution with embedded metrics
- Focuses on: records processed, business logic, job outcomes
- Used for: operational monitoring, performance tracking

**Example Enhanced Flow:**
```
1. ingestion_logs: "Started ingest-players job"
2. apiUsageDaily: Check current usage (45/100 calls today)
3. apiCalls: Log structured call { provider: "api-football", resource: "squads", params: { team: "123" }, statusCode: 200, responseTime: 1200 }
4. api_ingest_log: "GET /players/squads?team=123 → 200 OK (1.2s)"
5. apiUsageDaily: Increment daily count (46/100 calls)
6. apiCalls: Log retry call { provider: "api-football", resource: "squads", params: { team: "456" }, statusCode: 429, error: "Rate Limited" }
7. ingestion_logs: "Completed ingest-players: 45 processed, 12 created, 33 updated, 1 error"
```

---

## Implementation Phases

### Phase 1: Enhanced Foundation Setup (Day 1)

#### 1.1 Environment & Dependencies
Enhanced football service now includes database-backed usage tracking:

- [ ] **Set up API-Football credentials**
  ```bash
  # Add to your .env file
  FOOTBALL_API_KEY=your_api_key_here
  CONVEX_URL=your_convex_deployment_url
  ```

- [ ] **Install Enhanced Dependencies**
  ```bash
  pnpm add zod convex/browser
  ```

#### 1.2 Database Schema Updates
- [ ] **Deploy new usage tracking tables**
  ```bash
  npx convex dev  # Pushes schema changes including usage tracking tables
  ```

- [ ] **Verify new tables are created:**
  - `apiUsageDaily` - Daily API usage counts
  - `apiCalls` - Individual API call logs with structured parameters
  - `rawUsage` - AI agent usage tracking
  - `invoices` - Billing management

### Phase 2: Enhanced Football Service (Day 2)

#### 2.1 Updated Football Service with Database-Backed Usage Tracking

The FootballService now includes:

**Key Enhancements:**
- **Database-backed API usage tracking** instead of in-memory counters
- **Structured parameter logging** using `Record<string, any>` objects
- **Real-time usage monitoring** with automatic rate limiting
- **Persistent usage data** across service restarts
- **Resource constants** for better maintainability

**Resource Constants:**
```typescript
const RESOURCES = {
    LEAGUES: 'leagues',
    TEAMS: 'teams',
    PLAYERS: 'players',
    PLAYER_STATS: 'player-stats',
    SQUADS: 'squads',
} as const;
```

**Enhanced API Usage Tracking:**
```typescript
// NEW: Database-backed usage tracking
private async getCurrentApiUsage(date?: string): Promise<{ totalCalls: number; date: string; provider: string }> {
    return await this.convexClient.query(api.usage_tracking.usageHandler.getApiUsage, {
        provider: API_CONFIG.PROVIDER_NAME,
        date,
    });
}

// NEW: Log structured API calls to database
private async logApiCallToDatabase(
    resource: string,
    responseTime: number,
    statusCode: number,
    params?: Record<string, any>,  // Structured parameters
    error?: string,
): Promise<void> {
    await this.convexClient.mutation(api.usage_tracking.usageHandler.incrementApiUsage, {
        provider: API_CONFIG.PROVIDER_NAME,
        resource,
        responseTime,
        statusCode,
        params,  // Now stores structured objects instead of strings
        error,
    });
}

// NEW: Centralized API limit checking - called automatically in withRetry
private async checkApiLimits(): Promise<void> {
    const currentUsage = await this.getCurrentApiUsage();
    if (currentUsage.totalCalls >= API_CONFIG.DAILY_LIMIT * API_CONFIG.LIMIT_WARNING_THRESHOLD) {
        await this.logger.warn('Approaching API limit', {
            currentCalls: currentUsage.totalCalls,
            limit: API_CONFIG.DAILY_LIMIT,
            percentUsed: Math.round((currentUsage.totalCalls / API_CONFIG.DAILY_LIMIT) * 100),
        });
    }
    
    if (currentUsage.totalCalls >= API_CONFIG.DAILY_LIMIT) {
        throw new Error(`Daily API limit exceeded: ${currentUsage.totalCalls}/${API_CONFIG.DAILY_LIMIT} calls used`);
    }
}

// ENHANCED: withRetry now automatically checks API limits before every operation
private async withRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS,
    baseDelay = RETRY_CONFIG.BASE_DELAY_MS,
): Promise<T> {
    // 🚀 AUTOMATIC: API limit checking happens here for ALL API calls
    await this.checkApiLimits();
    
    // ...existing retry logic...
}
```

**Simplified API Methods - No Manual Limit Checking Required:**
```typescript
async getTeamsByLeague(leagueId: string, season: string = '2024') {
    // 🎉 withRetry automatically handles API limit checking!
    return this.withRetry(async () => {
        const timer = new Timer();
        let statusCode = 0;
        let error: string | undefined;
        
        // NEW: Structured parameters
        const params = { league: leagueId, season };

        try {
            // ✅ NO MANUAL checkApiLimits() call needed - it's automatic!
            const response = await this.apiClient.teams.teamsList({
                league: parseInt(leagueId),
                season: parseInt(season),
            });
            statusCode = HTTP_STATUS.SUCCESS_MIN;

            // Log to both systems
            await this.logApiCallToDatabase(RESOURCES.TEAMS, timer.total(), statusCode, params);
            await this.logger.logApiCall({
                provider: API_CONFIG.PROVIDER_NAME,
                resource: RESOURCES.TEAMS,
                responseTime: timer.total(),
                statusCode,
                params: `league=${leagueId}&season=${season}`,  // String for existing logger
            });

            return response.response || [];
        } catch (err: any) {
            statusCode = err.response?.status || 0;
            error = err.message || 'Unknown error';
            
            await this.logApiCallToDatabase(RESOURCES.TEAMS, timer.total(), statusCode, params, error);
            await this.logger.logApiCall({
                provider: API_CONFIG.PROVIDER_NAME,
                resource: RESOURCES.TEAMS,
                responseTime: timer.total(),
                statusCode,
                params: `league=${leagueId}&season=${season}`,
                error,
            });
            throw err;
        }
    }, RESOURCES.TEAMS);
}

// 🎯 ALL API methods now get automatic limit checking:
// - getLeagues() ✅
// - getTeamsByLeague() ✅ 
// - getPlayersByTeam() ✅
// - getPlayerStats() ✅
// Zero manual code required!
```

#### 2.2 New Usage Analytics Methods

**Get Current API Usage:**
```typescript
async getApiUsage() {
    const currentUsage = await this.getCurrentApiUsage();
    return {
        used: currentUsage.totalCalls,
        limit: API_CONFIG.DAILY_LIMIT,
        remaining: API_CONFIG.DAILY_LIMIT - currentUsage.totalCalls,
        percentUsed: Math.round((currentUsage.totalCalls / API_CONFIG.DAILY_LIMIT) * 100),
        date: currentUsage.date,
    };
}
```

**Get Usage Statistics:**
```typescript
async getUsageStats(startDate: string, endDate: string) {
    return await this.convexClient.query(api.usage_tracking.usageHandler.getUsageStats, {
        provider: API_CONFIG.PROVIDER_NAME,
        startDate,
        endDate,
    });
}
```

**Get API Call History:**
```typescript
async getApiCallHistory(date?: string, resource?: string, limit?: number) {
    return await this.convexClient.query(api.usage_tracking.usageHandler.getApiCallHistory, {
        provider: API_CONFIG.PROVIDER_NAME,
        date,
        resource,
        limit,
    });
}
```

### Phase 3: Usage Tracking Functions (Day 3)

#### 3.1 Convex Usage Handler Functions

**Key Functions Available:**
- `getApiUsage` - Get current daily usage for a provider
- `incrementApiUsage` - Log API call and increment daily counter
- `getApiCallHistory` - Get detailed call history with filtering
- `getUsageStats` - Get usage statistics over date ranges

**Example Usage:**
```typescript
// Get today's usage
const usage = await ctx.runQuery(api.usage_tracking.usageHandler.getApiUsage, {
    provider: 'api-football'
});

// Get last 7 days statistics
const stats = await ctx.runQuery(api.usage_tracking.usageHandler.getUsageStats, {
    provider: 'api-football',
    startDate: '2025-09-15',
    endDate: '2025-09-22'
});

// Get recent failed calls
const failedCalls = await ctx.runQuery(api.usage_tracking.usageHandler.getApiCallHistory, {
    provider: 'api-football',
    date: '2025-09-22',
    limit: 50
});
```

### Phase 4: Enhanced Ingestion Jobs (Day 4)

#### 4.1 Updated Ingestion Job Structure

**Enhanced Constructor with Convex URL:**
```typescript
export class FootballService {
    constructor(
        private logger: IngestionLogger,
        convexUrl?: string,  // NEW: Optional Convex URL for database operations
    ) {
        // ...existing setup...
        this.convexClient = new ConvexHttpClient(convexUrl || process.env.CONVEX_URL!);
    }
}
```

**Updated Job Example:**
```typescript
export const ingestTeams = internalMutation({
    args: { leagueId: v.string(), season: v.optional(v.string()) },
    handler: async (ctx, { leagueId, season = '2024' }) => {
        const logger = new IngestionLogger(ctx, 'ingest-teams');
        const footballService = new FootballService(logger, process.env.CONVEX_URL);

        try {
            await logger.info('Starting team ingestion', { leagueId, season });

            // Check current API usage before starting
            const usage = await footballService.getApiUsage();
            await logger.info('Current API usage', usage);

            const teams = await footballService.getTeamsByLeague(leagueId, season);
            
            for (const teamData of teams) {
                // Process teams...
                logger.incrementProcessed();
            }

            // Get final usage statistics
            const finalUsage = await footballService.getApiUsage();
            await logger.info('Final API usage', finalUsage);

            const metrics = await logger.finish();
            return { success: true, metrics, usage: finalUsage };
        } catch (error) {
            await logger.error('Team ingestion failed', { error: error.message });
            throw error;
        }
    },
});
```

---

## Benefits of Database-Backed Usage Tracking

### 1. **Persistent Monitoring**
- Usage counters survive service restarts
- Historical usage data for analytics
- Cross-instance usage tracking

### 2. **Enhanced Rate Limiting**
- Real-time usage checks against API limits
- Automatic warnings at 90% usage
- Prevents quota overruns

### 3. **Better Debugging**
- Structured parameter logging for easy querying
- Detailed error tracking with context
- Performance monitoring with response times

### 4. **Analytics & Reporting**
- Usage trends over time
- Resource utilization patterns
- Cost optimization insights

### 5. **Type Safety**
- Structured parameter objects instead of strings
- Better TypeScript support
- Easier to query and filter

---

## Monitoring & Alerting

### Daily Usage Monitoring
```typescript
// Check if approaching limits
const usage = await footballService.getApiUsage();
if (usage.percentUsed > 90) {
    // Send alert or throttle requests
}
```

### Error Rate Monitoring
```typescript
// Get recent failed calls
const recentErrors = await footballService.getApiCallHistory(
    new Date().toISOString().split('T')[0],  // Today
    undefined,  // All resources
    100  // Last 100 calls
);

const errorRate = recentErrors.filter(call => call.statusCode >= 400).length / recentErrors.length;
```

### Performance Monitoring
```typescript
// Get usage statistics for the week
const weekStats = await footballService.getUsageStats(
    '2025-09-15',
    '2025-09-22'
);

console.log('Average calls per day:', weekStats.avgCallsPerDay);
console.log('Total calls this week:', weekStats.totalCalls);
```

---

## Migration Notes

### From In-Memory to Database-Backed Tracking

**Before:**
```typescript
private apiCallCount = 0;  // Lost on restart

getApiUsage() {
    return {
        used: this.apiCallCount,  // In-memory counter
        // ...
    };
}
```

**After:**
```typescript
// Persistent database storage
async getApiUsage() {
    const currentUsage = await this.getCurrentApiUsage();  // From database
    return {
        used: currentUsage.totalCalls,  // Persistent counter
        // ...
    };
}
```

### Parameter Storage Enhancement

**Before:**
```typescript
params: v.optional(v.string())  // "league=39&season=2024"
```

**After:**
```typescript
params: v.optional(v.record(v.string(), v.any()))  // { league: "39", season: "2024" }
```

This enables:
- Better querying: Find all calls with `league=39`
- Type safety: Structured parameter validation
- Analytics: Parameter usage patterns

---

## Testing the Enhanced System

### 1. **Verify Database Tables**
```bash
# Check that new tables exist
npx convex dashboard
# Look for: apiUsageDaily, apiCalls, rawUsage, invoices
```

### 2. **Test API Usage Tracking**
```typescript
// Make a test API call and verify it's logged
const teams = await footballService.getTeamsByLeague('39', '2024');
const usage = await footballService.getApiUsage();
console.log(usage);  // Should show incremented count
```

### 3. **Test Usage Analytics**
```typescript
// Get usage history
const history = await footballService.getApiCallHistory();
console.log(history);  // Should show recent calls with structured params
```

---

## Next Steps

1. **Deploy Schema Changes** - Push the new usage tracking tables
2. **Update Football Service** - Deploy the enhanced service with database tracking
3. **Monitor Usage** - Set up alerts for API limit warnings
4. **Analytics Dashboard** - Build usage analytics and reporting
5. **Cost Optimization** - Use usage data to optimize API consumption

The enhanced system provides enterprise-grade API usage tracking with persistence, analytics, and better monitoring capabilities while maintaining backward compatibility with existing logging infrastructure.

