'use node';

import qs from 'qs';
import { FootballApi, LeaguesListParams, PlayerStatistics, StatisticsListData } from './client';
import { IngestionLogger } from '../../logs/ingestion';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../_generated/api';
import { Timer } from '../../logs/timer';
import Bluebird from 'bluebird';

const API_CONFIG = {
    BASE_URL: 'https://v3.football.api-sports.io',
    PROVIDER_NAME: 'api-football',
    DAILY_LIMIT: 7000, // Free tier limit
    LIMIT_WARNING_THRESHOLD: 0.9, // Warn at 90% of daily limit
    CONCURRENCY: {
        LEAGUES: 3, // Concurrent league API calls
        PLAYERS: 5, // Concurrent player detail API calls
        TEAMS: 5, // Concurrent team processing (used in ingestion files)
        PLAYER_PROCESSING: 8, // Concurrent player processing (used in ingestion files)
    },
} as const;

const RETRY_CONFIG = {
    MAX_ATTEMPTS: 3,
    BASE_DELAY_MS: 1000,
    SERVER_ERROR_THRESHOLD: 500, // Don't retry client errors (< 500)
} as const;

const HTTP_STATUS = {
    SUCCESS_MIN: 200,
    SUCCESS_MAX: 300,
} as const;

const RESOURCES = {
    LEAGUES: 'leagues',
    TEAMS: 'teams',
    PLAYERS: 'players',
    PLAYER_STATS: 'player-stats',
    SQUADS: 'squads',
    TEAM_STATS: 'team-stats',
} as const;

export const footballApiClient = new FootballApi({
    headers: {
        'x-apisports-key': process.env.SOCCER_API_KEY,
    },
});

footballApiClient.instance.interceptors.request.use((config) => {
    const baseURL = config.baseURL || '';
    const url = config.url || '';
    const query = config.params ? `?${qs.stringify(config.params, { arrayFormat: 'repeat' })}` : '';
    console.log(`Making request to: ${baseURL}${url}${query}`);
    return config;
});

export class FootballService {
    private apiClient: FootballApi;
    private convexClient: ConvexHttpClient;

    constructor(private logger: IngestionLogger) {
        this.apiClient = new FootballApi({
            baseURL: API_CONFIG.BASE_URL,
            headers: {
                'x-apisports-key': process.env.FOOTBALL_API_KEY,
            },
        });

        // Initialize Convex client for database operations
        this.convexClient = new ConvexHttpClient(process.env.CONVEX_CLOUD_URL!);
    }

    // Get current API usage from database
    private async getCurrentApiUsage(date?: string): Promise<{ totalCalls: number; date: string; provider: string }> {
        try {
            return await this.convexClient.query(api.usage_tracking.usageHandler.getApiUsage, {
                provider: API_CONFIG.PROVIDER_NAME,
                date,
            });
        } catch (error) {
            await this.logger.warn('Failed to get API usage from database', { error: (error as Error).message });
            return {
                totalCalls: 0,
                date: date || new Date().toISOString().split('T')[0],
                provider: API_CONFIG.PROVIDER_NAME,
            };
        }
    }

    // Log API call to database
    private async logApiCallToDatabase(
        resource: string,
        responseTime: number,
        statusCode: number,
        params?: Record<string, any>,
        error?: string,
    ): Promise<void> {
        try {
            await this.convexClient.mutation(api.usage_tracking.usageHandler.incrementApiUsage, {
                provider: API_CONFIG.PROVIDER_NAME,
                resource,
                responseTime,
                statusCode,
                params,
                error,
            });
        } catch (dbError) {
            await this.logger.error('Failed to log API call to database', {
                error: (dbError as Error).message,
                resource,
                statusCode,
            });
        }
    }

