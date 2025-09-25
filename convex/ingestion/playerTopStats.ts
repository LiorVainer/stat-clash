'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { IngestionLogger } from '../logs/ingestion';
import { FootballService } from '../api/football';
import { Doc } from '../_generated/dataModel';

type IngestLeagueTopStatisticsResult = {
    success: boolean;
    leagueId: string;
    season: string;
    results: {
        goals: number;
        assists: number;
        yellowCards: number;
        redCards: number;
    };
    summary: { type: string; count: number }[];
};

export const ingestLeagueTopStatistics = internalAction({
    args: {
        leagueId: v.string(),
        season: v.optional(v.string()),
        includeGoals: v.optional(v.boolean()),
        includeAssists: v.optional(v.boolean()),
        includeYellowCards: v.optional(v.boolean()),
        includeRedCards: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        {
            leagueId,
            season = new Date().getFullYear().toString(),
            includeGoals = true,
            includeAssists = true,
            includeYellowCards = true,
            includeRedCards = true,
        },
    ): Promise<IngestLeagueTopStatisticsResult> => {
        const logger = new IngestionLogger(ctx, 'league-top-statistics-ingestion');
        const footballService = new FootballService(logger);

        try {
            logger.info('Starting league top statistics ingestion', {
                leagueId,
                season,
                flags: { includeGoals, includeAssists, includeYellowCards, includeRedCards },
            });

            const results = {
                goals: 0,
                assists: 0,
                yellowCards: 0,
                redCards: 0,
            };

            // Process all statistics in parallel for efficiency
            const promises = [];

            if (includeGoals) {
                promises.push(
                    footballService.getTopGoalsWithPositions(leagueId, season).then((result) => {
                        results.goals = result.length;
                        return { type: 'goals', count: result.length };
                    }),
                );
            }

            if (includeAssists) {
                promises.push(
                    footballService.getTopAssistsWithPositions(leagueId, season).then((result) => {
                        results.assists = result.length;
                        return { type: 'assists', count: result.length };
                    }),
                );
            }

            if (includeYellowCards) {
                promises.push(
                    footballService.getTopYellowCardsWithPositions(leagueId, season).then((result) => {
                        results.yellowCards = result.length;
                        return { type: 'yellowCards', count: result.length };
                    }),
                );
            }

            if (includeRedCards) {
                promises.push(
                    footballService.getTopRedCardsWithPositions(leagueId, season).then((result) => {
                        results.redCards = result.length;
                        return { type: 'redCards', count: result.length };
                    }),
                );
            }

            const completedResults = await Promise.all(promises);

            logger.info('League top statistics ingestion completed', {
                leagueId,
                season,
                results,
                totalPlayers: Object.values(results).reduce((sum, count) => sum + count, 0),
                completedAt: new Date().toISOString(),
            });

            return {
                success: true,
                leagueId,
                season,
                results,
                summary: completedResults,
            };
        } catch (error) {
            logger.error('League top statistics ingestion failed', {
                leagueId,
                season,
                error: (error as Error).message,
                stack: (error as Error).stack,
            });

            throw error;
        }
    },
});

export const ingestAllLeaguesTopStatistics = internalAction({
    args: {
        season: v.optional(v.string()),
        limitLeagues: v.optional(v.number()),
    },
    handler: async (ctx, { season = new Date().getFullYear().toString(), limitLeagues = 10 }) => {
        const logger = new IngestionLogger(ctx, 'all-leagues-top-statistics-ingestion');

        try {
            logger.info('Starting top statistics ingestion for all leagues', { season, limitLeagues });

            // Get top leagues to process
            const topLeagues: Doc<'leagues'>[] = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});
            const leaguesToProcess = limitLeagues ? topLeagues.slice(0, limitLeagues) : topLeagues;

            logger.info(`Processing ${leaguesToProcess.length} leagues for top statistics`);

            const results = [];

            // Process leagues sequentially to respect rate limits
            for (const league of leaguesToProcess) {
                try {
                    const result: IngestLeagueTopStatisticsResult = await ctx.runAction(
                        internal.ingestion.playerTopStats.ingestLeagueTopStatistics,
                        {
                            leagueId: league.providerLeagueId.toString(),
                            season,
                        },
                    );

                    results.push(result);

                    logger.info(`Completed top statistics for league: ${league.name}`, result);
                } catch (error) {
                    logger.error(`Failed to process league: ${league.name}`, {
                        leagueId: league.providerLeagueId,
                        error: (error as Error).message,
                    });

                    results.push({
                        leagueId: league.providerLeagueId,
                        leagueName: league.name,
                        success: false,
                        error: (error as Error).message,
                    });
                }
            }

            const successCount = results.filter((r) => r.success).length;
            const failureCount = results.filter((r) => !r.success).length;

            logger.info('All leagues top statistics ingestion completed', {
                totalLeagues: leaguesToProcess.length,
                successCount,
                failureCount,
                completedAt: new Date().toISOString(),
            });

            return {
                success: true,
                totalLeagues: leaguesToProcess.length,
                successCount,
                failureCount,
                results,
            };
        } catch (error) {
            logger.error('All leagues top statistics ingestion failed', {
                error: (error as Error).message,
                stack: (error as Error).stack,
            });

            throw error;
        }
    },
});
