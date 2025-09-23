'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { IngestionLogger } from '../logs/ingestion';
import Bluebird from 'bluebird';

export const runFullIngestion = internalAction({
    args: {
        season: v.optional(v.string()),
        includePlayerStats: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        { season = '2024', includePlayerStats = false },
    ): Promise<{
        success: boolean;
        summary: {
            leagues: number;
            teams: number;
            players: number;
            season: string;
            includePlayerStats: boolean;
            completedAt: string;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'full-ingestion-pipeline');

        try {
            await logger.info('Starting full ingestion pipeline', { season, includePlayerStats });

            // Step 1: Initialize reference data (positions, windows)
            await logger.info('Step 1: Initializing reference data');
            await ctx.runAction(internal.ingestion.initialize.initializeReferenceData, {});

            // Step 2: Ingest leagues
            await logger.info('Step 2: Ingesting leagues');
            const leagueResult = await ctx.runAction(internal.ingestion.leagues.ingestLeagues, {});
            await logger.info('League ingestion completed', leagueResult.summary);

            // Step 3: Get top leagues to focus on (limit API calls)
            const topLeagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});

            let totalTeamsProcessed = 0;
            let totalPlayersProcessed = 0;

            // Step 4: Ingest teams for all leagues in parallel with concurrency limit of 3
            const teamResults = await Bluebird.map(
                topLeagues,
                async (league) => {
                    await logger.info(`Step 4: Ingesting teams for league: ${league.name}`);

                    const teamResult = await ctx.runAction(internal.ingestion.teams.ingestTeams, {
                        leagueId: league._id,
                        season,
                    });

                    await logger.info(`Teams ingestion completed for ${league.name}`, teamResult.summary);
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

            // Step 5: Ingest players for each team (optional, API intensive)
            if (includePlayerStats) {
                await logger.info('Step 5: Starting parallel player ingestion for all teams');

                // Get all teams from all leagues and process them in parallel
                const allTeamsPromises = topLeagues.map((league) =>
                    ctx.runQuery(internal.services.teams.getTeamsByLeague, {
                        leagueId: league._id,
                        limit: 20, // Limit to 10 teams per league to manage API usage
                    }),
                );

                const allTeamsArrays = await Promise.all(allTeamsPromises);
                const allTeams = allTeamsArrays.flat(); // Flatten all teams into single array

                // Process all teams' players in parallel with concurrency limit of 2
                const playerResults = await Bluebird.map(
                    allTeams,
                    async (team) => {
                        await logger.info(`Step 5: Ingesting players for team: ${team.name}`);

                        const playerResult = await ctx.runAction(internal.ingestion.players.ingestPlayers, {
                            teamId: team._id,
                        });

                        await logger.info(`Player ingestion completed for ${team.name}`, playerResult.summary);
                        return {
                            team: team.name,
                            playersProcessed: playerResult.summary.processed,
                            playerResult,
                        };
                    },
                    { concurrency: 5 },
                ); // Process 2 teams' players concurrently

                // Sum up player results
                totalPlayersProcessed = playerResults.reduce((sum, result) => sum + result.playersProcessed, 0);
            }

            const finalSummary = {
                leagues: leagueResult.summary.processed,
                teams: totalTeamsProcessed,
                players: totalPlayersProcessed,
                season,
                includePlayerStats,
                completedAt: new Date().toISOString(),
            };

            await logger.info('Full ingestion pipeline completed successfully', finalSummary);
            return { success: true, summary: finalSummary };
        } catch (error) {
            await logger.error('Full ingestion pipeline failed', { error: (error as Error).message });
            throw error;
        }
    },
});

// Helper function to run ingestion for a specific league
export const runLeagueIngestion = internalAction({
    args: {
        leagueId: v.id('leagues'),
        season: v.optional(v.string()),
        includePlayerStats: v.optional(v.boolean()),
    },
    handler: async (
        ctx,
        { leagueId, season = '2024', includePlayerStats = false },
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

            await logger.info(`Starting parallel ingestion for league: ${league.name}`, { season, includePlayerStats });

            // Ingest teams for the league
            const teamResult = await ctx.runAction(internal.ingestion.teams.ingestTeams, {
                leagueId,
                season,
            });

            let totalPlayersProcessed = 0;

            // Optionally ingest players in parallel
            if (includePlayerStats) {
                const teams = await ctx.runQuery(internal.services.teams.getTeamsByLeague, {
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
            }

            const summary = {
                league: league.name,
                teams: teamResult.summary.processed,
                players: totalPlayersProcessed,
                season,
                completedAt: new Date().toISOString(),
            };

            await logger.info(`League ingestion completed for ${league.name}`, summary);
            return { success: true, summary };
        } catch (error) {
            await logger.error('League ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
