'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { FootballService } from '../api/football';
import { IngestionLogger } from '../logs/ingestion';
import { validatePlayerData } from '../lib/validation';
import { internal } from '../_generated/api';
import Bluebird from 'bluebird';

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
            errors: number;
            team: string;
            league: string;
            usage: any;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'ingest-players');
        const footballService = new FootballService(logger);

        try {
            await logger.info('Starting player ingestion', { teamId });

            // Get the team from database
            const team = await ctx.runQuery(internal.services.teams.getTeam, { teamId });
            if (!team) {
                throw new Error(`Team not found: ${teamId}`);
            }

            // Get the league for context
            const league = await ctx.runQuery(internal.services.leagues.getLeague, {
                leagueId: team.leagueId,
            });
            if (!league) {
                throw new Error(`League not found: ${team.leagueId}`);
            }

            // Check current API usage before starting
            const usage = await footballService.getApiUsage();
            await logger.info('Current API usage', usage);

            // Fetch players from API-Football
            const apiPlayers = await footballService.getPlayersByTeam(team.providerTeamId);
            await logger.info(`Fetched ${apiPlayers.length} players from API for team: ${team.name}`);

            // Extract player IDs and fetch detailed player data
            const playerIds = apiPlayers
                .map((player) => player.id)
                .filter((id) => id !== undefined && id !== null)
                .map((id) => parseInt(id.toString()));

            await logger.info(`Fetching detailed data for ${playerIds.length} players`);

            // Get detailed player data with full statistics and information
            const detailedPlayers = await footballService.getPlayersByIds(playerIds);
            await logger.info(`Fetched detailed data for ${detailedPlayers.length} players`, {
                playerIds,
                providerTeamId: team.providerTeamId,
            });

            // Create a map for quick lookup of detailed player data
            const detailedPlayerMap = new Map();
            detailedPlayers.forEach((playerData) => {
                if (playerData.player?.id) {
                    detailedPlayerMap.set(playerData.player.id, playerData);
                }
            });

            let processed = 0;
            let created = 0;
            let updated = 0;
            let errors = 0;

            // Get position references for mapping
            const positions = await ctx.runQuery(internal.services.positions.getPositions, {});
            const positionMap = positions.reduce(
                (map, pos) => {
                    map[pos.code] = pos._id;
                    return map;
                },
                {} as Record<string, any>,
            );

            // Process players in parallel with concurrency limit of 8, using detailed player data
            const results = await Bluebird.map(
                apiPlayers,
                async (basicPlayerData) => {
                    try {
                        // Get detailed player data from the map
                        const detailedPlayerData = detailedPlayerMap.get(basicPlayerData.id);

                        // Use detailed data if available, otherwise fall back to basic data
                        const playerData = detailedPlayerData?.player || basicPlayerData;
                        const playerStats = detailedPlayerData?.statistics?.[0]; // Get first (current) season stats

                        // Map position code to position ID - use detailed data first
                        const positionCode = playerStats?.games?.position || basicPlayerData.position || 'MF';
                        const positionId = positionMap[positionCode] || positionMap['MF'];

                        // Transform API data to our schema with enhanced data
                        const transformedPlayer = {
                            name: playerData.name || basicPlayerData.name || '',
                            position: positionCode,
                            nationality: playerData.nationality,
                            photoUrl: playerData.photo,
                            dateOfBirth: playerData.birth?.date,
                            providerPlayerId: basicPlayerData.id?.toString() || '',
                        };

                        // Validate the data
                        const validatedPlayer = validatePlayerData(transformedPlayer);

                        // Check if player already exists
                        const existingPlayer = await ctx.runQuery(internal.services.players.findPlayerByProvider, {
                            provider: 'api-football',
                            providerPlayerId: validatedPlayer.providerPlayerId,
                        });

                        if (existingPlayer) {
                            // Update existing player
                            await ctx.runMutation(internal.services.players.updatePlayer, {
                                playerId: existingPlayer._id,
                                data: {
                                    name: validatedPlayer.name,
                                    teamId: team._id,
                                    leagueId: league._id,
                                    positionId: positionId,
                                    nationality: validatedPlayer.nationality,
                                    photoUrl: validatedPlayer.photoUrl,
                                    dateOfBirth: validatedPlayer.dateOfBirth,
                                    updatedAt: new Date().toISOString(),
                                },
                            });
                            await logger.info(
                                `Updated player: ${validatedPlayer.name}${detailedPlayerData ? ' (with detailed data)' : ''}`,
                            );
                            return { type: 'updated', name: validatedPlayer.name };
                        } else {
                            // Create new player
                            await ctx.runMutation(internal.services.players.createPlayer, {
                                data: {
                                    teamId: team._id,
                                    leagueId: league._id,
                                    name: validatedPlayer.name,
                                    positionId: positionId,
                                    nationality: validatedPlayer.nationality,
                                    photoUrl: validatedPlayer.photoUrl,
                                    dateOfBirth: validatedPlayer.dateOfBirth,
                                    provider: 'api-football',
                                    providerPlayerId: validatedPlayer.providerPlayerId,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                },
                            });
                            await logger.info(
                                `Created player: ${validatedPlayer.name}${detailedPlayerData ? ' (with detailed data)' : ''}`,
                            );
                            return { type: 'created', name: validatedPlayer.name };
                        }
                    } catch (error) {
                        await logger.error(`Failed to process player`, {
                            error: (error as Error).message,
                            basicPlayerData,
                        });
                        return { type: 'error', error: (error as Error).message };
                    }
                },
                { concurrency: 8 },
            );

            // Count results
            processed = results.length;
            created = results.filter((r) => r.type === 'created').length;
            updated = results.filter((r) => r.type === 'updated').length;
            errors = results.filter((r) => r.type === 'error').length;

            // Get final usage statistics
            const finalUsage = await footballService.getApiUsage();
            await logger.info('Final API usage', finalUsage);

            const summary = {
                processed,
                created,
                updated,
                errors,
                team: team.name,
                league: league.name,
                usage: finalUsage,
            };

            await logger.info('Player ingestion completed', summary);
            return { success: true, summary };
        } catch (error) {
            await logger.error('Player ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
