import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const positionFields = {
    code: v.string(),
    name: v.string(),
    sortOrder: v.number(),
    createdAt: v.string(),
};

export const positionsTable = defineTable(positionFields).index('by_code', ['code']);
export default positionsTable;
