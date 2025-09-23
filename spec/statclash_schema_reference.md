# StatClash — Database Schema Reference (Updated for API-Football v3)
_Last updated: 2025‑09‑22 (UTC)_

This is the **authoritative schema** for all Convex tables used by StatClash, updated to align with API-Football v3.  
Each section lists fields, types, indexes, retention, and notes.

Conventions:
- `Id<'table'>` = Convex document id
- Timestamps = ISO 8601 string format (UTC)
- Strings = UTF‑8
- Enums shown TypeScript‑style

---

## Usage Tracking Tables

### rawUsage (Agent Usage Tracking)
**Purpose:** Tracks AI agent usage and token consumption for billing.

**Fields**
- `id: Id<'rawUsage'>`
- `userId: string` — User identifier
- `agentName?: string` — Agent name (optional)
- `model: string` — AI model used
- `provider: string` — AI provider name
- `usage: Usage` — Token usage statistics
- `providerMetadata?: ProviderMetadata` — Additional provider data
- `billingPeriod: string` — Billing period (first day of month)
- `_creationTime: number` — Convex creation timestamp

**Indexes**
- `billingPeriod_userId: (billingPeriod, userId)`

**Retention:** persistent (for billing)

---

### invoices (Billing Management)
**Purpose:** Tracks billing invoices for users.

**Fields**
- `id: Id<'invoices'>`
- `userId: string` — User identifier
- `billingPeriod: string` — Billing period
- `amount: number` — Invoice amount
- `status: 'pending' | 'paid' | 'failed'` — Payment status

**Indexes**
- `billingPeriod_userId: (billingPeriod, userId)`

**Retention:** persistent (for billing records)

---

### apiUsageDaily (API Usage Tracking)
**Purpose:** Daily API usage counts by provider for rate limiting and monitoring.

**Fields**
- `id: Id<'apiUsageDaily'>`
- `provider: string` — API provider name (e.g., 'api-football')
- `date: string` — Date in YYYY-MM-DD format
- `totalCalls: number` — Total API calls for the day
- `lastUpdated: string` — ISO 8601 timestamp of last update

**Indexes**
- `by_provider_date: (provider, date)`

**Retention:** 90 days (for usage analytics)

---

### apiCalls (Detailed API Call Logging)
**Purpose:** Individual API call logs with detailed metadata for debugging and analytics.

**Fields**
- `id: Id<'apiCalls'>`
- `provider: string` — API provider name
- `resource: string` — API resource/endpoint (e.g., 'leagues', 'teams')
- `responseTime: number` — Response time in milliseconds
- `statusCode: number` — HTTP status code
- `params?: Record<string, any>` — API parameters as structured object
- `error?: string` — Error message if call failed
- `timestamp: string` — ISO 8601 timestamp
- `date: string` — Date in YYYY-MM-DD format for easy querying

**Indexes**
- `by_provider_date: (provider, date)`
- `by_provider_resource_date: (provider, resource, date)`
- `by_timestamp: (timestamp)`

**Retention:** 30 days (for debugging and analytics)

---

## 1) positions (Reference Table)
**Purpose:** Player position reference data.

**Fields**
- `id: Id<'positions'>`
- `code: string` — 'GK', 'DF', 'MF', 'FW'
- `name: string` — 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'
- `sortOrder: number` — Display order
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_code: (code)`

**Retention:** persistent

---

## 2) windows (Reference Table)
**Purpose:** Time window reference for stats.

**Fields**
- `id: Id<'windows'>`
- `code: string` — 'season', 'last5', 'last10', 'calendarYTD'
- `name: string` — 'Full Season', 'Last 5 Games', 'Last 10 Games', 'Calendar Year to Date'
- `description?: string` — Optional description
- `sortOrder: number` — Display order
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_code: (code)`

**Retention:** persistent

---

## 3) users
**Purpose:** User profile, alias, Pro subscription.

**Fields**
- `id: Id<'users'>`
- `externalId?: string` — External auth provider ID
- `name: string` — Display name/alias
- `locale?: string` — User locale preference
- `proSince?: number` — Pro subscription start timestamp
- `proPlan?: string` — Pro plan type
- `favoriteLeagueIds?: Id<'leagues'>[]` — Preferred leagues
- `favoritePositionIds?: Id<'positions'>[]` — Preferred positions
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp

**Indexes**
- `by_externalId: (externalId)`
- `by_name: (name)`

