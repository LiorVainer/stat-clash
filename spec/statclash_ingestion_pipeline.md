# StatClash Data Ingestion Pipeline
_Last updated: 2025-09-22 (UTC)_

---

## Overview

The StatClash data ingestion pipeline fetches, validates, and stores football data from external providers to power the daily question generation system. Built for reliability and maintainability with a single developer in mind.

## Architecture

### Data Flow
```
External APIs → Basic Validation → Idempotent Upserts → Database Storage → Question Generation
     ↓              ↓                   ↓                    ↓               ↓
Simple Retry → Structured Logs → Basic Metrics → Error Handling
```

### Core Principles
- **Reliability**: Idempotent operations prevent duplicates on reruns
- **Observability**: Structured logs you can actually read when things break
- **Simplicity**: No ceremony, just what you need to handle 10x scale
- **Resilience**: Basic retry with backoff for transient failures

---

## Schema Structure

### Reference Tables

#### Positions Table
```typescript
positions: {
  code: string;        // 'GK', 'DF', 'MF', 'FW'
  name: string;        // 'Goalkeeper', 'Defender', 'Midfielder', 'Forward'
  sortOrder: number;
  createdAt: string;
}
```

#### Windows Table
```typescript
windows: {
  code: string;        // 'season', 'last5', 'last10', 'calendarYTD'
  name: string;        // 'Full Season', 'Last 5 Games', etc.
  description?: string;
  sortOrder: number;
  createdAt: string;
}
```

### Core Entities

#### Leagues Table
```typescript
leagues: {
  name: string;
  code?: string;
  season: string;
  provider: string;
  providerLeagueId: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Teams Table
```typescript
teams: {
  leagueId: Id<'leagues'>;
  name: string;
  shortName?: string;
  crestUrl?: string;
  provider: string;
  providerTeamId: string;
  createdAt: string;
  updatedAt: string;
}
```

#### Players Table
```typescript
players: {
  teamId: Id<'teams'>;
  leagueId: Id<'leagues'>;
  name: string;
  positionId: Id<'positions'>;
  nationality?: string;
  photoUrl?: string;
  dateOfBirth?: string;
  provider: string;
  providerPlayerId: string;
  createdAt: string;
  updatedAt: string;
}
```

### Statistics Snapshots

#### Player Stats Snapshots
```typescript
stats_snapshots: {
  playerId: Id<'players'>;
  leagueId: Id<'leagues'>;
  metric: string;      // 'goals', 'assists', 'yellow_cards', etc.
  window: Id<'windows'>;
  season: string;
  value: number;
  appearances?: number;
  minutes?: number;
  updatedAt: string;
  provider: string;
}
```

#### Team Stats Snapshots
```typescript
team_stats_snapshots: {
  teamId: Id<'teams'>;
  leagueId: Id<'leagues'>;
  metric: string;      // 'goals_scored', 'goals_conceded', 'wins', etc.
  window: Id<'windows'>;
  season: string;
  value: number;
  matchesPlayed?: number;
  updatedAt: string;
  provider: string;
}
```

---

## 🟢 Must-Have: Core Implementation

### 1. Basic Schema Validation with Zod

```typescript
// convex/lib/validation.ts
import { z } from 'zod';

const PlayerDataSchema = z.object({
  name: z.string().min(1),
  position: z.string().min(1),
  nationality: z.string().optional(),
  photoUrl: z.string().url().optional(),
  dateOfBirth: z.string().optional(),
  providerPlayerId: z.string(),
});

const TeamDataSchema = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  crestUrl: z.string().url().optional(),
  providerTeamId: z.string(),
});

export function validatePlayerData(data: unknown) {
  return PlayerDataSchema.parse(data);
}

