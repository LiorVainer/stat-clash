import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const windowFields = {
    code: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    sortOrder: v.number(),
    createdAt: v.string(),
};

export const windowsTable = defineTable(windowFields).index('by_code', ['code']);
export default windowsTable;
