import { internalMutation, mutation } from './_generated/server';
import { internal } from './_generated/api';

// Seed positions reference data
export const seedPositions = internalMutation({
    args: {},
    handler: async (ctx) => {
        const positions = [
            { code: 'GK', name: 'Goalkeeper', sortOrder: 1 },
            { code: 'DF', name: 'Defender', sortOrder: 2 },
            { code: 'MF', name: 'Midfielder', sortOrder: 3 },
            { code: 'FW', name: 'Forward', sortOrder: 4 },
        ];

        const now = new Date().toISOString();
        const results = [];

        for (const position of positions) {
            // Check if position already exists
            const existing = await ctx.db
                .query('positions')
                .withIndex('by_code', (q) => q.eq('code', position.code))
                .first();

            if (!existing) {
                const id = await ctx.db.insert('positions', {
                    ...position,
                    createdAt: now,
                });
                results.push({ code: position.code, id, status: 'created' });
            } else {
                results.push({ code: position.code, id: existing._id, status: 'exists' });
            }
        }

        return results;
    },
});

// Seed windows reference data
export const seedWindows = internalMutation({
    args: {},
    handler: async (ctx) => {
        const windows = [
            {
                code: 'season',
                name: 'Full Season',
                description: 'Statistics for the entire current season',
                sortOrder: 1,
            },
            {
                code: 'last5',
                name: 'Last 5 Games',
                description: 'Statistics from the last 5 matches played',
                sortOrder: 2,
            },
            {
                code: 'last10',
                name: 'Last 10 Games',
                description: 'Statistics from the last 10 matches played',
                sortOrder: 3,
            },
            {
                code: 'calendarYTD',
                name: 'Calendar Year to Date',
                description: 'Statistics from January 1st to current date',
                sortOrder: 4,
            },
        ];

        const now = new Date().toISOString();
        const results = [];

        for (const window of windows) {
            // Check if window already exists
            const existing = await ctx.db
                .query('windows')
                .withIndex('by_code', (q) => q.eq('code', window.code))
                .first();

            if (!existing) {
                const id = await ctx.db.insert('windows', {
                    ...window,
                    createdAt: now,
                });
                results.push({ code: window.code, id, status: 'created' });
            } else {
                results.push({ code: window.code, id: existing._id, status: 'exists' });
            }
        }

        return results;
    },
});

// Initialize both reference tables
type SeedResult = { code: string; id: string; status: 'created' | 'exists' };

export const seedReferenceData = mutation({
    args: {},
    handler: async (ctx) => {
        const positionsResult = (await ctx.runMutation(internal.seedData.seedPositions, {})) as SeedResult[];
        const windowsResult = (await ctx.runMutation(internal.seedData.seedWindows, {})) as SeedResult[];
        return { positions: positionsResult, windows: windowsResult };
    },
});
