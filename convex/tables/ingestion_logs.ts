import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const ingestionLogFields = {
    jobType: v.string(),
    level: v.union(v.literal('info'), v.literal('warn'), v.literal('error'), v.literal('success'), v.literal('debug')),
    message: v.string(),
    data: v.optional(v.any()),
    timestamp: v.string(),
    apiCalls: v.optional(v.number()),
    recordsProcessed: v.optional(v.number()),
    recordsCreated: v.optional(v.number()),
    recordsUpdated: v.optional(v.number()),
    errors: v.optional(v.number()),
    durationMs: v.optional(v.number()),
};

export const ingestionLogsTable = defineTable(ingestionLogFields)
    .index('by_job_type_timestamp', ['jobType', 'timestamp'])
    .index('by_level_timestamp', ['level', 'timestamp']);

export default ingestionLogsTable;
