import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import schema from '../schema';

export const getPositions = internalQuery({
    args: {},
    handler: async (ctx) => ctx.db.query('positions').collect(),
});

export const findPositionByCode = internalQuery({
    args: { code: v.string() },
    handler: async (ctx, { code }) =>
        ctx.db
            .query('positions')
            .withIndex('by_code', (q) => q.eq('code', code))
            .first(),
});

export const createPosition = internalMutation({
    args: { data: schema.tables.positions.validator },
    handler: async (ctx, { data }) => ctx.db.insert('positions', data),
});
