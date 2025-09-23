import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const findTeamStatsByProvider = internalQuery({
    args: { teamId: v.id('teams'), season: v.string(), provider: v.string() },
    handler: async (ctx, { teamId, season, provider }): Promise<Doc<'team_stats_snapshots'> | null> =>
        ctx.db
            .query('team_stats_snapshots')
            .withIndex('by_team_season', (q) => q.eq('teamId', teamId).eq('season', season))
            .filter((q) => q.eq(q.field('provider'), provider))
            .first(),
});

export const createTeamStats = internalMutation({
    args: { data: schema.tables.team_stats_snapshots.validator },
    handler: async (ctx, { data }) => ctx.db.insert('team_stats_snapshots', data),
});

export const updateTeamStats = internalMutation({
    args: { statsId: v.id('team_stats_snapshots'), data: partial(schema.tables.team_stats_snapshots.validator) },
    handler: async (ctx, { statsId, data }) => ctx.db.patch(statsId, data),
});
