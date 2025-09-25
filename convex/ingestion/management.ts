import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';

// Query to get ingestion status and statistics
export const getIngestionStatus = query({
    args: {},
    handler: async (
        ctx,
    ): Promise<{
        data: {
            leagues: number;
            teams: number;
            players: number;
            lastUpdated: number | null;
        };
        recentLogs: Array<{
            timestamp: string;
            level: string;
            message: string;
            data: any;
        }>;
        apiUsage: {
            used: number;
            limit: number;
            date: string;
        };
    }> => {
        // Get counts of ingested data
        const leagues = await ctx.db.query('leagues').collect();
        const teams = await ctx.db.query('teams').collect();
        const players = await ctx.db.query('players').collect();

        // Get recent ingestion logs
        const recentLogs = await ctx.db
            .query('ingestion_logs')
            .withIndex('by_job_type_timestamp', (q) => q.eq('jobType', 'full-ingestion-pipeline'))
            .order('desc')
            .take(10);

        // Get API usage statistics
        const today = new Date().toISOString().split('T')[0];
        const apiUsage = await ctx.db
            .query('api_usage_daily')
            .withIndex('by_provider_date', (q) => q.eq('provider', 'api-football').eq('date', today))
            .first();

        return {
            data: {
                leagues: leagues.length,
                teams: teams.length,
                players: players.length,
                lastUpdated:
                    leagues.length > 0 ? Math.max(...leagues.map((l) => new Date(l.updatedAt).getTime())) : null,
            },
            recentLogs: recentLogs.map((log) => ({
                timestamp: log.timestamp,
                level: log.level,
                message: log.message,
                data: log.data,
            })),
            apiUsage: {
                used: apiUsage?.totalCalls || 0,
                limit: 100, // Free tier limit
                date: today,
            },
        };
    },
});

// Mutation to trigger full ingestion pipeline
export const triggerFullIngestion = mutation({
    args: {
        season: v.optional(v.string()),
        initializeReferenceData: v.optional(v.boolean()),
        ingestLeagues: v.optional(v.boolean()),
        ingestTeams: v.optional(v.boolean()),
        ingestPlayers: v.optional(v.boolean()),
        ingestTeamStats: v.optional(v.boolean()),
        ingestPlayerStats: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }> => {
        // Schedule the ingestion to run as an internal action with all the flags
        await ctx.scheduler.runAfter(0, internal.ingestion.orchestrator.runFullIngestion, args);

        return {
            success: true,
            message: 'Full ingestion pipeline scheduled',
            timestamp: new Date().toISOString(),
        };
    },
});

// Mutation to trigger ingestion for a specific league
export const triggerLeagueIngestion = mutation({
    args: {
        leagueId: v.id('leagues'),
        season: v.optional(v.string()),
        includePlayerStats: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }> => {
        // Schedule the league ingestion to run as an internal mutation
        await ctx.scheduler.runAfter(0, internal.ingestion.orchestrator.runLeagueIngestion, args);

        return {
            success: true,
            message: 'League ingestion scheduled',
            timestamp: new Date().toISOString(),
        };
    },
});

// Mutation to trigger team stats ingestion
export const triggerTeamStatsIngestion = mutation({
    args: {
        season: v.optional(v.string()),
        leagueId: v.optional(v.id('leagues')),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }> => {
        // Schedule the team stats ingestion to run as an internal action
        await ctx.scheduler.runAfter(0, internal.ingestion.teamStats.ingestTeamStats, args);

        return {
            success: true,
            message: 'Team stats ingestion scheduled',
            timestamp: new Date().toISOString(),
        };
    },
});

// Mutation to trigger player stats ingestion
export const triggerPlayerStatsIngestion = mutation({
    args: {
        season: v.optional(v.string()),
        leagueId: v.optional(v.id('leagues')),
        teamId: v.optional(v.id('teams')),
    },
    handler: async (
        ctx,
        args,
    ): Promise<{
        success: boolean;
        message: string;
        timestamp: string;
    }> => {
        // Schedule the player stats ingestion to run as an internal action
        await ctx.scheduler.runAfter(0, internal.ingestion.playerStats.ingestPlayerStats, args);

        return {
            success: true,
            message: 'Player stats ingestion scheduled',
            timestamp: new Date().toISOString(),
        };
    },
});

// Query to get available leagues for ingestion
export const getAvailableLeagues = query({
    args: {},
    handler: async (
        ctx,
    ): Promise<
        Array<{
            _id: Id<'leagues'>;
            name: string;
            code: string | undefined;
            season: string;
            updatedAt: string;
        }>
    > => {
        const leagues = await ctx.db
            .query('leagues')
            .filter((q) => q.eq(q.field('provider'), 'api-football'))
            .collect();

        return leagues.map((league) => ({
            _id: league._id,
            name: league.name,
            code: league.code,
            season: league.season,
            updatedAt: league.updatedAt,
        }));
    },
});

