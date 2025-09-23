import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';

export const initializeReferenceData = internalAction({
    args: {},
    handler: async (
        ctx,
    ): Promise<{
        success: boolean;
        summary: {
            positionsCreated: number;
            windowsCreated: number;
            message: string;
        };
    }> => {
        let positionsCreated = 0;
        let windowsCreated = 0;

        // Create position reference data
        const positions = [
            { code: 'GK', name: 'Goalkeeper', sortOrder: 1 },
            { code: 'DF', name: 'Defender', sortOrder: 2 },
            { code: 'MF', name: 'Midfielder', sortOrder: 3 },
            { code: 'FW', name: 'Forward', sortOrder: 4 },
        ];

        for (const position of positions) {
            const existing = await ctx.runQuery(internal.services.positions.findPositionByCode, {
                code: position.code,
            });

            if (!existing) {
                await ctx.runMutation(internal.services.positions.createPosition, {
                    data: {
                        ...position,
                        createdAt: new Date().toISOString(),
                    },
                });
                console.log(`Created position: ${position.name}`);
                positionsCreated++;
            }
        }

        // Create time window reference data
        const windows = [
            { code: 'season', name: 'Full Season', description: 'Complete season statistics', sortOrder: 1 },
            { code: 'last5', name: 'Last 5 Games', description: 'Statistics from the last 5 matches', sortOrder: 2 },
            { code: 'last10', name: 'Last 10 Games', description: 'Statistics from the last 10 matches', sortOrder: 3 },
            {
                code: 'calendarYTD',
                name: 'Calendar Year to Date',
                description: 'Statistics from January 1st to current date',
                sortOrder: 4,
            },
        ];

        for (const window of windows) {
            const existing = await ctx.runQuery(internal.services.windows.findWindowByCode, {
                code: window.code,
            });

            if (!existing) {
                await ctx.runMutation(internal.services.windows.createWindow, {
                    data: {
                        ...window,
                        createdAt: new Date().toISOString(),
                    },
                });
                console.log(`Created window: ${window.name}`);
                windowsCreated++;
            }
        }

        const summary = {
            positionsCreated,
            windowsCreated,
            message: `Reference data initialization completed. Created ${positionsCreated} positions and ${windowsCreated} windows.`,
        };

        console.log('Reference data initialization completed', summary);
        return { success: true, summary };
    },
});
