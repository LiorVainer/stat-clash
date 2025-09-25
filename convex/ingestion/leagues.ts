'use node';

import { internalAction } from '../_generated/server';
import { FootballService } from '../api/football';
import { IngestionLogger } from '../logs/ingestion';
import { validateLeagueData } from '../lib/validation';
import { internal } from '../_generated/api';
import { TOP_LEAGUE_IDS } from './constants/leagues.const';

export const ingestLeagues = internalAction({
    args: {},
    handler: async (
        ctx,
    ): Promise<{
        success: boolean;
        summary: {
            processed: number;
            created: number;
            updated: number;
            errors: number;
            usage: any;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'ingest-leagues');
        const footballService = new FootballService(logger);

        try {
            logger.info('Starting league ingestion');

            // Check current API usage before starting
            const usage = await footballService.getApiUsage();
            logger.info('Current API usage', usage);

            // Fetch leagues from API-Football using predefined league IDs
            const apiLeagues = await footballService.getLeaguesByIds(TOP_LEAGUE_IDS);
            logger.info(`Fetched ${apiLeagues.length} leagues from API`);

            let processed = 0;
            let created = 0;
            let updated = 0;
            let errors = 0;

            for (const leagueData of apiLeagues) {
                try {
                    processed++;

                    // Transform API data to our schema
                    const transformedLeague = {
                        name: leagueData.league?.name || '',
                        code: leagueData.league?.type || undefined,
                        season: leagueData.seasons?.[0]?.year?.toString() || '2024',
                        providerLeagueId: leagueData.league?.id?.toString() || '',
                    };

                    // Validate the data
                    const validatedLeague = validateLeagueData(transformedLeague);

                    // Check if league already exists
                    const existingLeague = await ctx.runQuery(internal.services.leagues.findLeagueByProvider, {
                        provider: 'api-football',
                        providerLeagueId: validatedLeague.providerLeagueId,
                    });

                    if (existingLeague) {
                        // Update existing league
                        await ctx.runMutation(internal.services.leagues.updateLeague, {
                            leagueId: existingLeague._id,
                            data: {
                                name: validatedLeague.name,
                                code: validatedLeague.code,
                                season: validatedLeague.season,
                                updatedAt: new Date().toISOString(),
                            },
                        });
                        updated++;
                        logger.info(`Updated league: ${validatedLeague.name}`);
                    } else {
                        // Create new league
                        await ctx.runMutation(internal.services.leagues.createLeague, {
                            data: {
                                name: validatedLeague.name,
                                code: validatedLeague.code,
                                season: validatedLeague.season,
                                provider: 'api-football',
                                providerLeagueId: validatedLeague.providerLeagueId,
                                createdAt: new Date().toISOString(),
                                updatedAt: new Date().toISOString(),
                            },
                        });
                        created++;
                        logger.info(`Created league: ${validatedLeague.name}`);
                    }
                } catch (error) {
                    errors++;
                    logger.error(`Failed to process league`, {
                        error: (error as Error).message,
                        leagueData,
                    });
                }
            }

            // Get final usage statistics
            const finalUsage = await footballService.getApiUsage();
            logger.info('Final API usage', finalUsage);

            const summary = {
                processed,
                created,
                updated,
                errors,
                usage: finalUsage,
            };

            logger.info('League ingestion completed', summary);
            return { success: true, summary };
        } catch (error) {
            logger.error('League ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