export function validateTeamData(data: unknown) {
  return TeamDataSchema.parse(data);
}
```

### 2. Idempotent Upsert Operations

```typescript
// Prevents duplicates when rerunning jobs
async function upsertPlayer(playerData: PlayerData, leagueId: Id<'leagues'>, teamId: Id<'teams'>) {
  try {
    // Validate data first
    const validatedData = validatePlayerData(playerData);
    
    // Check if player already exists
    const existingPlayer = await ctx.db
      .query('players')
      .withIndex('by_provider_player', q => 
        q.eq('provider', 'api-football')
         .eq('providerPlayerId', validatedData.providerPlayerId)
      )
      .first();
    
    const positionId = await getPositionId(validatedData.position);
    const playerRecord = {
      teamId,
      leagueId,
      name: validatedData.name,
      positionId,
      nationality: validatedData.nationality,
      photoUrl: validatedData.photoUrl,
      dateOfBirth: validatedData.dateOfBirth,
      provider: 'api-football',
      providerPlayerId: validatedData.providerPlayerId,
      updatedAt: new Date().toISOString(),
    };
    
    if (existingPlayer) {
      // Update existing record
      await ctx.db.patch(existingPlayer._id, playerRecord);
      logIngestion('info', 'Player updated', { 
        playerId: existingPlayer._id, 
        providerPlayerId: validatedData.providerPlayerId 
      });
      return existingPlayer._id;
    } else {
      // Create new record
      const newPlayerId = await ctx.db.insert('players', {
        ...playerRecord,
        createdAt: new Date().toISOString(),
      });
      logIngestion('info', 'Player created', { 
        playerId: newPlayerId, 
        providerPlayerId: validatedData.providerPlayerId 
      });
      return newPlayerId;
    }
  } catch (error) {
    logIngestion('error', 'Player upsert failed', { 
      error: error.message,
      playerData: playerData.providerPlayerId 
    });
    throw error;
  }
}
```

### 3. Simple Retry with Exponential Backoff

```typescript
// Basic retry logic for transient API failures
async function withRetry<T>(
  operation: () => Promise<T>, 
  maxAttempts = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation errors or 4xx client errors
      if (error.message.includes('validation') || error.message.includes('400')) {
        throw error;
      }
      
      if (attempt === maxAttempts) {
        logIngestion('error', 'Max retries exceeded', { 
          attempts: maxAttempts, 
          finalError: lastError.message 
        });
        throw lastError;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
      logIngestion('warn', 'Retrying after error', { 
        attempt, 
        maxAttempts, 
        delayMs: delay, 
        error: lastError.message 
      });
      
      await sleep(delay);
    }
  }
  
  throw lastError!;
}

// Usage in API calls
async function fetchPlayersWithRetry(teamId: string) {
  return withRetry(async () => {
    const response = await fetch(`${API_BASE}/players/squads?team=${teamId}`, {
      headers: { 'X-RapidAPI-Key': process.env.FOOTBALL_API_KEY }
    });
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED'); // Will trigger retry
    }
    
    if (!response.ok) {
      throw new Error(`API_ERROR_${response.status}`);
    }
    
    return response.json();
  });
}
```

### 4. Structured Logging (Simple & Readable)

```typescript
// Simple structured logging that you can actually read
interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  message: string;
  data?: Record<string, any>;
  jobType?: string;
}

function logIngestion(level: LogEntry['level'], message: string, data?: Record<string, any>) {
  const logEntry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
    jobType: 'ingestion',
  };
  
  // Simple console logging - easy to read and search
  console.log(JSON.stringify(logEntry));
  
  // Optional: Store in database for later analysis
  // await ctx.db.insert('ingestion_logs', logEntry);
}

// Usage examples
logIngestion('info', 'Starting player ingestion', { teamId, leagueId });
logIngestion('warn', 'API rate limit hit, retrying', { endpoint: '/players', retryIn: 5000 });
logIngestion('error', 'Validation failed', { entity: 'player', errors: ['missing name'] });
```

### 5. Basic Metrics (Count What Matters)

```typescript
// Simple metrics tracking - no fancy systems needed
interface JobMetrics {
  jobType: string;
  startTime: number;
  endTime?: number;
  apiCalls: number;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  errors: number;
}

