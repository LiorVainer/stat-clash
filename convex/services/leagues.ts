import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const getLeague = internalQuery({
    args: { leagueId: v.id('leagues') },
    handler: async (ctx, { leagueId }): Promise<Doc<'leagues'> | null> => ctx.db.get(leagueId),
});

export const getTopLeagues = internalQuery({
    args: { limit: v.optional(v.number()) },
    handler: async (ctx, { limit = 10 }): Promise<Doc<'leagues'>[]> =>
        ctx.db
            .query('leagues')
            .filter((q) => q.eq(q.field('provider'), 'api-football'))
            .take(limit),
});

export const findLeagueByProvider = internalQuery({
    args: { provider: v.string(), providerLeagueId: v.string() },
    handler: async (ctx, { provider, providerLeagueId }): Promise<Doc<'leagues'> | null> =>
        ctx.db
            .query('leagues')
            .withIndex('by_provider_league', (q) => q.eq('provider', provider).eq('providerLeagueId', providerLeagueId))
            .first(),
});

export const createLeague = internalMutation({
    args: { data: schema.tables.leagues.validator },
    handler: async (ctx, { data }) => ctx.db.insert('leagues', data),
});

export const updateLeague = internalMutation({
    args: { leagueId: v.id('leagues'), data: partial(schema.tables.leagues.validator) },
    handler: async (ctx, { leagueId, data }) => ctx.db.patch(leagueId, data),
});
