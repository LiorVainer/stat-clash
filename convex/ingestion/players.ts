'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { FootballService, SinglePlayersResponse } from '../api/football';
import { validatePlayerData } from '../lib/validation';
import { internal } from '../_generated/api';
import { Id } from '../_generated/dataModel';
import Bluebird from 'bluebird';
import { IngestionLogger } from '../logs/ingestion';

export const ingestPlayers = internalAction({
    args: {
        teamId: v.id('teams'),
    },
    handler: async (
        ctx,
        { teamId },
    ): Promise<{
        success: boolean;
        summary: {
            processed: number;
            created: number;
            updated: number;
            errors: any;
            team: string;
            league: string;
            usage: any;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'ingest-players');
        const footballService = new FootballService(logger);
        // Track comprehensive metrics for debugging
        const metrics = {
            apiPlayersRetrieved: 0,
            playerIdsExtracted: 0,
            detailedPlayersRetrieved: 0,
            detailedPlayersMapped: 0,
            positionsLoaded: 0,
            processed: 0,
            created: 0,
            updated: 0,
            errorCount: 0,
            validationErrors: 0,
            databaseErrors: 0,
            missingDetailedData: 0,
            errorDetails: [] as Array<{ type: string; message: string; meta?: any }>,
        };

        try {
            logger.info('Starting player ingestion', {
                teamId,
                timestamp: new Date().toISOString(),
                process: 'initialization',
            });

            // Get the team from database with detailed logging
            const team = await ctx.runQuery(internal.services.teams.getTeam, { teamId });
            if (!team) {
                const errorMsg = `Team not found: ${teamId}`;
                logger.error(errorMsg, { teamId, process: 'team-lookup' });
                throw new Error(errorMsg);
            }

            logger.info('Team found', {
                teamName: team.name,
                teamId: team._id,
                teamProviderId: team.providerTeamId,
                leagueId: team.leagueId,
                process: 'team-lookup',
            });

            // Get the league for context with detailed logging
            const league = await ctx.runQuery(internal.services.leagues.getLeague, {
                leagueId: team.leagueId,
            });
            if (!league) {
                const errorMsg = `League not found: ${team.leagueId}`;
                logger.error(errorMsg, {
                    leagueId: team.leagueId,
                    teamName: team.name,
                    process: 'league-lookup',
                });
                throw new Error(errorMsg);
            }

            logger.info('League found', {
                leagueName: league.name,
                leagueId: league._id,
                leagueProviderId: league.providerLeagueId,
                season: league.season,
                process: 'league-lookup',
            });

            // Check current API usage before starting
            const initialUsage = await footballService.getApiUsage();
            logger.info('Initial API usage', {
                ...initialUsage,
                process: 'api-usage-check',
            });

            // Fetch players from API-Football with detailed tracking
            logger.info('Fetching players from API', {
                teamName: team.name,
                teamProviderId: team.providerTeamId,
                process: 'api-players-fetch',
            });

            const apiPlayers = await footballService.getPlayersByTeam(team.providerTeamId);
            metrics.apiPlayersRetrieved = apiPlayers.length;

            logger.info('Players fetched from API', {
                playersCount: apiPlayers.length,
                teamName: team.name,
                teamProviderId: team.providerTeamId,
                playerNames: apiPlayers.map((p) => ({ name: p.name, id: p.id })).slice(0, 10), // First 10 for brevity
                process: 'api-players-retrieved',
            });

            if (!apiPlayers.length) {
                logger.warn('No players found in API for team', {
                    teamName: team.name,
                    teamProviderId: team.providerTeamId,
                    process: 'api-players-empty',
                });
                return {
                    success: true,
                    summary: {
                        processed: 0,
                        created: 0,
                        updated: 0,
                        errors: 0,
                        team: team.name,
                        league: league.name,
                        usage: initialUsage,
                    },
                };
            }

            // Extract player IDs and fetch detailed player data
            const playerIds = apiPlayers
                .map((player) => player.id)
                .filter((id) => id !== undefined && id !== null)
                .map((id) => parseInt(id.toString()));

            metrics.playerIdsExtracted = playerIds.length;

            logger.info('Player IDs extracted', {
                totalApiPlayers: apiPlayers.length,
                validPlayerIds: playerIds.length,
                invalidIds: apiPlayers.length - playerIds.length,
                playerIds: playerIds.slice(0, 10), // First 10 for brevity
                process: 'player-ids-extraction',
            });

            if (playerIds.length !== apiPlayers.length) {
                const missingIds = apiPlayers.length - playerIds.length;
                metrics.errorDetails.push({
                    type: 'invalid-player-ids',
                    message: `${missingIds} players have invalid/missing IDs`,
                    meta: { teamName: team.name, missingIds },
                });
                logger.warn('Some players have invalid IDs', {
                    totalPlayers: apiPlayers.length,
                    validIds: playerIds.length,
                    invalidIds: missingIds,
                    process: 'player-ids-validation',
                });
            }

            // Get detailed player data with full statistics and information
            logger.info('Fetching detailed player data', {
                playerIdsCount: playerIds.length,
                process: 'detailed-players-fetch',
            });

            const detailedPlayers = await footballService.getPlayersByIds(playerIds);
            metrics.detailedPlayersRetrieved = detailedPlayers.length;

            logger.info('Detailed player data fetched', {
                requestedIds: playerIds.length,
                receivedPlayers: detailedPlayers.length,
                missingDetailed: playerIds.length - detailedPlayers.length,
                teamName: team.name,
                process: 'detailed-players-retrieved',
            });

            if (detailedPlayers.length !== playerIds.length) {
                const missingDetailed = playerIds.length - detailedPlayers.length;
                metrics.missingDetailedData = missingDetailed;
                metrics.errorDetails.push({
                    type: 'missing-detailed-data',
                    message: `${missingDetailed} players missing detailed data`,
                    meta: { teamName: team.name, missingDetailed },
                });
                logger.warn('Some players missing detailed data', {
                    requestedIds: playerIds.length,
                    receivedDetailed: detailedPlayers.length,
                    missingCount: missingDetailed,
                    process: 'detailed-data-validation',
                });
            }

            // Create a map for quick lookup of detailed player data
            const sd: SinglePlayersResponse = {};
            const detailedPlayerMap = new Map<number, SinglePlayersResponse>();
            detailedPlayers.forEach((playerData) => {
                if (playerData.player?.id) {
                    detailedPlayerMap.set(playerData.player.id, playerData);
                    metrics.detailedPlayersMapped++;
                }
            });

            logger.info('Detailed player mapping completed', {
                totalDetailedPlayers: detailedPlayers.length,
                successfullyMapped: metrics.detailedPlayersMapped,
                mappingIssues: detailedPlayers.length - metrics.detailedPlayersMapped,
                process: 'detailed-players-mapping',
            });

            // Process players in parallel with concurrency limit of 8, using detailed player data
            logger.info('Starting parallel player processing', {
                totalPlayers: apiPlayers.length,
                concurrency: 8,
                process: 'players-processing-start',
            });

            const results = await Bluebird.map(
                apiPlayers,
                async (basicPlayerData, playerIndex) => {
                    const playerStartTime = Date.now();
                    try {
                        logger.info(`Processing player ${playerIndex + 1}/${apiPlayers.length}`, {
                            playerName: basicPlayerData.name,
                            playerId: basicPlayerData.id,
                            teamName: team.name,
                            process: 'individual-player-processing',
                            playerIndex,
                            totalPlayers: apiPlayers.length,
                        });

                        // Get detailed player data from the map
                        const detailedPlayerData = detailedPlayerMap.get(basicPlayerData.id);

                        if (!detailedPlayerData?.player) {
                            logger.warn('No detailed data available for player', {
                                playerName: basicPlayerData.name,
                                playerId: basicPlayerData.id,
                                fallbackToBasic: true,
                                process: 'detailed-data-missing',
                            });

                            return { type: 'error', error: 'Missing detailed player data', name: basicPlayerData.name };
                        }

                        // Use detailed data if available, otherwise fall back to basic data
                        const playerData = detailedPlayerData.player;
                        const playerStats = detailedPlayerData.statistics?.[0]; // Get first (current) season stats

                        // Map position code to position ID - use detailed data first
                        const positionCode = playerStats?.games?.position || basicPlayerData.position;
                        const positionId = positionCode;

                        logger.info('Player data prepared for processing', {
                            playerName: playerData.name,
                            hasDetailedData: !!detailedPlayerData,
                            positionCode,
                            positionId: positionId ? 'mapped' : 'fallback',
                            nationality: playerData.nationality,
                            hasPhoto: !!playerData.photo,
                            process: 'player-data-preparation',
                        });

                        // Transform API data to our schema with enhanced data
                        const transformedPlayer = {
                            name: playerData?.name,
                            firstName: playerData.firstname,
                            lastName: playerData.lastname,
                            position: positionCode,
                            nationality: playerData?.nationality,
                            photoUrl: playerData?.photo,
                            dateOfBirth: playerData?.birth?.date,
                            providerPlayerId: basicPlayerData.id?.toString() || '',
                        };

                        // Validate the data
                        let validatedPlayer;
                        try {
                            validatedPlayer = validatePlayerData(transformedPlayer);
                            logger.info('Player data validation successful', {
                                playerName: transformedPlayer.name,
                                process: 'data-validation',
                            });
                        } catch (validationError) {
                            metrics.validationErrors++;
                            metrics.errorDetails.push({
                                type: 'validation-error',
                                message: (validationError as Error).message,
                                meta: { playerName: transformedPlayer.name, playerData: transformedPlayer },
                            });
                            logger.error('Player data validation failed', {
                                playerName: transformedPlayer.name,
                                error: (validationError as Error).message,
                                playerData: transformedPlayer,
                                process: 'data-validation',
                            });
                            return {
                                type: 'error',
                                error: (validationError as Error).message,
                                name: transformedPlayer.name,
                            };
                        }

                        // Check if player already exists
                        const existingPlayer = await ctx.runQuery(internal.services.players.findPlayerByProvider, {
                            provider: 'api-football',
                            providerPlayerId: validatedPlayer.providerPlayerId,
                        });

                        if (existingPlayer) {
                            // Update existing player
                            try {
                                await ctx.runMutation(internal.services.players.updatePlayer, {
                                    playerId: existingPlayer._id,
                                    data: {
                                        name: validatedPlayer.name,
                                        lastName: validatedPlayer.lastName,
                                        firstName: validatedPlayer.firstName,
                                        teamId: team._id,
                                        leagueId: league._id,
                                        positionId: positionId,
                                        nationality: validatedPlayer.nationality,
                                        photoUrl: validatedPlayer.photoUrl,
                                        dateOfBirth: validatedPlayer.dateOfBirth,
                                        updatedAt: new Date().toISOString(),
                                    },
                                });
                                logger.info('Player updated successfully', {
                                    playerName: validatedPlayer.name,
                                    existingPlayerId: existingPlayer._id,
                                    hasDetailedData: !!detailedPlayerData,
                                    processingTimeMs: Date.now() - playerStartTime,
                                    process: 'database-update',
                                });
                                return { type: 'updated', name: validatedPlayer.name };
                            } catch (dbError) {
                                metrics.databaseErrors++;
                                metrics.errorDetails.push({
                                    type: 'database-update-error',
                                    message: (dbError as Error).message,
                                    meta: { playerName: validatedPlayer.name, existingPlayerId: existingPlayer._id },
                                });
                                logger.error('Failed to update player in database', {
                                    playerName: validatedPlayer.name,
                                    existingPlayerId: existingPlayer._id,
                                    error: (dbError as Error).message,
                                    process: 'database-update',
                                });
                                return { type: 'error', error: (dbError as Error).message, name: validatedPlayer.name };
                            }
                        } else {
                            // Create new player
                            try {
                                await ctx.runMutation(internal.services.players.createPlayer, {
                                    data: {
                                        teamId: team._id,
                                        leagueId: league._id,
                                        name: validatedPlayer.name,
                                        lastName: validatedPlayer.lastName,
                                        firstName: validatedPlayer.firstName,
                                        positionId: positionId as Id<'positions'>,
                                        nationality: validatedPlayer.nationality,
                                        photoUrl: validatedPlayer.photoUrl,
                                        dateOfBirth: validatedPlayer.dateOfBirth,
                                        provider: 'api-football',
                                        providerPlayerId: validatedPlayer.providerPlayerId,
                                        createdAt: new Date().toISOString(),
                                        updatedAt: new Date().toISOString(),
                                    },
                                });
                                logger.info('Player created successfully', {
                                    playerName: validatedPlayer.name,
                                    hasDetailedData: !!detailedPlayerData,
                                    processingTimeMs: Date.now() - playerStartTime,
                                    process: 'database-create',
                                });
                                return { type: 'created', name: validatedPlayer.name };
                            } catch (dbError) {
                                metrics.databaseErrors++;
                                metrics.errorDetails.push({
                                    type: 'database-create-error',
                                    message: (dbError as Error).message,
                                    meta: { playerName: validatedPlayer.name },
                                });
                                logger.error('Failed to create player in database', {
                                    playerName: validatedPlayer.name,
                                    error: (dbError as Error).message,
                                    process: 'database-create',
                                });
                                return { type: 'error', error: (dbError as Error).message, name: validatedPlayer.name };
                            }
                        }
                    } catch (error) {
                        metrics.errorDetails.push({
                            type: 'player-processing-error',
                            message: (error as Error).message,
                            meta: {
                                playerName: basicPlayerData.name,
                                playerId: basicPlayerData.id,
                                teamName: team.name,
                            },
                        });
                        logger.error('Failed to process player', {
                            playerName: basicPlayerData.name,
                            playerId: basicPlayerData.id,
                            error: (error as Error).message,
                            errorStack: (error as Error).stack,
                            processingTimeMs: Date.now() - playerStartTime,
                            basicPlayerData,
                            process: 'player-processing-error',
                        });
                        return { type: 'error', error: (error as Error).message, name: basicPlayerData.name };
                    }
                },
                { concurrency: 8 },
            );

            // Count results and update metrics
            metrics.processed = results.length;
            metrics.created = results.filter((r) => r.type === 'created').length;
            metrics.updated = results.filter((r) => r.type === 'updated').length;
            metrics.errorCount = results.filter((r) => r.type === 'error').length;

            // Get final usage statistics
            const finalUsage = await footballService.getApiUsage();
            logger.info('Final API usage', {
                ...finalUsage,
                process: 'api-usage-final',
            });

            // Log detailed results breakdown
            const createdPlayers = results.filter((r) => r.type === 'created').map((r) => r.name);
            const updatedPlayers = results.filter((r) => r.type === 'updated').map((r) => r.name);
            const errorPlayers = results
                .filter((r) => r.type === 'error')
                .map((r) => ({ name: r.name, error: r.error }));

            logger.info('Player processing results breakdown', {
                createdPlayers: createdPlayers.slice(0, 10), // First 10 for brevity
                updatedPlayers: updatedPlayers.slice(0, 10), // First 10 for brevity
                errorPlayers: errorPlayers.slice(0, 5), // First 5 for brevity
                totalCreated: createdPlayers.length,
                totalUpdated: updatedPlayers.length,
                totalErrors: errorPlayers.length,
                process: 'results-breakdown',
            });

            const summary = {
                processed: metrics.processed,
                created: metrics.created,
                updated: metrics.updated,
                errors: metrics.errorCount,
                team: team.name,
                league: league.name,
                usage: finalUsage,
            };

            // Final comprehensive summary with metrics
            logger.success('Player ingestion completed', {
                summary,
                detailedMetrics: {
                    apiPlayersRetrieved: metrics.apiPlayersRetrieved,
                    playerIdsExtracted: metrics.playerIdsExtracted,
                    detailedPlayersRetrieved: metrics.detailedPlayersRetrieved,
                    detailedPlayersMapped: metrics.detailedPlayersMapped,
                    positionsLoaded: metrics.positionsLoaded,
                    validationErrors: metrics.validationErrors,
                    databaseErrors: metrics.databaseErrors,
                    missingDetailedData: metrics.missingDetailedData,
                    totalErrors: metrics.errorDetails.length,
                    successRate:
                        metrics.apiPlayersRetrieved > 0
                            ? (((metrics.created + metrics.updated) / metrics.apiPlayersRetrieved) * 100).toFixed(2) +
                              '%'
                            : '0%',
                },
                errorSummary: metrics.errorDetails.reduce(
                    (acc, error) => {
                        acc[error.type] = (acc[error.type] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>,
                ),
                process: 'final-summary',
            });

            // Log warnings for common issues
            if (metrics.missingDetailedData > 0) {
                logger.warn('Some players missing detailed API data', {
                    missingCount: metrics.missingDetailedData,
                    totalPlayers: metrics.apiPlayersRetrieved,
                    percentage: ((metrics.missingDetailedData / metrics.apiPlayersRetrieved) * 100).toFixed(2) + '%',
                    process: 'missing-detailed-data-warning',
                });
            }

            if (metrics.validationErrors > 0) {
                logger.warn('Some players failed data validation', {
                    validationErrors: metrics.validationErrors,
                    totalPlayers: metrics.apiPlayersRetrieved,
                    percentage: ((metrics.validationErrors / metrics.apiPlayersRetrieved) * 100).toFixed(2) + '%',
                    process: 'validation-errors-warning',
                });
            }

            return { success: true, summary };
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error('Player ingestion failed', {
                error: errorMsg,
                errorStack: (error as Error).stack,
                teamId,
                metrics,
                process: 'fatal-error',
            });
            throw error;
        }
    },
});