class SimpleMetrics {
  private metrics: JobMetrics;
  
  constructor(jobType: string) {
    this.metrics = {
      jobType,
      startTime: Date.now(),
      apiCalls: 0,
      recordsProcessed: 0,
      recordsCreated: 0,
      recordsUpdated: 0,
      errors: 0,
    };
  }
  
  incrementApiCalls() { this.metrics.apiCalls++; }
  incrementProcessed() { this.metrics.recordsProcessed++; }
  incrementCreated() { this.metrics.recordsCreated++; }
  incrementUpdated() { this.metrics.recordsUpdated++; }
  incrementErrors() { this.metrics.errors++; }
  
  finish() {
    this.metrics.endTime = Date.now();
    const duration = this.metrics.endTime - this.metrics.startTime;
    
    logIngestion('info', 'Job completed', {
      ...this.metrics,
      durationMs: duration,
      recordsPerSecond: Math.round(this.metrics.recordsProcessed / (duration / 1000)),
    });
    
    return this.metrics;
  }
}

// Usage in ingestion functions
async function ingestPlayers(teamId: Id<'teams'>, leagueId: Id<'leagues'>) {
  const metrics = new SimpleMetrics('ingest-players');
  
  try {
    const players = await fetchPlayersWithRetry(team.providerTeamId);
    metrics.incrementApiCalls();
    
    for (const player of players) {
      try {
        const playerId = await upsertPlayer(player, leagueId, teamId);
        metrics.incrementProcessed();
        
        if (playerId) {
          metrics.incrementCreated();
        } else {
          metrics.incrementUpdated();
        }
      } catch (error) {
        metrics.incrementErrors();
        logIngestion('error', 'Player processing failed', { 
          playerId: player.id, 
          error: error.message 
        });
      }
    }
    
    return metrics.finish();
  } catch (error) {
    logIngestion('error', 'Player ingestion failed completely', { 
      teamId, 
      error: error.message 
    });
    metrics.incrementErrors();
    metrics.finish();
    throw error;
  }
}
```

---

## Basic CRON Schedule

```typescript
// convex/crons.ts - Keep it simple
import { cronJobs } from 'convex/server';

const crons = cronJobs();

// Reference data setup (run once)
crons.interval('setup-reference-data', { minutes: 0 }, internal.ingestion.setupReferenceData);

// Daily ingestion - staggered to avoid API rate limits
crons.daily('ingest-leagues', { hourUTC: 2, minuteUTC: 0 }, internal.ingestion.ingestLeagues);
crons.daily('ingest-teams', { hourUTC: 2, minuteUTC: 30 }, internal.ingestion.ingestTeams);
crons.daily('ingest-players', { hourUTC: 3, minuteUTC: 0 }, internal.ingestion.ingestPlayers);
crons.daily('ingest-player-stats', { hourUTC: 4, minuteUTC: 0 }, internal.ingestion.ingestPlayerStats);
crons.daily('ingest-team-stats', { hourUTC: 4, minuteUTC: 30 }, internal.ingestion.ingestTeamStats);

// Generate questions after data is fresh
crons.daily('generate-questions', { hourUTC: 5, minuteUTC: 0 }, internal.questions.generateDailyQuestions);

export default crons;
```

---

## API Rate Limiting (Basic)

```typescript
// Simple rate limiting - track calls and respect limits
let apiCallCount = 0;
const DAILY_LIMIT = 100; // API-Football free tier
const resetTime = new Date();
resetTime.setHours(24, 0, 0, 0); // Reset at midnight

