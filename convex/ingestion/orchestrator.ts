'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { IngestionLogger } from '../logs/ingestion';
import Bluebird from 'bluebird';

export const runFullIngestion = internalAction({
    args: {
        season: v.optional(v.string()),
        initializeReferenceData: v.optional(v.boolean()),
        ingestLeagues: v.optional(v.boolean()),
        ingestTeams: v.optional(v.boolean()),
        ingestPlayers: v.optional(v.boolean()),
        ingestTeamStats: v.optional(v.boolean()),
        ingestPlayerStats: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        {
            season = '2025',
            initializeReferenceData = true,
            ingestLeagues = true,
            ingestTeams = true,
            ingestPlayers = true,
            ingestTeamStats = true,
            ingestPlayerStats = true,
        },
    ): Promise<{
        success: boolean;
        summary: {
            leagues: number;
            teams: number;
            players: number;
            playerStatsIngested: boolean;
            teamStatsIngested: boolean;
            season: string;
            completedAt: string;
            stepsSkipped: string[];
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'full-ingestion-pipeline');
        const stepsSkipped: string[] = [];

        try {
            logger.info('Starting full ingestion pipeline', {
                season,
                flags: {
                    initializeReferenceData,
                    ingestLeagues,
                    ingestTeams,
                    ingestPlayers,
                    ingestTeamStats,
                    ingestPlayerStats,
                },
            });

            // Step 1: Initialize reference data (positions, windows)
            if (initializeReferenceData) {
                logger.info('Step 1: Initializing reference data');
                await ctx.runAction(internal.ingestion.initialize.initializeReferenceData, {});
            } else {
                stepsSkipped.push('initialize-reference-data');
                logger.info('Step 1: Skipping reference data initialization (flag disabled)');
            }

            // Step 2: Ingest leagues
            let leagueResult = { summary: { processed: 0 } };
            if (ingestLeagues) {
                logger.info('Step 2: Ingesting leagues');
                leagueResult = await ctx.runAction(internal.ingestion.leagues.ingestLeagues, {});
                logger.info('League ingestion completed', leagueResult.summary);
            } else {
                stepsSkipped.push('ingest-leagues');
                logger.info('Step 2: Skipping leagues ingestion (flag disabled)');
            }

            // Step 3: Get top leagues to focus on (limit API calls)
            const topLeagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});

            let totalTeamsProcessed = 0;
            let totalPlayersProcessed = 0;

            // Step 4: Ingest teams for all leagues in parallel with concurrency limit of 3
            if (ingestTeams) {
                const teamResults = await Bluebird.map(
                    topLeagues,
                    async (league) => {
                        logger.info(`Step 4: Ingesting teams for league: ${league.name}`);

                        const teamResult = await ctx.runAction(internal.ingestion.teams.ingestTeams, {
                            leagueId: league._id,
                            season,
                        });

                        logger.info(`Teams ingestion completed for ${league.name}`, teamResult.summary);
                        return {
                            league: league.name,
                            teamsProcessed: teamResult.summary.processed,
                            teamResult,
                        };
                    },
                    { concurrency: 3 },
                ); // Process 3 leagues concurrently

                // Sum up team results
                totalTeamsProcessed = teamResults.reduce((sum, result) => sum + result.teamsProcessed, 0);
            } else {
                stepsSkipped.push('ingest-teams');
                logger.info('Step 4: Skipping teams ingestion (flag disabled)');
            }

            // Step 5: Ingest players
            if (ingestPlayers) {
                logger.info('Step 5: Starting parallel player ingestion for all teams');

                const playerIngestionResult = await ctx.runAction(
                    internal.ingestion.orchestrator.runParallelPlayerIngestion,
                    {
                        teamsPerLeague: 20, // Limit to 20 teams per league to manage API usage
                        concurrency: 5, // Process 5 teams' players concurrently
                    },
                );

                totalPlayersProcessed = playerIngestionResult.summary.totalPlayersProcessed;
                logger.info('Step 5: Player ingestion completed', playerIngestionResult.summary);
            } else {
                stepsSkipped.push('ingest-players');
                logger.info('Step 5: Skipping players ingestion (flag disabled)');
            }

            // Step 6: Ingest team statistics for all leagues
            let teamStatsIngested = false;
            if (ingestTeamStats) {
                logger.info('Step 6: Starting team statistics ingestion for all leagues');

                try {
                    await ctx.runAction(internal.ingestion.teamStats.ingestTeamStats, {
                        season,
                        // No leagueId specified to process all top leagues
                    });
                    teamStatsIngested = true;
                    logger.info('Team statistics ingestion completed successfully');
                } catch (error) {
                    logger.error('Team statistics ingestion failed', { error: (error as Error).message });
                    // Continue with pipeline even if team stats fail
                }
            } else {
                stepsSkipped.push('ingest-team-stats');
                logger.info('Step 6: Skipping team statistics ingestion (flag disabled)');
            }

            // Step 7: Ingest player statistics
            let playerStatsIngested = false;
            if (ingestPlayerStats) {
                logger.info('Step 7: Starting player statistics ingestion');

                try {
                    await ctx.runAction(internal.ingestion.playerStats.ingestPlayerStats, {
                        season,
                        // No leagueId or teamId specified to process all available players
                    });
                    playerStatsIngested = true;
                    logger.info('Player statistics ingestion completed successfully');
                } catch (error) {
                    logger.error('Player statistics ingestion failed', { error: (error as Error).message });
                    // Continue with pipeline even if player stats fail
                }
            } else {
                stepsSkipped.push('ingest-player-stats');
                logger.info('Step 7: Skipping player statistics ingestion (flag disabled)');
            }

            const finalSummary = {
                leagues: leagueResult.summary.processed,
                teams: totalTeamsProcessed,
                players: totalPlayersProcessed,
                playerStatsIngested,
                teamStatsIngested,
                season,
                completedAt: new Date().toISOString(),
                stepsSkipped,
            };

            logger.info('Full ingestion pipeline completed successfully', finalSummary);
            return { success: true, summary: finalSummary };
        } catch (error) {
            logger.error('Full ingestion pipeline failed', { error: (error as Error).message });
            throw error;
        }
    },
});

