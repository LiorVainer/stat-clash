'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { FootballService } from '../api/football/football';
import { IngestionLogger } from '../logs/ingestion';
import { validateTeamData } from '../lib/validation';
import { internal } from '../_generated/api';
import Bluebird from 'bluebird';

export const ingestTeams = internalAction({
    args: {
        leagueId: v.id('leagues'),
        season: v.optional(v.string()),
    },
    handler: async (
        ctx,
        { leagueId, season = '2024' },
    ): Promise<{
        success: boolean;
        summary: {
            processed: number;
            created: number;
            updated: number;
            errors: number;
            league: string;
            season: string;
            usage: any;
        };
    }> => {
        const logger = new IngestionLogger(ctx, 'ingest-teams');
        const footballService = new FootballService(logger);

        try {
            await logger.info('Starting team ingestion', { leagueId, season });

            // Get the league from database
            const league = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
            if (!league) {
                throw new Error(`League not found: ${leagueId}`);
            }

            // Check current API usage before starting
            const usage = await footballService.getApiUsage();
            await logger.info('Current API usage', usage);

            // Fetch teams from API-Football
            const apiTeams = await footballService.getTeamsByLeague(league.providerLeagueId, season);
            await logger.info(`Fetched ${apiTeams.length} teams from API for league: ${league.name}`);

            let processed = 0;
            let created = 0;
            let updated = 0;
            let errors = 0;

            // Process teams in parallel with concurrency limit of 5
            const results = await Bluebird.map(
                apiTeams,
                async (teamData) => {
                    try {
                        // Transform API data to our schema
                        const transformedTeam = {
                            name: teamData.team?.name || '',
                            shortName: teamData.team?.code || undefined,
                            crestUrl: teamData.team?.logo || undefined,
                            providerTeamId: teamData.team?.id?.toString() || '',
                        };

                        // Validate the data
                        const validatedTeam = validateTeamData(transformedTeam);

                        // Check if team already exists
                        const existingTeam = await ctx.runQuery(internal.services.teams.findTeamByProvider, {
                            provider: 'api-football',
                            providerTeamId: validatedTeam.providerTeamId,
                        });

                        if (existingTeam) {
                            // Update existing team
                            await ctx.runMutation(internal.services.teams.updateTeam, {
                                teamId: existingTeam._id,
                                data: {
                                    name: validatedTeam.name,
                                    shortName: validatedTeam.shortName,
                                    crestUrl: validatedTeam.crestUrl,
                                    leagueId: league._id,
                                    updatedAt: new Date().toISOString(),
                                },
                            });
                            await logger.info(`Updated team: ${validatedTeam.name}`);
                            return { type: 'updated', name: validatedTeam.name };
                        } else {
                            // Create new team
                            await ctx.runMutation(internal.services.teams.createTeam, {
                                data: {
                                    leagueId: league._id,
                                    name: validatedTeam.name,
                                    shortName: validatedTeam.shortName,
                                    crestUrl: validatedTeam.crestUrl,
                                    provider: 'api-football',
                                    providerTeamId: validatedTeam.providerTeamId,
                                    createdAt: new Date().toISOString(),
                                    updatedAt: new Date().toISOString(),
                                },
                            });
                            await logger.info(`Created team: ${validatedTeam.name}`);
                            return { type: 'created', name: validatedTeam.name };
                        }
                    } catch (error) {
                        await logger.error(`Failed to process team`, {
                            error: (error as Error).message,
                            teamData,
                        });
                        return { type: 'error', error: (error as Error).message };
                    }
                },
                { concurrency: 5 },
            ); // Limit to 5 concurrent operations

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
                league: league.name,
                season,
                usage: finalUsage,
            };

            await logger.info('Team ingestion completed', summary);
            return { success: true, summary };
        } catch (error) {
            await logger.error('Team ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
