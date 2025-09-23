// See the docs at https://docs.convex.dev/agents/usage-tracking
import { internalMutation, mutation, query } from '../_generated/server';
import { v } from 'convex/values';
import { UsageHandler, vProviderMetadata, vUsage } from '@convex-dev/agent';
import { internal } from '../_generated/api';

export function getBillingPeriod(at: number) {
    const now = new Date(at);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth());
    return startOfMonth.toISOString().split('T')[0];
}

export const usageHandler: UsageHandler = async (ctx, args) => {
    if (!args.userId) {
        console.debug('Not tracking usage for anonymous user');
        return;
    }
    await ctx.runMutation(internal.usage_tracking.usageHandler.insertRawUsage, {
        userId: args.userId,
        agentName: args.agentName,
        model: args.model,
        provider: args.provider,
        usage: args.usage,
        providerMetadata: args.providerMetadata,
    });
};

export const insertRawUsage = internalMutation({
    args: {
        userId: v.string(),
        agentName: v.optional(v.string()),
        model: v.string(),
        provider: v.string(),
        usage: vUsage,
        providerMetadata: v.optional(vProviderMetadata),
    },
    handler: async (ctx, args) => {
        const billingPeriod = getBillingPeriod(Date.now());
        return await ctx.db.insert('rawUsage', {
            ...args,
            billingPeriod,
        });
    },
});

export const tokensPerDay = query(async (ctx) => {
    const usageRecords = await ctx.db.query('rawUsage').collect();
    const usageByDay: Record<string, { input: number; output: number; total: number }> = {};

    for (const record of usageRecords) {
        // Use _creationTime or your own timestamp field
        const date = new Date(record._creationTime).toISOString().split('T')[0];
        const input = record.usage?.promptTokens ?? 0;
        const output = record.usage?.completionTokens ?? 0;
        const total = record.usage?.totalTokens ?? 0;

        if (!usageByDay[date]) {
            usageByDay[date] = { input: 0, output: 0, total: 0 };
        }
        usageByDay[date].input += input;
        usageByDay[date].output += output;
        usageByDay[date].total += total;
    }

    return usageByDay;
});

// Get current API usage for a provider on a specific date
export const getApiUsage = query({
    args: {
        provider: v.string(),
        date: v.optional(v.string()), // defaults to today
    },
    handler: async (ctx, { provider, date }) => {
        const targetDate = date || new Date().toISOString().split('T')[0];

        const usage = await ctx.db
            .query('api_usage_daily')
            .withIndex('by_provider_date', (q) => q.eq('provider', provider).eq('date', targetDate))
            .first();

        return usage || { totalCalls: 0, date: targetDate, provider };
    },
});

// Increment API usage count
export const incrementApiUsage = mutation({
    args: {
        provider: v.string(),
        resource: v.string(),
        responseTime: v.number(),
        statusCode: v.number(),
        params: v.optional(v.record(v.string(), v.any())),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = new Date();
        const timestamp = now.toISOString();
        const date = now.toISOString().split('T')[0];

        // Log the individual API call
        await ctx.db.insert('api_calls', {
            provider: args.provider,
            resource: args.resource,
            responseTime: args.responseTime,
            statusCode: args.statusCode,
            params: args.params,
            error: args.error,
            timestamp,
            date,
        });

        // Update daily usage count
        const existingUsage = await ctx.db
            .query('api_usage_daily')
            .withIndex('by_provider_date', (q) => q.eq('provider', args.provider).eq('date', date))
            .first();

        if (existingUsage) {
            await ctx.db.patch(existingUsage._id, {
                totalCalls: existingUsage.totalCalls + 1,
                lastUpdated: timestamp,
            });
        } else {
            await ctx.db.insert('api_usage_daily', {
                provider: args.provider,
                date,
                totalCalls: 1,
                lastUpdated: timestamp,
            });
        }

        return { success: true, date, totalCalls: (existingUsage?.totalCalls || 0) + 1 };
    },
});

// Get detailed API call history
export const getApiCallHistory = query({
    args: {
        provider: v.string(),
        date: v.optional(v.string()),
        resource: v.optional(v.string()),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, { provider, date, resource, limit = 100 }) => {
        const targetDate = date || new Date().toISOString().split('T')[0];

        let query = ctx.db
            .query('api_calls')
            .withIndex('by_provider_date', (q) => q.eq('provider', provider).eq('date', targetDate));

        if (resource) {
            query = ctx.db
                .query('api_calls')
                .withIndex('by_provider_resource_date', (q) =>
                    q.eq('provider', provider).eq('resource', resource).eq('date', targetDate),
                );
        }

        return await query.order('desc').take(limit);
    },
});

// Get usage statistics for a date range
export const getUsageStats = query({
    args: {
        provider: v.string(),
        startDate: v.string(),
        endDate: v.string(),
    },
    handler: async (ctx, { provider, startDate, endDate }) => {
        const usage = await ctx.db
            .query('api_usage_daily')
            .withIndex('by_provider_date', (q) => q.eq('provider', provider))
            .filter((q) => q.and(q.gte(q.field('date'), startDate), q.lte(q.field('date'), endDate)))
            .collect();

        const totalCalls = usage.reduce((sum, day) => sum + day.totalCalls, 0);
        const avgCallsPerDay = usage.length > 0 ? totalCalls / usage.length : 0;

        return {
            totalCalls,
            avgCallsPerDay: Math.round(avgCallsPerDay * 100) / 100,
            daysWithUsage: usage.length,
            dailyBreakdown: usage,
        };
    },
});