// Query to get teams for a specific league (useful for targeted player stats ingestion)
export const getTeamsByLeague = query({
    args: {
        leagueId: v.id('leagues'),
    },
    handler: async (
        ctx,
        { leagueId },
    ): Promise<
        Array<{
            _id: Id<'teams'>;
            name: string;
            updatedAt: string;
            playerCount?: number;
        }>
    > => {
        const teams = await ctx.db
            .query('teams')
            .withIndex('by_league', (q) => q.eq('leagueId', leagueId))
            .collect();

        // Get player counts for each team
        const teamsWithPlayerCounts = await Promise.all(
            teams.map(async (team) => {
                const players = await ctx.db
                    .query('players')
                    .withIndex('by_team', (q) => q.eq('teamId', team._id))
                    .collect();

                return {
                    _id: team._id,
                    name: team.name,
                    updatedAt: team.updatedAt,
                    playerCount: players.length,
                };
            }),
        );

        return teamsWithPlayerCounts;
    },
});

// Query to get ingestion logs with filtering
export const getIngestionLogs = query({
    args: {
        jobType: v.optional(v.string()),
        level: v.optional(v.union(v.literal('info'), v.literal('warn'), v.literal('error'))),
        limit: v.optional(v.number()),
    },
    handler: async (
        ctx,
        { jobType, level, limit = 50 },
    ): Promise<
        Array<{
            timestamp: string;
            jobType: string;
            level: string;
            message: string;
            data: any;
            apiCalls: number | undefined;
            recordsProcessed: number | undefined;
            recordsCreated: number | undefined;
            recordsUpdated: number | undefined;
            errors: number | undefined;
            durationMs: number | undefined;
        }>
    > => {
        const query = ctx.db.query('ingestion_logs');
        let finalQuery;

        if (jobType) {
            finalQuery = query.withIndex('by_job_type_timestamp', (q) => q.eq('jobType', jobType));
        } else if (level) {
            finalQuery = query.withIndex('by_level_timestamp', (q) => q.eq('level', level));
        } else {
            finalQuery = query.order('desc');
        }

        const logs = await finalQuery.take(limit);

        return logs.map((log) => ({
            timestamp: log.timestamp,
            jobType: log.jobType,
            level: log.level,
            message: log.message,
            data: log.data,
            apiCalls: log.apiCalls,
            recordsProcessed: log.recordsProcessed,
            recordsCreated: log.recordsCreated,
            recordsUpdated: log.recordsUpdated,
            errors: log.errors,
            durationMs: log.durationMs,
        }));
    },
});

// Query to get ingestion statistics including stats snapshots
export const getIngestionStatsOverview = query({
    args: {},
    handler: async (
        ctx,
    ): Promise<{
        entities: {
            leagues: number;
            teams: number;
            players: number;
        };
        stats: {
            teamStatsSnapshots: number;
            playerStatsSnapshots: number;
        };
        lastUpdated: {
            leagues: string | null;
            teams: string | null;
            players: string | null;
            teamStats: string | null;
            playerStats: string | null;
        };
    }> => {
        // Get entity counts
        const leagues = await ctx.db.query('leagues').collect();
        const teams = await ctx.db.query('teams').collect();
        const players = await ctx.db.query('players').collect();

        // Get stats snapshot counts
        const teamStatsSnapshots = await ctx.db.query('team_stats_snapshots').collect();
        const playerStatsSnapshots = await ctx.db.query('player_stats_snapshots').collect();

        // Get last updated timestamps
        const getLatestTimestamp = (items: Array<{ updatedAt: string }>) =>
            items.length > 0
                ? items.reduce(
                      (latest, item) => (new Date(item.updatedAt) > new Date(latest) ? item.updatedAt : latest),
                      items[0].updatedAt,
                  )
                : null;

        return {
            entities: {
                leagues: leagues.length,
                teams: teams.length,
                players: players.length,
            },
            stats: {
                teamStatsSnapshots: teamStatsSnapshots.length,
                playerStatsSnapshots: playerStatsSnapshots.length,
            },
            lastUpdated: {
                leagues: getLatestTimestamp(leagues),
                teams: getLatestTimestamp(teams),
                players: getLatestTimestamp(players),
                teamStats: getLatestTimestamp(teamStatsSnapshots),
                playerStats: getLatestTimestamp(playerStatsSnapshots),
            },
        };
    },
});