**Retention:** persistent

---

## 4) leagues
**Purpose:** Football league information.

**Fields**
- `id: Id<'leagues'>`
- `name: string` — League name
- `code?: string` — League code (e.g., 'PL', 'ES1')
- `season: string` — Season identifier
- `provider: string` — Data provider name
- `providerLeagueId: string` — Provider's league ID
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp

**Indexes**
- `by_provider_league: (provider, providerLeagueId)`

**Retention:** persistent

---

## 5) teams
**Purpose:** Football team information.

**Fields**
- `id: Id<'teams'>`
- `leagueId: Id<'leagues'>` — Parent league
- `name: string` — Team name
- `shortName?: string` — Abbreviated name
- `crestUrl?: string` — Team logo URL
- `provider: string` — Data provider name
- `providerTeamId: string` — Provider's team ID
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp

**Indexes**
- `by_league: (leagueId)`
- `by_provider_team: (provider, providerTeamId)`

**Retention:** persistent

---

## 6) players
**Purpose:** Football player information.

**Fields**
- `id: Id<'players'>`
- `teamId: Id<'teams'>` — Current team
- `leagueId: Id<'leagues'>` — Current league
- `name: string` — Player name
- `positionId: Id<'positions'>` — Player position reference
- `nationality?: string` — Player nationality
- `photoUrl?: string` — Player photo URL
- `dateOfBirth?: string` — Birth date (ISO 8601)
- `provider: string` — Data provider name
- `providerPlayerId: string` — Provider's player ID
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp

**Indexes**
- `by_team: (teamId)`
- `by_league: (leagueId)`
- `by_provider_player: (provider, providerPlayerId)`

**Retention:** persistent

---

## 7) stats_snapshots (players)
**Purpose:** Frozen player stats by metric + window.

**Fields**
- `id: Id<'stats_snapshots'>`
- `playerId: Id<'players'>` — Player reference
- `leagueId: Id<'leagues'>` — League reference
- `metric: string` — e.g. "goals", "assists", "xG"
- `window: Id<'windows'>` — Time window reference
- `season: string` — Season identifier
- `value: number` — Stat value (float allowed)
- `appearances?: number` — Games played
- `minutes?: number` — Minutes played
- `updatedAt: string` — ISO 8601 timestamp
- `provider: string` — Data provider name

**Indexes**
- `by_league_metric_window: (leagueId, metric, window)`
- `by_player_metric_window: (playerId, metric, window)`

**Retention:** overwrite per season

---

## 8) team_stats_snapshots (teams)
**Purpose:** Frozen team stats by metric + window.

**Fields**
- `id: Id<'team_stats_snapshots'>`
- `teamId: Id<'teams'>` — Team reference
- `leagueId: Id<'leagues'>` — League reference
- `metric: string` — e.g. "points", "rank", "goalDifference", "wins", "losses", "draws", "goalsFor", "goalsAgainst", "possessionPct"
- `window: Id<'windows'>` — Time window reference
- `season: string` — Season identifier
- `value: number` — Stat value (float allowed)
- `matchesPlayed?: number` — Games played
- `updatedAt: string` — ISO 8601 timestamp
- `provider: string` — Data provider name

**Indexes**
- `by_league_metric_window: (leagueId, metric, window)`
- `by_team_metric_window: (teamId, metric, window)`

**Retention:** overwrite per season

---

## 9) seeds
**Purpose:** Question generation seeds for deterministic daily questions.

**Fields**
- `id: Id<'seeds'>`
- `date: string` — Date in YYYY-MM-DD format
- `leagueId: Id<'leagues'>` — League reference
- `metric: string` — Stat metric
- `windowId: Id<'windows'>` — Time window reference
- `index: number` — Seed index for the day
- `seed: string` — Random seed value
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_date_league_metric_window: (date, leagueId, metric, windowId)`
- `by_seed: (seed)`

**Retention:** persistent (for reproducibility)

---

## 10) questions
**Purpose:** Generated quiz questions with player/team data.

**Fields**
- `id: Id<'questions'>`
- `date: string` — Date in YYYY-MM-DD format
- `leagueId: Id<'leagues'>` — League reference
- `metric: string` — Stat metric
- `window: Id<'windows'>` — Time window reference
- `seed: string` — Generation seed
- `subjectType: 'player' | 'team'` — Question type
- `token?: string` — Access token
- `expiresAt?: number` — Token expiration timestamp
- `difficulty: number` — Difficulty score
- `repeatKey: string` — Deduplication key
- `explanation: string` — Answer explanation
- `options?: any` — Player/team options with values
- `playerData?: PlayerData[]` — Player information for display
- `correctPlayer?: Id<'players'>` — Correct player answer
- `teamData?: TeamData[]` — Team information for display
- `correctTeam?: Id<'teams'>` — Correct team answer
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_date: (date)`
- `by_date_league_metric_window: (date, leagueId, metric, window)`
- `by_token: (token)`
- `by_seed: (seed)`