    // NEW: Centralized API limit checking - called automatically before each request
    private async checkApiLimits(): Promise<void> {
        const currentUsage = await this.getCurrentApiUsage();
        if (currentUsage.totalCalls >= API_CONFIG.DAILY_LIMIT * API_CONFIG.LIMIT_WARNING_THRESHOLD) {
            await this.logger.warn('Approaching API limit', {
                currentCalls: currentUsage.totalCalls,
                limit: API_CONFIG.DAILY_LIMIT,
                percentUsed: Math.round((currentUsage.totalCalls / API_CONFIG.DAILY_LIMIT) * 100),
            });
        }

        if (currentUsage.totalCalls >= API_CONFIG.DAILY_LIMIT) {
            throw new Error(
                `Daily API limit exceeded: ${currentUsage.totalCalls}/${API_CONFIG.DAILY_LIMIT} calls used`,
            );
        }
    }

    // Enhanced retry with centralized error handling, logging, and API limit checking
    private async withRetry<T>(
        operation: () => Promise<T>,
        resource: string,
        params?: Record<string, any>,
        maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS,
        baseDelay = RETRY_CONFIG.BASE_DELAY_MS,
    ): Promise<T> {
        let lastError: Error;
        const timer = new Timer();
        let statusCode = 0;
        let error: string | undefined;

        // Check API limits before starting any operation
        await this.checkApiLimits();

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await operation();
                statusCode = HTTP_STATUS.SUCCESS_MIN;

                // Log successful API call to both systems
                await this.logApiCallToDatabase(resource, timer.total(), statusCode, params);
                await this.logger.logApiCall({
                    provider: API_CONFIG.PROVIDER_NAME,
                    resource,
                    responseTime: timer.total(),
                    statusCode,
                    params: params
                        ? Object.entries(params)
                              .map(([k, v]) => `${k}=${v}`)
                              .join('&')
                        : undefined,
                });

                return result;
            } catch (err: any) {
                lastError = err;
                statusCode = err.response?.status || 0;
                error = err.message || 'Unknown error';

                // Log failed API call to both systems
                await this.logApiCallToDatabase(resource, timer.total(), statusCode, params, error);
                await this.logger.logApiCall({
                    provider: API_CONFIG.PROVIDER_NAME,
                    resource,
                    responseTime: timer.total(),
                    statusCode,
                    params: params
                        ? Object.entries(params)
                              .map(([k, v]) => `${k}=${v}`)
                              .join('&')
                        : undefined,
                    error,
                });

                // Don't retry on validation errors or 4xx client errors
                if (error?.includes('validation') || statusCode < RETRY_CONFIG.SERVER_ERROR_THRESHOLD) {
                    throw err;
                }

                if (attempt === maxAttempts) {
                    await this.logger.error(`Max retries exceeded for ${resource}`, {
                        attempts: maxAttempts,
                        finalError: error,
                    });
                    throw lastError;
                }

                const delay = baseDelay * Math.pow(2, attempt - 1);
                await this.logger.warn(`Retrying ${resource} after error`, {
                    attempt,
                    maxAttempts,
                    delayMs: delay,
                    error,
                });

                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        throw lastError!;
    }

    async getLeagues() {
        await this.logger.info('Fetching leagues from API-Football');
        return this.withRetry(async () => {
            const response = await this.apiClient.leagues.leaguesList({});
            return response.response || [];
        }, RESOURCES.LEAGUES);
    }

    async getLeaguesByIds(leagueIds: number[], current: LeaguesListParams['current'] = 'true') {
        await this.logger.info('Fetching leagues by IDs from API-Football', { leagueIds, count: leagueIds.length });

        // Make concurrent API calls for each league ID with concurrency control
        const leagueResponses = await Bluebird.map(
            leagueIds,
            async (leagueId) => {
                return this.withRetry(
                    async () => {
                        const response = await this.apiClient.leagues.leaguesList({
                            id: leagueId,
                            current,
                        });
                        return response.response || [];
                    },
                    RESOURCES.LEAGUES,
                    { id: leagueId },
                );
            },
            { concurrency: API_CONFIG.CONCURRENCY.LEAGUES },
        ); // Limit to configured concurrent league API calls

        // Flatten the results since each response is an array
        const allLeagues = leagueResponses.flat();

        await this.logger.info(`Successfully fetched ${allLeagues.length} leagues from ${leagueIds.length} API calls`);

        return allLeagues;
    }

