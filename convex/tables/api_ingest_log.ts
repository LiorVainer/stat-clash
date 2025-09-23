import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const apiIngestLogFields = {
    provider: v.string(),
    resource: v.string(),
    providerParams: v.optional(v.string()),
    ok: v.boolean(),
    statusCode: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.string(),
};

export const apiIngestLogTable = defineTable(apiIngestLogFields)
    .index('by_provider_created', ['provider', 'createdAt'])
    .index('by_ok_created', ['ok', 'createdAt']);

export default apiIngestLogTable;