**Retention:** 30 days for active questions

---

## 11) sessions
**Purpose:** Game session tracking.

**Fields**
- `id: Id<'sessions'>`
- `userId: Id<'users'>` — Player reference
- `date: string` — Session date
- `sessionId: string` — Unique session identifier
- `questionIds: Id<'questions'>[]` — Questions in session
- `questionTokens: any` — Token mapping
- `currentRound: number` — Current round number
- `score: number` — Current score
- `finished: boolean` — Session completion status
- `createdAt: string` — ISO 8601 timestamp
- `updatedAt: string` — ISO 8601 timestamp

**Indexes**
- `by_user_date: (userId, date)`
- `by_date_score: (date, score)`

**Retention:** 90 days

---

## 12) attempts
**Purpose:** Individual question attempts and answers.

**Fields**
- `id: Id<'attempts'>`
- `userId?: Id<'users'>` — Player reference (optional for guests)
- `sessionId: Id<'sessions'>` — Session reference
- `questionId: Id<'questions'>` — Question reference
- `chosenPlayer?: Id<'players'>` — Player choice
- `chosenTeam?: Id<'teams'>` — Team choice
- `correct: boolean` — Answer correctness
- `responseMs: number` — Response time in milliseconds
- `scoreAwarded: number` — Points awarded
- `userAgent?: string` — Client user agent
- `ipHash?: string` — Hashed IP address
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_session: (sessionId)`
- `by_user_created: (userId, createdAt)`
- `by_question: (questionId)`

**Retention:** 90 days

---

## 13) session_pools
**Purpose:** Question pool configuration for sessions.

**Fields**
- `id: Id<'session_pools'>`
- `sessionId: Id<'sessions'>` — Session reference
- `pools: PoolConfig[]` — Pool configuration array
- `questionIds: Id<'questions'>[]` — Available questions
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_session: (sessionId)`

**Retention:** 90 days

---

## 14) user_question_history
**Purpose:** Track user's question history to prevent repeats.

**Fields**
- `id: Id<'user_question_history'>`
- `userId: Id<'users'>` — User reference
- `questionId: Id<'questions'>` — Question reference
- `repeatKey: string` — Question repeat prevention key
- `date: string` — Date attempted
- `sessionId: Id<'sessions'>` — Session reference
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_user_repeat_key: (userId, repeatKey)`
- `by_user_question: (userId, questionId)`

**Retention:** 365 days

---

## 15) question_pools
**Purpose:** Daily question pool weights and configuration.

**Fields**
- `id: Id<'question_pools'>`
- `date: string` — Date in YYYY-MM-DD format
- `leagueId: Id<'leagues'>` — League reference
- `metric: string` — Stat metric
- `window: Id<'windows'>` — Time window reference
- `weight: number` — Pool weight for selection
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_date: (date)`

**Retention:** 30 days

---

## 16) leaderboard_daily
**Purpose:** Daily leaderboard rankings.

**Fields**
- `id: Id<'leaderboard_daily'>`
- `date: string` — Date in YYYY-MM-DD format
- `userId?: Id<'users'>` — User reference (optional for guests)
- `alias: string` — Display name
- `score: number` — Final score
- `totalResponseMs?: number` — Total response time
- `finishedAt?: number` — Completion timestamp
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_date_score_response_finish: (date, score, totalResponseMs, finishedAt)`

**Retention:** 365 days

---

## 17) ad_impressions
**Purpose:** Ad impression tracking.

**Fields**
- `id: Id<'ad_impressions'>`
- `attemptId?: Id<'attempts'>` — Related attempt
- `userId?: Id<'users'>` — User reference
- `slot: string` — Ad slot identifier
- `network: string` — Ad network name
- `createdAt: string` — ISO 8601 timestamp
- `renderedAt?: number` — Render timestamp

**Indexes**
- `by_slot_created: (slot, createdAt)`
- `by_user_created: (userId, createdAt)`

**Retention:** 90 days

---

## 18) pro_events
**Purpose:** Pro subscription event tracking.

**Fields**
- `id: Id<'pro_events'>`
- `userId: Id<'users'>` — User reference
- `event: 'view_pro_page' | 'click_checkout' | 'checkout_success' | 'checkout_cancel'` — Event type
- `meta?: string` — Additional event metadata
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_user_created: (userId, createdAt)`
- `by_event_created: (event, createdAt)`

