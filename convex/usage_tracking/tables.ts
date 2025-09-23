// See the docs at https://docs.convex.dev/agents/usage-tracking
import { vProviderMetadata, vUsage } from '@convex-dev/agent';
import { defineTable } from 'convex/server';
import { v } from 'convex/values';

// If you want to track usage on a granular level, you could do something like this:
export default {
    rawUsage: defineTable({
        userId: v.string(),
        agentName: v.optional(v.string()),
        model: v.string(),
        provider: v.string(),

        // stats
        usage: vUsage,
        providerMetadata: v.optional(vProviderMetadata),

        // In this case, we're setting it to the first day of the current month,
        // using UTC time for the month boundaries.
        // You could alternatively store it as a timestamp number.
        // You can then fetch all the usage at the end of the billing period
        // and calculate the total cost.
        billingPeriod: v.string(), // When the usage period ended
    }).index('billingPeriod_userId', ['billingPeriod', 'userId']),

    invoices: defineTable({
        userId: v.string(),
        billingPeriod: v.string(),
        amount: v.number(),
        status: v.union(v.literal('pending'), v.literal('paid'), v.literal('failed')),
    }).index('billingPeriod_userId', ['billingPeriod', 'userId']),

    // Track daily API usage by provider
    api_usage_daily: defineTable({
        provider: v.string(), // 'api-football'
        date: v.string(), // 'YYYY-MM-DD'
        totalCalls: v.number(),
        lastUpdated: v.string(),
    }).index('by_provider_date', ['provider', 'date']),

    // Track individual API calls for detailed logging
    api_calls: defineTable({
        provider: v.string(),
        resource: v.string(),
        responseTime: v.number(),
        statusCode: v.number(),
        params: v.optional(v.record(v.string(), v.any())), // Changed from v.string() to v.record(v.string(), v.any())
        error: v.optional(v.string()),
        timestamp: v.string(),
        date: v.string(), // 'YYYY-MM-DD' for easy querying
    })
        .index('by_provider_date', ['provider', 'date'])
        .index('by_provider_resource_date', ['provider', 'resource', 'date'])
        .index('by_timestamp', ['timestamp']),
};
