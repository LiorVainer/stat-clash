import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const getTeam = internalQuery({
    args: { teamId: v.id('teams') },
    handler: async (ctx, { teamId }): Promise<Doc<'teams'> | null> => ctx.db.get(teamId),
});

export const getTeamsByLeagueInDB = internalQuery({
    args: { leagueId: v.id('leagues'), limit: v.optional(v.number()) },
    handler: async (ctx, { leagueId, limit }): Promise<Doc<'teams'>[]> => {
        let q = ctx.db.query('teams').withIndex('by_league', (q) => q.eq('leagueId', leagueId));
        return limit ? q.take(limit) : q.collect();
    },
});

export const findTeamByProvider = internalQuery({
    args: { provider: v.string(), providerTeamId: v.string() },
    handler: async (ctx, { provider, providerTeamId }): Promise<Doc<'teams'> | null> =>
        ctx.db
            .query('teams')
            .withIndex('by_provider_team', (q) => q.eq('provider', provider).eq('providerTeamId', providerTeamId))
            .first(),
});

export const createTeam = internalMutation({
    args: { data: schema.tables.teams.validator },
    handler: async (ctx, { data }) => ctx.db.insert('teams', data),
});

export const updateTeam = internalMutation({
    args: { teamId: v.id('teams'), data: partial(schema.tables.teams.validator) },
    handler: async (ctx, { teamId, data }) => ctx.db.patch(teamId, data),
});