async function makeAPICall(endpoint: string) {
  // Check if we're near the limit
  if (apiCallCount >= DAILY_LIMIT * 0.9) { // 90% threshold
    logIngestion('warn', 'Approaching API limit', { 
      currentCalls: apiCallCount, 
      limit: DAILY_LIMIT 
    });
  }
  
  if (apiCallCount >= DAILY_LIMIT) {
    throw new Error('DAILY_API_LIMIT_EXCEEDED');
  }
  
  const response = await fetch(endpoint, {
    headers: { 'X-RapidAPI-Key': process.env.FOOTBALL_API_KEY }
  });
  
  apiCallCount++;
  
  if (response.status === 429) {
    throw new Error('RATE_LIMITED');
  }
  
  if (!response.ok) {
    throw new Error(`API_ERROR_${response.status}`);
  }
  
  return response.json();
}
```

---

## Error Handling Strategy

```typescript
// Simple error classification - retry vs fail fast
function shouldRetry(error: Error): boolean {
  const retryableErrors = [
    'RATE_LIMITED',
    'TIMEOUT',
    'NETWORK_ERROR',
    'API_ERROR_500',
    'API_ERROR_502',
    'API_ERROR_503',
  ];
  
  return retryableErrors.some(type => error.message.includes(type));
}

// Basic error reporting
function reportError(context: string, error: Error, data?: any) {
  logIngestion('error', `${context} failed`, {
    error: error.message,
    stack: error.stack,
    data,
    shouldRetry: shouldRetry(error),
  });
}
```

---

## 🟡 Nice-to-Have Features (Add When You Feel Pain)

When your project starts hitting these pain points, consider adding:

### **Dead Letter Queue** 
*Add when*: Jobs start failing often and you don't want to lose them
```typescript
// Simple failed job tracking
failed_jobs: defineTable({
  originalJob: v.string(),
  failureReason: v.string(),
  canRetry: v.boolean(),
  failedAt: v.string(),
})
```

### **Job Queues & Concurrency**
*Add when*: Ingestion takes too long (>30 minutes)
```typescript
// Basic job queue
ingestion_jobs: defineTable({
  jobType: v.string(),
  status: v.union(v.literal('pending'), v.literal('running'), v.literal('completed')),
  payload: v.any(),
})
```

### **Incremental Sync**
*Add when*: Running out of API quota or jobs take too long
```typescript
// Track last sync times
sync_metadata: defineTable({
  entityType: v.string(),
  lastSyncedAt: v.string(),
})
```

### **Provider Abstraction**
*Add when*: You actually add a second data provider

```typescript
// Simple provider interface - just what you need
interface FootballProvider {
  name: string;
  getLeagues(): Promise<League[]>;
  getTeams(leagueId: string): Promise<Team[]>;
  getPlayers(teamId: string): Promise<Player[]>;
  getPlayerStats(playerId: string, leagueId: string): Promise<PlayerStats>;
}

// Current implementation
class ApiFootballProvider implements FootballProvider {
  name = 'api-football';
  
  async getLeagues() {
    const response = await makeAPICall('/leagues');
    return response.response.map(this.transformLeague);
  }
  
  async getTeams(leagueId: string) {
    const response = await makeAPICall(`/teams?league=${leagueId}`);
    return response.response.map(this.transformTeam);
  }
  
  private transformLeague(data: any): League {
    return {
      id: data.league.id.toString(),
      name: data.league.name,
      code: data.league.code,
      season: data.seasons[0]?.year || '2024',
    };
  }
  
  private transformTeam(data: any): Team {
    return {
      id: data.team.id.toString(),
      name: data.team.name,
      shortName: data.team.code,
      crestUrl: data.team.logo,
    };
  }
}

// Provider registry (when you add more)
const providers: Record<string, FootballProvider> = {
  'api-football': new ApiFootballProvider(),
  // 'sofascore': new SofaScoreProvider(), // Future
};

// Simple provider switching
const currentProvider = providers['api-football'];

// Usage in ingestion functions stays the same
async function ingestLeagues() {
  const leagues = await currentProvider.getLeagues();
  // ...rest of logic unchanged
}
```

**Why wait?** 
- Single provider works fine initially
- Abstraction adds complexity you don't need yet
- Easy to add when you hit API limits or want better data
- The provider field in your schema already supports this
````
