import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import schema from '../schema';

export const findWindowByCode = internalQuery({
    args: { code: v.string() },
    handler: async (ctx, { code }) =>
        ctx.db
            .query('windows')
            .withIndex('by_code', (q) => q.eq('code', code))
            .first(),
});

export const createWindow = internalMutation({
    args: { data: schema.tables.windows.validator },
    handler: async (ctx, { data }) => ctx.db.insert('windows', data),
});