    async getTeamsByLeague(leagueId: string, season: string = '2025') {
        await this.logger.info('Fetching teams', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.teams.teamsList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });

                return response.response || [];
            },
            RESOURCES.TEAMS,
            params,
        );
    }

    async getPlayersByTeam(teamId: string) {
        await this.logger.info('Fetching players', { teamId });
        const params = { team: teamId };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.squadsList({
                    team: parseInt(teamId),
                });
                return response.response?.at(0)?.players || [];
            },
            RESOURCES.SQUADS,
            params,
        );
    }

    async getPlayerStats(playerId: string, season: string = '2025'): Promise<PlayerStatistics | null> {
        await this.logger.info('Fetching player stats', { playerId, season });
        const params = { id: playerId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.playersList({
                    id: parseInt(playerId),
                    season: parseInt(season),
                });
                return response.response?.at(0)?.statistics?.at(0) ?? null;
            },
            RESOURCES.PLAYER_STATS,
            params,
        );
    }

    async getApiUsage() {
        const currentUsage = await this.getCurrentApiUsage();
        return {
            used: currentUsage.totalCalls,
            limit: API_CONFIG.DAILY_LIMIT,
            remaining: API_CONFIG.DAILY_LIMIT - currentUsage.totalCalls,
            percentUsed: Math.round((currentUsage.totalCalls / API_CONFIG.DAILY_LIMIT) * 100),
            date: currentUsage.date,
        };
    }

    // New method to get detailed usage statistics
    async getUsageStats(startDate: string, endDate: string) {
        try {
            return await this.convexClient.query(api.usage_tracking.usageHandler.getUsageStats, {
                provider: API_CONFIG.PROVIDER_NAME,
                startDate,
                endDate,
            });
        } catch (error) {
            await this.logger.error('Failed to get usage stats', { error: (error as Error).message });
            throw error;
        }
    }

    async getApiCallHistory(date?: string, resource?: string, limit?: number) {
        try {
            return await this.convexClient.query(api.usage_tracking.usageHandler.getApiCallHistory, {
                provider: API_CONFIG.PROVIDER_NAME,
                date,
                resource,
                limit,
            });
        } catch (error) {
            await this.logger.error('Failed to get API call history', { error: (error as Error).message });
            throw error;
        }
    }

    async getPlayersByIds(playerIds: number[]) {
        await this.logger.info('Fetching detailed player data by IDs from API-Football', {
            playerIds,
            count: playerIds.length,
        });

        // Make concurrent API calls for each player ID with concurrency control
        const playerResponses = await Bluebird.map(
            playerIds,
            async (playerId) => {
                return this.withRetry(
                    async () => {
                        const response = await this.apiClient.players.playersList({
                            id: playerId,
                            season: parseInt(new Date().getFullYear().toString()), // Current season
                        });
                        return response.response || [];
                    },
                    RESOURCES.PLAYERS,
                    { id: playerId },
                );
            },
            { concurrency: API_CONFIG.CONCURRENCY.PLAYERS },
        ); // Limit to configured concurrent player API calls

        // Flatten the results since each response is an array
        const allPlayers = playerResponses.flat();

        await this.logger.info(
            `Successfully fetched ${allPlayers.length} detailed players from ${playerIds.length} API calls`,
        );

        return allPlayers;
    }

    async getTeamStats(
        teamId: string,
        leagueId: string,
        season: string = new Date().getFullYear().toString(),
    ): Promise<StatisticsListData['response'] | null> {
        await this.logger.info('Fetching team stats', { teamId, leagueId, season });
        const params = { team: teamId, league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.teams.statisticsList({
                    team: parseInt(teamId),
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                // response.response is typically a single object for this endpoint
                return response.response || null;
            },
            RESOURCES.TEAM_STATS,
            params,
        );
    }
}
