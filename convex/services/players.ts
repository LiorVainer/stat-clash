import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const findPlayerByProvider = internalQuery({
    args: { provider: v.string(), providerPlayerId: v.string() },
    handler: async (ctx, { provider, providerPlayerId }): Promise<Doc<'players'> | null> =>
        ctx.db
            .query('players')
            .withIndex('by_provider_player', (q) => q.eq('provider', provider).eq('providerPlayerId', providerPlayerId))
            .first(),
});

export const createPlayer = internalMutation({
    args: { data: schema.tables.players.validator },
    handler: async (ctx, { data }) => ctx.db.insert('players', data),
});

export const updatePlayer = internalMutation({
    args: { playerId: v.id('players'), data: partial(schema.tables.players.validator) },
    handler: async (ctx, { playerId, data }) => ctx.db.patch(playerId, data),
});

export const getPlayersByTeamInDB = internalQuery({
    args: { teamId: v.id('teams') },
    handler: async (ctx, { teamId }): Promise<Doc<'players'>[]> =>
        ctx.db
            .query('players')
            .withIndex('by_team', (q) => q.eq('teamId', teamId))
            .collect(),
});
