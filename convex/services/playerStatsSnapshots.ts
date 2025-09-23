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