**Retention:** 365 days

---

## 19) stripe_events
**Purpose:** Stripe webhook event deduplication.

**Fields**
- `id: Id<'stripe_events'>`
- `eventId: string` — Stripe event ID
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_event_id: (eventId)`

**Retention:** 90 days

---

## 20) api_ingest_log
**Purpose:** Track external API calls for ingestion monitoring.

**Fields**
- `id: Id<'api_ingest_log'>`
- `provider: string` — API provider name ('api-football', etc.)
- `resource: string` — API resource/endpoint called
- `providerParams?: string` — Query parameters used
- `ok: boolean` — Whether the call succeeded
- `statusCode?: number` — HTTP status code
- `durationMs?: number` — Request duration in milliseconds
- `error?: string` — Error message if failed
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_provider_created: (provider, createdAt)`
- `by_ok_created: (ok, createdAt)`

**Retention:** 30 days (for debugging recent API issues)

---

## ingestion_logs
**Purpose:** Simple structured logging for ingestion pipeline with embedded metrics.

**Fields**
- `id: Id<'ingestion_logs'>`
- `jobType: string` — Job identifier ('ingest-leagues', 'ingest-teams', 'ingest-players', etc.)
- `level: 'info' | 'warn' | 'error'` — Log level
- `message: string` — Human-readable log message
- `data?: any` — JSON context data (player IDs, error details, etc.)
- `timestamp: string` — ISO 8601 timestamp
- `apiCalls?: number` — Number of API calls made during this operation
- `recordsProcessed?: number` — Total records processed
- `recordsCreated?: number` — New records created
- `recordsUpdated?: number` — Existing records updated
- `errors?: number` — Number of errors encountered
- `durationMs?: number` — Operation duration in milliseconds

**Indexes**
- `by_job_type_timestamp: (jobType, timestamp)`
- `by_level_timestamp: (level, timestamp)`

**Retention:** 90 days (for operational monitoring and debugging)

**Notes:** 
- Combines logging and basic metrics in one table for simplicity
- Use for tracking ingestion job performance and debugging failures
- Query by jobType to see all logs for a specific ingestion process

---

## 21) error_log
**Purpose:** Application error logging.

**Fields**
- `id: Id<'error_log'>`
- `scope: string` — Error scope/component
- `message: string` — Error message
- `stack?: string` — Stack trace
- `meta?: string` — Additional metadata
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_scope_created: (scope, createdAt)`

**Retention:** 30 days

---

## 22) gameplay_log
**Purpose:** User gameplay event logging.

**Fields**
- `id: Id<'gameplay_log'>`
- `userId?: Id<'users'>` — User reference (optional for guests)
- `sessionId?: Id<'sessions'>` — Session reference
- `event: string` — Event type
- `meta?: string` — Event metadata
- `createdAt: string` — ISO 8601 timestamp

**Indexes**
- `by_event_created: (event, createdAt)`
- `by_user_created: (userId, createdAt)`
- `by_session_created: (sessionId, createdAt)`

**Retention:** 90 days

---

## Type Definitions

### PlayerData
```typescript
{
  playerId: Id<'players'>;
  name: string;
  positionId: Id<'positions'>;
  positionName: string;
  nationality?: string;
  photoUrl?: string;
  teamName?: string;
}
```

### TeamData
```typescript
{
  teamId: Id<'teams'>;
  name: string;
  crestUrl?: string;
}
```

### PoolConfig
```typescript
{
  leagueId: Id<'leagues'>;
  metric: string;
  windowId: Id<'windows'>;
  count: number;
}
```

---

## Notes
- All timestamps changed from `number` (epoch ms) to `string` (ISO 8601) format
- Reference tables (`positions`, `windows`) added for normalized data
- Player positions now reference the `positions` table via `positionId`
- Stats snapshots reference time windows via `window: Id<'windows'>`
- Usage tracking tables imported from separate module
