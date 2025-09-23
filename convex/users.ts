// convex/users.ts
import { internalMutation, query, QueryCtx } from './_generated/server';
import { UserJSON } from '@clerk/backend';
import { v, Validator } from 'convex/values';

export const current = query({
    args: {},
    handler: async (ctx) => {
        return await getCurrentUser(ctx);
    },
});

export const upsertFromClerk = internalMutation({
    args: { data: v.any() as Validator<UserJSON> }, // trust Clerk payload
    async handler(ctx, { data }) {
        const userAttributes = {
            name: `${data.first_name} ${data.last_name}`,
            externalId: data.id,
        };

        const user = await userByExternalId(ctx, data.id);
        if (user === null) {
            await ctx.db.insert('users', {
                ...userAttributes,
                updatedAt: new Date().toISOString(),
                createdAt: new Date().toISOString(),
            });
        } else {
            await ctx.db.patch(user._id, { ...userAttributes, updatedAt: new Date().toISOString() });
        }
    },
});

export const deleteFromClerk = internalMutation({
    args: { clerkUserId: v.string() },
    async handler(ctx, { clerkUserId }) {
        const user = await userByExternalId(ctx, clerkUserId);
        if (user !== null) {
            await ctx.db.delete(user._id);
        } else {
            console.warn(`Can't delete user, none for Clerk ID: ${clerkUserId}`);
        }
    },
});

export async function getCurrentUser(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    if (identity === null) return null;
    return await userByExternalId(ctx, identity.subject);
}

async function userByExternalId(ctx: QueryCtx, externalId: string) {
    return await ctx.db
        .query('users')
        .withIndex('by_externalId', (q) => q.eq('externalId', externalId))
        .unique();
}