// Helper function to run ingestion for a specific league
export const runLeagueIngestion = internalAction({
    args: {
        leagueId: v.id('leagues'),
        season: v.optional(v.string()),
    },
    handler: async (
        ctx,
        { leagueId, season = '2025' },
    ): Promise<{
        success: boolean;
        summary: {
            league: string;
            teams: number;
            players: number;
            season: string;
            completedAt: string;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'league-ingestion');

        try {
            const league = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
            if (!league) {
                throw new Error(`League not found: ${leagueId}`);
            }

            logger.info(`Starting parallel ingestion for league: ${league.name}`, { season });

            // Ingest teams for the league
            const teamResult = await ctx.runAction(internal.ingestion.teams.ingestTeams, {
                leagueId,
                season,
            });

            let totalPlayersProcessed = 0;

            // Optionally ingest players in parallel
            const teams = await ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, {
                leagueId,
            });

            // Process all teams' players in parallel with concurrency limit of 3
            const playerResults = await Bluebird.map(
                teams,
                async (team) => {
                    const playerResult = await ctx.runAction(internal.ingestion.players.ingestPlayers, {
                        teamId: team._id,
                    });
                    return playerResult.summary.processed;
                },
                { concurrency: 3 },
            ); // Process 3 teams concurrently

            totalPlayersProcessed = playerResults.reduce((sum, count) => sum + count, 0);

            const summary = {
                league: league.name,
                teams: teamResult.summary.processed,
                players: totalPlayersProcessed,
                season,
                completedAt: new Date().toISOString(),
            };

            logger.info(`League ingestion completed for ${league.name}`, summary);
            return { success: true, summary };
        } catch (error) {
            logger.error('League ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});

// Helper function to run player ingestion for multiple teams in parallel
export const runParallelPlayerIngestion = internalAction({
    args: {
        teamsPerLeague: v.optional(v.number()),
        concurrency: v.optional(v.number()),
    },
    handler: async (
        ctx,
        { teamsPerLeague = 20, concurrency = 5 },
    ): Promise<{
        success: boolean;
        summary: {
            totalTeams: number;
            totalPlayersProcessed: number;
            leaguesProcessed: number;
            teamResults: Array<{
                team: string;
                playersProcessed: number;
            }>;
            completedAt: string;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'parallel-player-ingestion');

        try {
            // Query top leagues from the database
            const topLeagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});

            logger.info('Starting parallel player ingestion for all teams', {
                leaguesCount: topLeagues.length,
                teamsPerLeague,
                concurrency,
            });

            // Get all teams from all leagues and process them in parallel
            const allTeamsPromises = topLeagues.map((league) =>
                ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, {
                    leagueId: league._id,
                    limit: teamsPerLeague, // Limit teams per league to manage API usage
                }),
            );

            const allTeamsArrays = await Promise.all(allTeamsPromises);
            const allTeams = allTeamsArrays.flat(); // Flatten all teams into single array

            logger.info(`Found ${allTeams.length} teams across ${allTeamsArrays.length} leagues`);

            // Process all teams' players in parallel with specified concurrency limit
            const playerResults = await Bluebird.map(
                allTeams,
                async (team) => {
                    logger.info(`Ingesting players for team: ${team.name}`);

                    const playerResult = await ctx.runAction(internal.ingestion.players.ingestPlayers, {
                        teamId: team._id,
                    });

                    logger.info(`Player ingestion completed for ${team.name}`, playerResult.summary);
                    return {
                        team: team.name,
                        playersProcessed: playerResult.summary.processed,
                        playerResult,
                    };
                },
                { concurrency },
            );

            // Sum up player results
            const totalPlayersProcessed = playerResults.reduce((sum, result) => sum + result.playersProcessed, 0);

            // Create simplified team results for summary
            const teamResults = playerResults.map((result) => ({
                team: result.team,
                playersProcessed: result.playersProcessed,
            }));

            const summary = {
                totalTeams: allTeams.length,
                totalPlayersProcessed,
                leaguesProcessed: topLeagues.length,
                teamResults,
                completedAt: new Date().toISOString(),
            };

            logger.info('Parallel player ingestion completed successfully', summary);
            return { success: true, summary };
        } catch (error) {
            logger.error('Parallel player ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
