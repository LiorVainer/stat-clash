'use node';

import { FootballApi, LeaguesListParams, PlayerStatistics, StatisticsListData } from './client';
import { IngestionLogger } from '../../logs/ingestion';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../_generated/api';
import { Timer } from '../../logs/timer';
import Bluebird from 'bluebird';
import Bottleneck from 'bottleneck';

const API_CONFIG = {
    BASE_URL: 'https://v3.football.api-sports.io',
    PROVIDER_NAME: 'api-football',
    DAILY_LIMIT: 11000, // Free tier limit
    LIMIT_WARNING_THRESHOLD: 0.9, // Warn at 90% of daily limit
    // Bottleneck rate limiting configuration
    RATE_LIMIT: {
        // 280 requests per minute (buffer under 300 limit)
        maxConcurrent: 5, // Max concurrent requests
        minTime: 250, // Minimum time between requests (ms) - 250ms = ~240 req/min max
        reservoir: 250, // Initial number of requests available
        reservoirRefreshAmount: 300 / 60, // add 5 tokens each interval
        reservoirRefreshInterval: 1000, // every 1 second
        reservoirIncreaseMaximum: 250,
    },
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

export class FootballService {
    private apiClient: FootballApi;
    private convexClient: ConvexHttpClient;

    // NEW: Bottleneck rate limiter for API calls
    private rateLimiter: Bottleneck;

    constructor(private logger: IngestionLogger) {
        this.apiClient = new FootballApi(
            {
                baseURL: API_CONFIG.BASE_URL,
                headers: {
                    'x-apisports-key': process.env.FOOTBALL_API_KEY,
                },
            },
            logger,
        );

        // Initialize Convex client for database operations
        this.convexClient = new ConvexHttpClient(process.env.CONVEX_CLOUD_URL!);

        // Initialize Bottleneck rate limiter
        this.rateLimiter = new Bottleneck(API_CONFIG.RATE_LIMIT);

        // Add event listeners for monitoring
        this.rateLimiter.on('failed', async (error, jobInfo) => {
            this.logger.error('Rate limiter job failed', {
                error: error.message,
                retryCount: jobInfo.retryCount,
                options: jobInfo.options,
            });
        });

        this.rateLimiter.on('retry', async (error, jobInfo) => {
            this.logger.warn('Rate limiter retrying job', {
                error,
                jobInfo,
            });
        });

        this.rateLimiter.on('depleted', async (empty) => {
            this.logger.warn('Rate limiter reservoir depleted', { empty });
        });

        this.rateLimiter.on('debug', async (message, data) => {
            this.logger.info('Rate limiter debug', { message, data });
        });
    }

    // NEW: Get current rate limiter status
    public getRateLimiterStatus(): {
        queued: number;
        running: number;
        executing: number;
        done?: number;
        counts: Bottleneck.Counts;
        isEmpty: boolean;
    } {
        const counts = this.rateLimiter.counts();
        return {
            queued: counts.QUEUED,
            running: counts.RUNNING,
            executing: counts.EXECUTING,
            done: counts.DONE,
            counts,
            isEmpty: this.rateLimiter.empty(),
        };
    }

    // Get current API usage from database
    private async getCurrentApiUsage(date?: string): Promise<{ totalCalls: number; date: string; provider: string }> {
        try {
            return await this.convexClient.query(api.usage_tracking.usageHandler.getApiUsage, {
                provider: API_CONFIG.PROVIDER_NAME,
                date,
            });
        } catch (error) {
            this.logger.warn('Failed to get API usage from database', { error: (error as Error).message });
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
            this.logger.error('Failed to log API call to database', {
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
            this.logger.warn('Approaching API limit', {
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

    // Enhanced retry with centralized error handling, logging, and Bottleneck rate limiting
    private async withRetry<T>(
        operation: () => Promise<T>,
        resource: string,
        params?: Record<string, any>,
        maxAttempts = RETRY_CONFIG.MAX_ATTEMPTS,
        baseDelay = RETRY_CONFIG.BASE_DELAY_MS,
    ): Promise<T> {
        // Check daily API limits before starting any operation
        await this.checkApiLimits();

        return this.rateLimiter.schedule({ priority: 5, weight: 1 }, async () => {
            let lastError: Error;
            const timer = new Timer();
            let statusCode = 0;
            let error: string | undefined;

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
                    this.logger.error(`Error calling ${resource}`, {
                        attempt,
                        maxAttempts,
                        err,
                    });
                    statusCode = err.response?.status || 0;
                    error = err.message || 'Unknown error';

                    // Don't retry on validation errors or 4xx client errors
                    if (error?.includes('validation') || statusCode < RETRY_CONFIG.SERVER_ERROR_THRESHOLD) {
                        throw err;
                    }

                    if (attempt === maxAttempts) {
                        this.logger.error(`Max retries exceeded for ${resource}`, {
                            attempts: maxAttempts,
                            finalError: error,
                        });
                        throw lastError;
                    }

                    const delay = baseDelay * Math.pow(2, attempt - 1);
                    this.logger.warn(`Retrying ${resource} after error`, {
                        attempt,
                        maxAttempts,
                        delayMs: delay,
                        error,
                    });

                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
            }

            throw lastError!;
        });
    }

    async getLeagues() {
        this.logger.info('Fetching leagues from API-Football');
        return this.withRetry(async () => {
            const response = await this.apiClient.leagues.leaguesList({});
            return response.response || [];
        }, RESOURCES.LEAGUES);
    }

    async getLeaguesByIds(leagueIds: number[], current: LeaguesListParams['current'] = 'true') {
        this.logger.info('Fetching leagues by IDs from API-Football', { leagueIds, count: leagueIds.length });

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

        this.logger.info(`Successfully fetched ${allLeagues.length} leagues from ${leagueIds.length} API calls`);

        return allLeagues;
    }

    async getTeamsByLeague(leagueId: string, season: string = '2025') {
        this.logger.info('Fetching teams', { leagueId, season });
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
        this.logger.info('Fetching players', { teamId });
        const params = { team: teamId };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.squadsList({
                    team: parseInt(teamId),
                });

                this.logger.info(`Response for squad ${teamId}`, { response });
                return response.response?.at(0)?.players || [];
            },
            RESOURCES.SQUADS,
            params,
        );
    }

    async getPlayerStats(playerId: string, season: string = '2025'): Promise<PlayerStatistics | null> {
        this.logger.info('Fetching player stats', { playerId, season });
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

    async getUsageStats(startDate: string, endDate: string) {
        try {
            return await this.convexClient.query(api.usage_tracking.usageHandler.getUsageStats, {
                provider: API_CONFIG.PROVIDER_NAME,
                startDate,
                endDate,
            });
        } catch (error) {
            this.logger.error('Failed to get usage stats', { error: (error as Error).message });
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
            this.logger.error('Failed to get API call history', { error: (error as Error).message });
            throw error;
        }
    }

    async getPlayersByIds(playerIds: number[]) {
        this.logger.info('Fetching detailed player data by IDs from API-Football', {
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

        this.logger.info(
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

    // NEW: Top Statistics Methods with Position Tracking
    async getTopScorers(leagueId: string, season: string = new Date().getFullYear().toString()) {
        await this.logger.info('Fetching top scorers', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.topscorersList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                return response.response || [];
            },
            'top-scorers',
            params,
        );
    }

    async getTopAssists(leagueId: string, season: string = new Date().getFullYear().toString()) {
        await this.logger.info('Fetching top assists', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.topassistsList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                return response.response || [];
            },
            'top-assists',
            params,
        );
    }

    async getTopYellowCards(leagueId: string, season: string = new Date().getFullYear().toString()) {
        await this.logger.info('Fetching top yellow cards', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.topyellowcardsList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                return response.response || [];
            },
            'top-yellow-cards',
            params,
        );
    }

    async getTopRedCards(leagueId: string, season: string = new Date().getFullYear().toString()) {
        await this.logger.info('Fetching top red cards', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.players.topredcardsList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                return response.response || [];
            },
            'top-red-cards',
            params,
        );
    }

    // NEW: Enhanced methods that store position data in player_stats_snapshots
    async getTopGoalsWithPositions(leagueId: string, season: string = new Date().getFullYear().toString()) {
        const topScorers = await this.getTopScorers(leagueId, season);
        const playersWithPositions = topScorers.map((playerStats, index) => ({
            ...playerStats,
            position: index + 1,
            leaguePosition: { [leagueId]: index + 1 },
        }));

        return playersWithPositions;
    }

    async getTopAssistsWithPositions(leagueId: string, season: string = new Date().getFullYear().toString()) {
        const topAssists = await this.getTopAssists(leagueId, season);
        const playersWithPositions = topAssists.map((playerStats, index) => ({
            ...playerStats,
            position: index + 1,
            leaguePosition: { [leagueId]: index + 1 },
        }));

        return playersWithPositions;
    }

    async getTopYellowCardsWithPositions(leagueId: string, season: string = new Date().getFullYear().toString()) {
        const topYellowCards = await this.getTopYellowCards(leagueId, season);
        const playersWithPositions = topYellowCards.map((playerStats, index) => ({
            ...playerStats,
            position: index + 1,
            leaguePosition: { [leagueId]: index + 1 },
        }));

        return playersWithPositions;
    }

    async getTopRedCardsWithPositions(leagueId: string, season: string = new Date().getFullYear().toString()) {
        const topRedCards = await this.getTopRedCards(leagueId, season);
        const playersWithPositions = topRedCards.map((playerStats, index) => ({
            ...playerStats,
            position: index + 1,
            leaguePosition: { [leagueId]: index + 1 },
        }));

        return playersWithPositions;
    }

    // NEW: Combined method to get all top statistics with positions for a league
    async getAllTopStatisticsWithPositions(leagueId: string, season: string = new Date().getFullYear().toString()) {
        this.logger.info('Fetching all top statistics with positions', { leagueId, season });

        const [topGoals, topAssists, topYellowCards, topRedCards] = await Promise.all([
            this.getTopGoalsWithPositions(leagueId, season),
            this.getTopAssistsWithPositions(leagueId, season),
            this.getTopYellowCardsWithPositions(leagueId, season),
            this.getTopRedCardsWithPositions(leagueId, season),
        ]);

        return {
            topGoals,
            topAssists,
            topYellowCards,
            topRedCards,
            summary: {
                leagueId,
                season,
                totalPlayers: new Set([
                    ...topGoals.map((p) => p.player?.id),
                    ...topAssists.map((p) => p.player?.id),
                    ...topYellowCards.map((p) => p.player?.id),
                    ...topRedCards.map((p) => p.player?.id),
                ]).size,
                updatedAt: new Date().toISOString(),
            },
        };
    }

    async getLeaguesStandings(leagueId: string, season: string = new Date().getFullYear().toString()) {
        this.logger.info('Fetching league standings', { leagueId, season });
        const params = { league: leagueId, season };
        return this.withRetry(
            async () => {
                const response = await this.apiClient.standings.standingsList({
                    league: parseInt(leagueId),
                    season: parseInt(season),
                });
                return response.response || [];
            },
            'league-standings',
            params,
        );
    }
}
