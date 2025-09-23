import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import usageTables from './usage_tracking/tables';
// Import extracted tables
import { leaguesTable } from './tables/leagues';
import { teamsTable } from './tables/teams';
import { playersTable } from './tables/players';
import { positionsTable } from './tables/positions';
import { windowsTable } from './tables/windows';
import { playerStatsSnapshotsTable } from './tables/player_stats_snapshots';
import { teamStatsSnapshotsTable } from './tables/team_stats_snapshots';
import { ingestionLogsTable } from './tables/ingestion_logs';
import { apiIngestLogTable } from './tables/api_ingest_log';

export default defineSchema({
    ...usageTables,

    // Reference tables
    positions: positionsTable,

    windows: windowsTable,

    // Core entities
    users: defineTable({
        externalId: v.optional(v.string()),
        name: v.string(),
        locale: v.optional(v.string()),
        proSince: v.optional(v.number()),
        proPlan: v.optional(v.string()),
        favoriteLeagueIds: v.optional(v.array(v.id('leagues'))),
        favoritePositionIds: v.optional(v.array(v.id('positions'))),
        updatedAt: v.string(),
        createdAt: v.string(),
    })
        .index('by_externalId', ['externalId'])
        .index('by_name', ['name']),

    guests: defineTable({
        sessionId: v.string(),
    }).index('by_sessionId', ['sessionId']),

    leagues: leaguesTable,

    teams: teamsTable,

    players: playersTable,

    // Stats snapshots
    player_stats_snapshots: playerStatsSnapshotsTable,

    team_stats_snapshots: teamStatsSnapshotsTable,

    // Question generation
    seeds: defineTable({
        date: v.string(),
        leagueId: v.id('leagues'),
        metric: v.string(),
        windowId: v.id('windows'),
        index: v.number(),
        seed: v.string(),
        createdAt: v.string(),
    })
        .index('by_date_league_metric_window', ['date', 'leagueId', 'metric', 'windowId'])
        .index('by_seed', ['seed']),

    questions: defineTable({
        date: v.string(),
        leagueId: v.id('leagues'),
        metric: v.string(),
        window: v.id('windows'),
        seed: v.string(),
        subjectType: v.union(v.literal('player'), v.literal('team')),
        token: v.optional(v.string()),
        expiresAt: v.optional(v.number()),
        difficulty: v.number(),
        repeatKey: v.string(),
        explanation: v.string(),
        // Player-based questions
        options: v.optional(v.any()), // Record<Id<'players'>|Id<'teams'>, number>
        playerData: v.optional(
            v.array(
                v.object({
                    playerId: v.id('players'),
                    name: v.string(),
                    positionId: v.id('positions'),
                    positionName: v.string(),
                    nationality: v.optional(v.string()),
                    photoUrl: v.optional(v.string()),
                    teamName: v.optional(v.string()),
                }),
            ),
        ),
        correctPlayer: v.optional(v.id('players')),
        // Team-based questions
        teamData: v.optional(
            v.array(
                v.object({
                    teamId: v.id('teams'),
                    name: v.string(),
                    crestUrl: v.optional(v.string()),
                }),
            ),
        ),
        correctTeam: v.optional(v.id('teams')),
        createdAt: v.string(),
    })
        .index('by_date', ['date'])
        .index('by_date_league_metric_window', ['date', 'leagueId', 'metric', 'window'])
        .index('by_token', ['token'])
        .index('by_seed', ['seed']),

    // Game sessions
    sessions: defineTable({
        userId: v.id('users'),
        date: v.string(),
        sessionId: v.string(),
        questionIds: v.array(v.id('questions')),
        questionTokens: v.any(), // Record<string, string>
        currentRound: v.number(),
        score: v.number(),
        finished: v.boolean(),
        createdAt: v.string(),
        updatedAt: v.string(),
    })
        .index('by_user_date', ['userId', 'date'])
        .index('by_date_score', ['date', 'score']),

    attempts: defineTable({
        userId: v.optional(v.id('users')),
        sessionId: v.id('sessions'),
        questionId: v.id('questions'),
        chosenPlayer: v.optional(v.id('players')),
        chosenTeam: v.optional(v.id('teams')),
        correct: v.boolean(),
        responseMs: v.number(),
        scoreAwarded: v.number(),
        userAgent: v.optional(v.string()),
        ipHash: v.optional(v.string()),
        createdAt: v.string(),
    })
        .index('by_session', ['sessionId'])
        .index('by_user_created', ['userId', 'createdAt'])
        .index('by_question', ['questionId']),

    session_pools: defineTable({
        sessionId: v.id('sessions'),
        pools: v.array(
            v.object({
                leagueId: v.id('leagues'),
                metric: v.string(),
                windowId: v.id('windows'),
                count: v.number(),
            }),
        ),
        questionIds: v.array(v.id('questions')),
        createdAt: v.string(),
    }).index('by_session', ['sessionId']),

    user_question_history: defineTable({
        userId: v.id('users'),
        questionId: v.id('questions'),
        repeatKey: v.string(),
        date: v.string(),
        sessionId: v.id('sessions'),
        createdAt: v.string(),
    })
        .index('by_user_repeat_key', ['userId', 'repeatKey'])
        .index('by_user_question', ['userId', 'questionId']),

    question_pools: defineTable({
        date: v.string(),
        leagueId: v.id('leagues'),
        metric: v.string(),
        window: v.id('windows'),
        weight: v.number(),
        createdAt: v.string(),
    }).index('by_date', ['date']),

    // Leaderboards
    leaderboard_daily: defineTable({
        date: v.string(),
        userId: v.optional(v.id('users')),
        alias: v.string(),
        score: v.number(),
        totalResponseMs: v.optional(v.number()),
        finishedAt: v.optional(v.number()),
        createdAt: v.string(),
    }).index('by_date_score_response_finish', ['date', 'score', 'totalResponseMs', 'finishedAt']),

    // Monetization & Analytics
    ad_impressions: defineTable({
        attemptId: v.optional(v.id('attempts')),
        userId: v.optional(v.id('users')),
        slot: v.string(),
        network: v.string(),
        createdAt: v.string(),
        renderedAt: v.optional(v.number()),
    })
        .index('by_slot_created', ['slot', 'createdAt'])
        .index('by_user_created', ['userId', 'createdAt']),

    pro_events: defineTable({
        userId: v.id('users'),
        event: v.union(
            v.literal('view_pro_page'),
            v.literal('click_checkout'),
            v.literal('checkout_success'),
            v.literal('checkout_cancel'),
        ),
        meta: v.optional(v.string()),
        createdAt: v.string(),
    })
        .index('by_user_created', ['userId', 'createdAt'])
        .index('by_event_created', ['event', 'createdAt']),

    stripe_events: defineTable({
        eventId: v.string(),
        createdAt: v.string(),
    }).index('by_event_id', ['eventId']),

    // Logging
    api_ingest_log: apiIngestLogTable,

    ingestion_logs: ingestionLogsTable,

    gameplay_log: defineTable({
        userId: v.optional(v.id('users')),
        sessionId: v.optional(v.id('sessions')),
        event: v.string(),
        meta: v.optional(v.string()),
        createdAt: v.string(),
    })
        .index('by_event_created', ['event', 'createdAt'])
        .index('by_user_created', ['userId', 'createdAt'])
        .index('by_session_created', ['sessionId', 'createdAt']),
});
