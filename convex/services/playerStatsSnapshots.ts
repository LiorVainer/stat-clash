import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const findPlayerStatsByProvider = internalQuery({
    args: { playerId: v.id('players'), season: v.string(), provider: v.string() },
    handler: async (ctx, { playerId, season, provider }): Promise<Doc<'player_stats_snapshots'> | null> =>
        ctx.db
            .query('player_stats_snapshots')
            .withIndex('by_player_season', (q) => q.eq('playerId', playerId).eq('season', season))
            .filter((q) => q.eq(q.field('provider'), provider))
            .first(),
});

export const createPlayerStats = internalMutation({
    args: { data: schema.tables.player_stats_snapshots.validator },
    handler: async (ctx, { data }) => ctx.db.insert('player_stats_snapshots', data),
});

export const updatePlayerStats = internalMutation({
    args: { statsId: v.id('player_stats_snapshots'), data: partial(schema.tables.player_stats_snapshots.validator) },
    handler: async (ctx, { statsId, data }) => ctx.db.patch(statsId, data),
});

// NEW: Update player stats with position data
export const updatePlayerStatsWithPositions = internalMutation({
    args: {
        playerId: v.id('players'),
        leagueId: v.id('leagues'),
        season: v.string(),
        data: partial(schema.tables.player_stats_snapshots.validator),
    },
    handler: async (ctx, { playerId, leagueId, season, data }) => {
        // Find existing stats record
        const existingStats = await ctx.db
            .query('player_stats_snapshots')
            .withIndex('by_player_season', (q) => q.eq('playerId', playerId).eq('season', season))
            .filter((q) => q.eq(q.field('leagueId'), leagueId))
            .first();

        if (existingStats) {
            // Update existing record with position data
            return await ctx.db.patch(existingStats._id, {
                leaguePositions: data.leaguePositions,
                updatedAt: new Date().toISOString(),
            });
        } else {
            throw new Error(`Player stats not found for player ${playerId} in league ${leagueId} season ${season}`);
        }
    },
});

// NEW: Get top players by position in a specific league and season
export const getTopPlayersByPosition = internalQuery({
    args: {
        leagueId: v.id('leagues'),
        season: v.string(),
        statType: v.union(v.literal('goals'), v.literal('assists'), v.literal('yellowCards'), v.literal('redCards')),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const { leagueId, season, statType, limit = 20 } = args;

        const players = await ctx.db
            .query('player_stats_snapshots')
            .withIndex('by_league_season', (q) => q.eq('leagueId', leagueId).eq('season', season))
            .filter((q) => q.neq(q.field(`leaguePositions.${statType}`), undefined))
            .collect();

        // Sort by position and take the limit
        return players
            .sort((a, b) => {
                const aPos = a.leaguePositions?.[leagueId][statType] || Infinity;
                const bPos = b.leaguePositions?.[leagueId][statType] || Infinity;
                return aPos - bPos;
            })
            .slice(0, limit);
    },
});

// NEW: Get player's position in a specific league for all stats
export const getPlayerAllPositions = internalQuery({
    args: {
        playerId: v.id('players'),
        leagueId: v.id('leagues'),
        season: v.string(),
    },
    handler: async (ctx, args) => {
        const playerStats = await ctx.db
            .query('player_stats_snapshots')
            .withIndex('by_player_season', (q) => q.eq('playerId', args.playerId).eq('season', args.season))
            .filter((q) => q.eq(q.field('leagueId'), args.leagueId))
            .first();

        return playerStats?.leaguePositions || null;
    },
});
