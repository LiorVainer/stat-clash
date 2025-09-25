// filepath: convex/ingestion/playerStats.ts
'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { IngestionLogger } from '../logs/ingestion';
import { FootballService } from '../api/football';
import Bluebird from 'bluebird';
import { Doc } from '../_generated/dataModel';
import { WithoutSystemFields } from 'convex/server';

export const ingestPlayerStats = internalAction({
    args: {
        season: v.optional(v.string()),
        leagueId: v.optional(v.id('leagues')),
        teamId: v.optional(v.id('teams')),
    },
    handler: async (ctx, { season, leagueId, teamId }) => {
        const logger = new IngestionLogger(ctx, 'ingest-player-stats');
        const football = new FootballService(logger);

        const resolvedSeason = season || new Date().getFullYear().toString();
        let teams: Array<Doc<'teams'>> = [];
        let resolvedLeague: Doc<'leagues'> | null = null;

        // Track metrics for comprehensive debugging
        const metrics = {
            totalTeamsToProcess: 0,
            teamsProcessed: 0,
            teamsSkipped: 0,
            totalPlayersFound: 0,
            playersProcessed: 0,
            playersSkipped: 0,
            statsCreated: 0,
            statsUpdated: 0,
            apiCallsSuccessful: 0,
            apiCallsFailed: 0,
            errors: [] as Array<{ type: string; message: string; meta?: any }>,
        };

        try {
            logger.info('Starting player stats ingestion', {
                season: resolvedSeason,
                leagueId,
                teamId,
                timestamp: new Date().toISOString(),
                process: 'initialization',
            });

            // Determine teams to process with detailed logging
            if (teamId) {
                logger.info('Processing single team by teamId', { teamId, process: 'team-selection' });
                const team = await ctx.runQuery(internal.services.teams.getTeam, { teamId });
                if (team) {
                    teams = [team];
                    resolvedLeague = await ctx.runQuery(internal.services.leagues.getLeague, {
                        leagueId: team.leagueId,
                    });
                    logger.info('Single team found', {
                        teamName: team.name,
                        teamProviderId: team.providerTeamId,
                        leagueId: team.leagueId,
                        process: 'team-selection',
                    });
                } else {
                    logger.error('Team not found', { teamId, process: 'team-selection' });
                    throw new Error(`Team not found: ${teamId}`);
                }
            } else if (leagueId) {
                logger.info('Processing teams by leagueId', { leagueId, process: 'team-selection' });
                resolvedLeague = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
                if (resolvedLeague) {
                    teams = await ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, { leagueId });
                    logger.info('Teams found for league', {
                        leagueName: resolvedLeague.name,
                        leagueProviderId: resolvedLeague.providerLeagueId,
                        teamsCount: teams.length,
                        teamNames: teams.map((t) => t.name),
                        process: 'team-selection',
                    });
                } else {
                    logger.error('League not found', { leagueId, process: 'team-selection' });
                    throw new Error(`League not found: ${leagueId}`);
                }
            } else {
                logger.info('Processing all top leagues', { process: 'team-selection' });
                const leagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});
                logger.info('Top leagues found', {
                    leaguesCount: leagues.length,
                    leagueNames: leagues.map((l) => l.name),
                    process: 'team-selection',
                });

                // Fetch teams for all leagues in parallel with detailed tracking
                const allTeamsArrays = await Promise.all(
                    leagues.map(async (l) => {
                        const leagueTeams = await ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, {
                            leagueId: l._id,
                        });
                        logger.info('Teams found for league', {
                            leagueName: l.name,
                            leagueId: l._id,
                            teamsCount: leagueTeams.length,
                            teamNames: leagueTeams.map((t) => t.name),
                            process: 'team-selection',
                        });
                        return leagueTeams;
                    }),
                );
                teams = allTeamsArrays.flat();
            }

            metrics.totalTeamsToProcess = teams.length;
            logger.info('Teams selection completed', {
                totalTeamsToProcess: metrics.totalTeamsToProcess,
                process: 'team-selection-complete',
            });

            // For each team, fetch existing players and ingest stats
            await Bluebird.map(
                teams,
                async (team, teamIndex) => {
                    const teamStartTime = Date.now();
                    try {
                        logger.info(`Processing team ${teamIndex + 1}/${teams.length}`, {
                            teamName: team.name,
                            teamId: team._id,
                            teamProviderId: team.providerTeamId,
                            leagueId: team.leagueId,
                            process: 'team-processing',
                            teamIndex,
                            totalTeams: teams.length,
                        });

                        const league =
                            resolvedLeague ||
                            (await ctx.runQuery(internal.services.leagues.getLeague, { leagueId: team.leagueId }));
                        if (!league) {
                            const errorMsg = `League not found for team ${team.name}`;
                            metrics.errors.push({
                                type: 'league-not-found',
                                message: errorMsg,
                                meta: { teamName: team.name, teamId: team._id, leagueId: team.leagueId },
                            });
                            logger.error(errorMsg, {
                                teamName: team.name,
                                teamId: team._id,
                                leagueId: team.leagueId,
                                process: 'team-processing',
                            });
                            metrics.teamsSkipped++;
                            return;
                        }

                        const players: Doc<'players'>[] = await ctx.runQuery(
                            internal.services.players.getPlayersByTeamInDB,
                            {
                                teamId: team._id,
                            },
                        );

                        logger.info('Players found for team', {
                            teamName: team.name,
                            leagueName: league.name,
                            playersCount: players.length,
                            playerNames: players.map((p) => p.name),
                            process: 'player-discovery',
                        });

                        if (!players.length) {
                            const warnMsg = 'No players found for team when ingesting stats (skipping)';
                            metrics.errors.push({
                                type: 'no-players',
                                message: warnMsg,
                                meta: { teamName: team.name, teamId: team._id },
                            });
                            logger.warn(warnMsg, {
                                team: team.name,
                                league: league.name,
                                teamId: team._id,
                                process: 'player-discovery',
                            });
                            metrics.teamsSkipped++;
                            return;
                        }

                        metrics.totalPlayersFound += players.length;

                        await Bluebird.map(
                            players,
                            async (player, playerIndex) => {
                                const playerStartTime = Date.now();
                                try {
                                    logger.info(
                                        `Processing player ${playerIndex + 1}/${players.length} for team ${team.name}`,
                                        {
                                            playerName: player.name,
                                            playerId: player._id,
                                            playerProviderId: player.providerPlayerId,
                                            teamName: team.name,
                                            leagueName: league.name,
                                            process: 'player-processing',
                                            playerIndex,
                                            totalPlayersInTeam: players.length,
                                        },
                                    );

                                    const stats = await football.getPlayerStats(
                                        player.providerPlayerId,
                                        resolvedSeason,
                                    );

                                    if (!stats) {
                                        const warnMsg = 'No stats returned from API';
                                        metrics.errors.push({
                                            type: 'no-api-stats',
                                            message: warnMsg,
                                            meta: {
                                                playerName: player.name,
                                                providerPlayerId: player.providerPlayerId,
                                                season: resolvedSeason,
                                            },
                                        });
                                        logger.warn(warnMsg, {
                                            playerName: player.name,
                                            playerId: player._id,
                                            playerProviderId: player.providerPlayerId,
                                            season: resolvedSeason,
                                            process: 'api-call',
                                        });
                                        metrics.apiCallsFailed++;
                                        metrics.playersSkipped++;
                                        return;
                                    }

                                    metrics.apiCallsSuccessful++;
                                    logger.info('Stats received from API', {
                                        playerName: player.name,
                                        playerProviderId: player.providerPlayerId,
                                        season: resolvedSeason,
                                        hasGames: !!stats.games,
                                        hasGoals: !!stats.goals,
                                        hasAssists: !!stats.goals?.assists,
                                        appearances: stats.games?.appearences,
                                        process: 'api-response',
                                    });

                                    // ...existing code for payload creation...
                                    const payload: WithoutSystemFields<Doc<'player_stats_snapshots'>> = {
                                        playerId: player._id,
                                        leagueId: league._id,
                                        teamId: team._id,
                                        season: resolvedSeason,
                                        provider: 'api-football' as const,
                                        playerName: player.name,
                                        playerPhotoUrl: player.photoUrl,
                                        teamName: team.name,
                                        teamLogoUrl: team.crestUrl,
                                        games: stats.games
                                            ? {
                                                  appearances:
                                                      stats.games.appearences == null
                                                          ? undefined
                                                          : stats.games.appearences,
                                                  lineups:
                                                      stats.games.lineups == null ? undefined : stats.games.lineups,
                                                  minutes:
                                                      stats.games.minutes == null ? undefined : stats.games.minutes,
                                                  number: stats.games.number == null ? undefined : stats.games.number,
                                                  position:
                                                      stats.games.position == null ? undefined : stats.games.position,
                                                  rating: stats.games.rating == null ? undefined : stats.games.rating,
                                                  captain:
                                                      stats.games.captain == null ? undefined : stats.games.captain,
                                              }
                                            : undefined,
                                        substitutes: stats.substitutes
                                            ? {
                                                  in: stats.substitutes.in == null ? undefined : stats.substitutes.in,
                                                  out:
                                                      stats.substitutes.out == null ? undefined : stats.substitutes.out,
                                                  bench:
                                                      stats.substitutes.bench == null
                                                          ? undefined
                                                          : stats.substitutes.bench,
                                              }
                                            : undefined,
                                        shots: stats.shots
                                            ? {
                                                  total: stats.shots.total == null ? undefined : stats.shots.total,
                                                  onTarget: stats.shots.on == null ? undefined : stats.shots.on,
                                              }
                                            : undefined,
                                        goals: stats.goals
                                            ? {
                                                  total: stats.goals.total == null ? undefined : stats.goals.total,
                                                  conceded:
                                                      stats.goals.conceded == null ? undefined : stats.goals.conceded,
                                                  assists:
                                                      stats.goals.assists == null ? undefined : stats.goals.assists,
                                                  saves: stats.goals.saves == null ? undefined : stats.goals.saves,
                                              }
                                            : undefined,
                                        passes: stats.passes
                                            ? {
                                                  total: stats.passes.total == null ? undefined : stats.passes.total,
                                                  key: stats.passes.key == null ? undefined : stats.passes.key,
                                                  accuracy:
                                                      stats.passes.accuracy == null ? undefined : stats.passes.accuracy,
                                              }
                                            : undefined,
                                        tackles: stats.tackles
                                            ? {
                                                  total: stats.tackles.total == null ? undefined : stats.tackles.total,
                                                  blocks:
                                                      stats.tackles.blocks == null ? undefined : stats.tackles.blocks,
                                                  interceptions:
                                                      stats.tackles.interceptions == null
                                                          ? undefined
                                                          : stats.tackles.interceptions,
                                              }
                                            : undefined,
                                        duels: stats.duels
                                            ? {
                                                  total: stats.duels.total == null ? undefined : stats.duels.total,
                                                  won: stats.duels.won == null ? undefined : stats.duels.won,
                                              }
                                            : undefined,
                                        dribbles: stats.dribbles
                                            ? {
                                                  attempts:
                                                      stats.dribbles.attempts == null
                                                          ? undefined
                                                          : stats.dribbles.attempts,
                                                  success:
                                                      stats.dribbles.success == null
                                                          ? undefined
                                                          : stats.dribbles.success,
                                                  past: stats.dribbles.past == null ? undefined : stats.dribbles.past,
                                              }
                                            : undefined,
                                        fouls: stats.fouls
                                            ? {
                                                  drawn: stats.fouls.drawn == null ? undefined : stats.fouls.drawn,
                                                  committed:
                                                      stats.fouls.committed == null ? undefined : stats.fouls.committed,
                                              }
                                            : undefined,
                                        cards: stats.cards
                                            ? {
                                                  yellow: stats.cards.yellow == null ? undefined : stats.cards.yellow,
                                                  yellowRed:
                                                      stats.cards.yellowred == null ? undefined : stats.cards.yellowred,
                                                  red: stats.cards.red == null ? undefined : stats.cards.red,
                                              }
                                            : undefined,
                                        penalty: stats.penalty
                                            ? {
                                                  won: stats.penalty.won == null ? undefined : stats.penalty.won,
                                                  committed:
                                                      stats.penalty.commited == null
                                                          ? undefined
                                                          : stats.penalty.commited,
                                                  scored:
                                                      stats.penalty.scored == null ? undefined : stats.penalty.scored,
                                                  missed:
                                                      stats.penalty.missed == null ? undefined : stats.penalty.missed,
                                                  saved: stats.penalty.saved == null ? undefined : stats.penalty.saved,
                                              }
                                            : undefined,
                                        updatedAt: new Date().toISOString(),
                                        createdAt: new Date().toISOString(),
                                    };

                                    const existing = await ctx.runQuery(
                                        internal.services.playerStatsSnapshots.findPlayerStatsByProvider,
                                        {
                                            playerId: player._id,
                                            season: resolvedSeason,
                                            provider: 'api-football',
                                        },
                                    );

                                    if (existing) {
                                        await ctx.runMutation(
                                            internal.services.playerStatsSnapshots.updatePlayerStats,
                                            {
                                                statsId: existing._id,
                                                data: { ...payload, createdAt: existing.createdAt },
                                            },
                                        );
                                        metrics.statsUpdated++;
                                        logger.info('Updated player stats snapshot', {
                                            player: player.name,
                                            team: team.name,
                                            league: league.name,
                                            existingStatsId: existing._id,
                                            season: resolvedSeason,
                                            processingTimeMs: Date.now() - playerStartTime,
                                            process: 'database-update',
                                        });
                                    } else {
                                        await ctx.runMutation(
                                            internal.services.playerStatsSnapshots.createPlayerStats,
                                            {
                                                data: payload,
                                            },
                                        );
                                        metrics.statsCreated++;
                                        logger.info('Created player stats snapshot', {
                                            player: player.name,
                                            team: team.name,
                                            league: league.name,
                                            season: resolvedSeason,
                                            processingTimeMs: Date.now() - playerStartTime,
                                            process: 'database-create',
                                        });
                                    }

                                    metrics.playersProcessed++;
                                } catch (error) {
                                    const errorMsg = (error as Error).message;
                                    metrics.errors.push({
                                        type: 'player-processing-error',
                                        message: errorMsg,
                                        meta: { playerName: player.name, teamName: team.name },
                                    });
                                    logger.error('Failed to ingest player stats', {
                                        player: player.name,
                                        team: team.name,
                                        league: league.name,
                                        error: errorMsg,
                                        errorStack: (error as Error).stack,
                                        processingTimeMs: Date.now() - playerStartTime,
                                        process: 'player-error',
                                    });
                                    metrics.playersSkipped++;
                                }
                            },
                            { concurrency: 8 },
                        );

                        metrics.teamsProcessed++;
                        logger.info(`Completed team processing`, {
                            teamName: team.name,
                            playersInTeam: players.length,
                            teamProcessingTimeMs: Date.now() - teamStartTime,
                            process: 'team-complete',
                        });
                    } catch (err) {
                        const errorMsg = (err as Error).message;
                        metrics.errors.push({
                            type: 'team-processing-error',
                            message: errorMsg,
                            meta: { teamName: team?.name },
                        });
                        logger.error('Failed to process team for player stats', {
                            team: team?.name,
                            teamId: team?._id,
                            error: errorMsg,
                            errorStack: (err as Error).stack,
                            teamProcessingTimeMs: Date.now() - teamStartTime,
                            process: 'team-error',
                        });
                        metrics.teamsSkipped++;
                    }
                },
                { concurrency: 3 },
            );

            // Final comprehensive summary
            logger.success('Player stats ingestion completed', {
                season: resolvedSeason,
                leagueId,
                teamId,
                metrics: {
                    totalTeamsToProcess: metrics.totalTeamsToProcess,
                    teamsProcessed: metrics.teamsProcessed,
                    teamsSkipped: metrics.teamsSkipped,
                    totalPlayersFound: metrics.totalPlayersFound,
                    playersProcessed: metrics.playersProcessed,
                    playersSkipped: metrics.playersSkipped,
                    statsCreated: metrics.statsCreated,
                    statsUpdated: metrics.statsUpdated,
                    apiCallsSuccessful: metrics.apiCallsSuccessful,
                    apiCallsFailed: metrics.apiCallsFailed,
                    totalErrors: metrics.errors.length,
                    successRate:
                        metrics.totalPlayersFound > 0
                            ? ((metrics.playersProcessed / metrics.totalPlayersFound) * 100).toFixed(2) + '%'
                            : '0%',
                },
                errorSummary: metrics.errors.reduce(
                    (acc, error) => {
                        acc[error.type] = (acc[error.type] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>,
                ),
                process: 'final-summary',
            });

            // Log problematic teams if any
            if (metrics.teamsSkipped > 0) {
                logger.warn('Some teams were skipped during processing', {
                    teamsSkipped: metrics.teamsSkipped,
                    totalTeams: metrics.totalTeamsToProcess,
                    skipRate: ((metrics.teamsSkipped / metrics.totalTeamsToProcess) * 100).toFixed(2) + '%',
                    process: 'teams-skipped-summary',
                });
            }

            return { success: true, metrics } as const;
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error('Player stats ingestion failed', {
                error: errorMsg,
                errorStack: (error as Error).stack,
                season: resolvedSeason,
                leagueId,
                teamId,
                metrics,
                process: 'fatal-error',
            });
            throw error;
        }
    },
});

export const ingestLeagueTopStatistics = internalAction({
    args: {
        season: v.optional(v.string()),
        leagueId: v.optional(v.id('leagues')),
    },
    handler: async (ctx, { season, leagueId }) => {
        const logger = new IngestionLogger(ctx, 'ingest-league-top-statistics');
        const football = new FootballService(logger);

        const resolvedSeason = season || new Date().getFullYear().toString();
        let leagues: Array<Doc<'leagues'>> = [];

        // Track metrics for comprehensive debugging
        const metrics = {
            totalLeaguesToProcess: 0,
            leaguesProcessed: 0,
            leaguesSkipped: 0,
            totalPlayersUpdated: 0,
            goalsPositionsUpdated: 0,
            assistsPositionsUpdated: 0,
            yellowCardsPositionsUpdated: 0,
            redCardsPositionsUpdated: 0,
            apiCallsSuccessful: 0,
            apiCallsFailed: 0,
            errors: [] as Array<{ type: string; message: string; meta?: any }>,
        };

        try {
            logger.info('Starting league top statistics ingestion', {
                season: resolvedSeason,
                leagueId,
                timestamp: new Date().toISOString(),
                process: 'initialization',
            });

            // Determine leagues to process with detailed logging
            if (leagueId) {
                logger.info('Processing single league by leagueId', { leagueId, process: 'league-selection' });
                const league = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
                if (league) {
                    leagues = [league];
                    logger.info('Single league found', {
                        leagueName: league.name,
                        leagueProviderId: league.providerLeagueId,
                        process: 'league-selection',
                    });
                } else {
                    logger.error('League not found', { leagueId, process: 'league-selection' });
                    throw new Error(`League not found: ${leagueId}`);
                }
            } else {
                logger.info('Processing all top leagues', { process: 'league-selection' });
                leagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});
                logger.info('Top leagues found', {
                    leaguesCount: leagues.length,
                    leagueNames: leagues.map((l) => l.name),
                    process: 'league-selection',
                });
            }

            metrics.totalLeaguesToProcess = leagues.length;
            logger.info('League selection completed', {
                totalLeaguesToProcess: metrics.totalLeaguesToProcess,
                process: 'league-selection-complete',
            });

            // Process each league
            await Bluebird.map(
                leagues,
                async (league, leagueIndex) => {
                    const leagueStartTime = Date.now();
                    try {
                        logger.info(`Processing league ${leagueIndex + 1}/${leagues.length}`, {
                            leagueName: league.name,
                            leagueId: league._id,
                            leagueProviderId: league.providerLeagueId,
                            process: 'league-processing',
                            leagueIndex,
                            totalLeagues: leagues.length,
                        });

                        // Get all top statistics with positions from FootballService
                        const topStats = await football.getAllTopStatisticsWithPositions(
                            league.providerLeagueId.toString(),
                            resolvedSeason,
                        );

                        metrics.apiCallsSuccessful += 4; // getAllTopStatisticsWithPositions makes 4 API calls

                        logger.info('Top statistics retrieved from API', {
                            leagueName: league.name,
                            season: resolvedSeason,
                            topGoalsCount: topStats.topGoals.length,
                            topAssistsCount: topStats.topAssists.length,
                            topYellowCardsCount: topStats.topYellowCards.length,
                            topRedCardsCount: topStats.topRedCards.length,
                            totalPlayers: topStats.summary.totalPlayers,
                            process: 'api-response',
                        });

                        // Process top goals
                        await Bluebird.map(
                            topStats.topGoals,
                            async (playerStat, position) => {
                                try {
                                    const providerId = playerStat.player?.id?.toString();
                                    if (!providerId) {
                                        logger.warn('Player ID missing in top goals data', {
                                            playerStat,
                                            position: position + 1,
                                            process: 'goals-processing',
                                        });
                                        return;
                                    }

                                    // Find player in database by provider ID
                                    const player = await ctx.runQuery(internal.services.players.getPlayerByProviderId, {
                                        providerPlayerId: providerId,
                                    });

                                    if (!player) {
                                        logger.warn('Player not found in database for goals position', {
                                            providerPlayerId: providerId,
                                            playerName: playerStat.player?.name,
                                            position: position + 1,
                                            process: 'goals-processing',
                                        });
                                        return;
                                    }

                                    // Update player stats with goals position
                                    await ctx.runMutation(
                                        internal.services.playerStatsSnapshots.updatePlayerStatsWithPositions,
                                        {
                                            playerId: player._id,
                                            leagueId: league._id,
                                            season: resolvedSeason,
                                            data: {
                                                leaguePositions: {
                                                    [league._id]: {
                                                        goals: position + 1,
                                                    },
                                                },
                                            },
                                        },
                                    );

                                    metrics.goalsPositionsUpdated++;
                                    logger.info('Updated goals position', {
                                        playerName: player.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        goals: playerStat.statistics?.[0]?.goals?.total || 0,
                                        process: 'goals-update',
                                    });
                                } catch (error) {
                                    const errorMsg = (error as Error).message;
                                    metrics.errors.push({
                                        type: 'goals-position-error',
                                        message: errorMsg,
                                        meta: {
                                            playerName: playerStat.player?.name,
                                            leagueName: league.name,
                                            position: position + 1,
                                        },
                                    });
                                    logger.error('Failed to update goals position', {
                                        error: errorMsg,
                                        playerName: playerStat.player?.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        process: 'goals-error',
                                    });
                                }
                            },
                            { concurrency: 5 },
                        );

                        // Process top assists
                        await Bluebird.map(
                            topStats.topAssists,
                            async (playerStat, position) => {
                                try {
                                    const providerId = playerStat.player?.id?.toString();
                                    if (!providerId) {
                                        logger.warn('Player ID missing in top assists data', {
                                            playerStat,
                                            position: position + 1,
                                            process: 'assists-processing',
                                        });
                                        return;
                                    }

                                    // Find player in database by provider ID
                                    const player = await ctx.runQuery(internal.services.players.getPlayerByProviderId, {
                                        providerPlayerId: providerId,
                                    });

                                    if (!player) {
                                        logger.warn('Player not found in database for assists position', {
                                            providerPlayerId: providerId,
                                            playerName: playerStat.player?.name,
                                            position: position + 1,
                                            process: 'assists-processing',
                                        });
                                        return;
                                    }

                                    // Update player stats with assists position
                                    await ctx.runMutation(
                                        internal.services.playerStatsSnapshots.updatePlayerStatsWithPositions,
                                        {
                                            playerId: player._id,
                                            leagueId: league._id,
                                            season: resolvedSeason,
                                            data: {
                                                leaguePositions: {
                                                    [league._id]: {
                                                        assists: position + 1,
                                                    },
                                                },
                                            },
                                        },
                                    );

                                    metrics.assistsPositionsUpdated++;
                                    logger.info('Updated assists position', {
                                        playerName: player.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        assists: playerStat.statistics?.[0]?.goals?.assists || 0,
                                        process: 'assists-update',
                                    });
                                } catch (error) {
                                    const errorMsg = (error as Error).message;
                                    metrics.errors.push({
                                        type: 'assists-position-error',
                                        message: errorMsg,
                                        meta: {
                                            playerName: playerStat.player?.name,
                                            leagueName: league.name,
                                            position: position + 1,
                                        },
                                    });
                                    logger.error('Failed to update assists position', {
                                        error: errorMsg,
                                        playerName: playerStat.player?.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        process: 'assists-error',
                                    });
                                }
                            },
                            { concurrency: 5 },
                        );

                        // Process top yellow cards
                        await Bluebird.map(
                            topStats.topYellowCards,
                            async (playerStat, position) => {
                                try {
                                    const providerId = playerStat.player?.id?.toString();
                                    if (!providerId) {
                                        logger.warn('Player ID missing in top yellow cards data', {
                                            playerStat,
                                            position: position + 1,
                                            process: 'yellow-cards-processing',
                                        });
                                        return;
                                    }

                                    // Find player in database by provider ID
                                    const player = await ctx.runQuery(internal.services.players.getPlayerByProviderId, {
                                        providerPlayerId: providerId,
                                    });

                                    if (!player) {
                                        logger.warn('Player not found in database for yellow cards position', {
                                            providerPlayerId: providerId,
                                            playerName: playerStat.player?.name,
                                            position: position + 1,
                                            process: 'yellow-cards-processing',
                                        });
                                        return;
                                    }

                                    // Update player stats with yellow cards position
                                    await ctx.runMutation(
                                        internal.services.playerStatsSnapshots.updatePlayerStatsWithPositions,
                                        {
                                            playerId: player._id,
                                            leagueId: league._id,
                                            season: resolvedSeason,
                                            data: {
                                                leaguePositions: {
                                                    [league._id]: {
                                                        yellowCards: position + 1,
                                                    },
                                                },
                                            },
                                        },
                                    );

                                    metrics.yellowCardsPositionsUpdated++;
                                    logger.info('Updated yellow cards position', {
                                        playerName: player.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        yellowCards: playerStat.statistics?.[0]?.cards?.yellow || 0,
                                        process: 'yellow-cards-update',
                                    });
                                } catch (error) {
                                    const errorMsg = (error as Error).message;
                                    metrics.errors.push({
                                        type: 'yellow-cards-position-error',
                                        message: errorMsg,
                                        meta: {
                                            playerName: playerStat.player?.name,
                                            leagueName: league.name,
                                            position: position + 1,
                                        },
                                    });
                                    logger.error('Failed to update yellow cards position', {
                                        error: errorMsg,
                                        playerName: playerStat.player?.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        process: 'yellow-cards-error',
                                    });
                                }
                            },
                            { concurrency: 5 },
                        );

                        // Process top red cards
                        await Bluebird.map(
                            topStats.topRedCards,
                            async (playerStat, position) => {
                                try {
                                    const providerId = playerStat.player?.id?.toString();
                                    if (!providerId) {
                                        logger.warn('Player ID missing in top red cards data', {
                                            playerStat,
                                            position: position + 1,
                                            process: 'red-cards-processing',
                                        });
                                        return;
                                    }

                                    // Find player in database by provider ID
                                    const player = await ctx.runQuery(internal.services.players.getPlayerByProviderId, {
                                        providerPlayerId: providerId,
                                    });

                                    if (!player) {
                                        logger.warn('Player not found in database for red cards position', {
                                            providerPlayerId: providerId,
                                            playerName: playerStat.player?.name,
                                            position: position + 1,
                                            process: 'red-cards-processing',
                                        });
                                        return;
                                    }

                                    // Update player stats with red cards position
                                    await ctx.runMutation(
                                        internal.services.playerStatsSnapshots.updatePlayerStatsWithPositions,
                                        {
                                            playerId: player._id,
                                            leagueId: league._id,
                                            season: resolvedSeason,
                                            data: {
                                                leaguePositions: {
                                                    [league._id]: {
                                                        redCards: position + 1,
                                                    },
                                                },
                                            },
                                        },
                                    );

                                    metrics.redCardsPositionsUpdated++;
                                    logger.info('Updated red cards position', {
                                        playerName: player.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        redCards: playerStat.statistics?.[0]?.cards?.red || 0,
                                        process: 'red-cards-update',
                                    });
                                } catch (error) {
                                    const errorMsg = (error as Error).message;
                                    metrics.errors.push({
                                        type: 'red-cards-position-error',
                                        message: errorMsg,
                                        meta: {
                                            playerName: playerStat.player?.name,
                                            leagueName: league.name,
                                            position: position + 1,
                                        },
                                    });
                                    logger.error('Failed to update red cards position', {
                                        error: errorMsg,
                                        playerName: playerStat.player?.name,
                                        leagueName: league.name,
                                        position: position + 1,
                                        process: 'red-cards-error',
                                    });
                                }
                            },
                            { concurrency: 5 },
                        );

                        metrics.totalPlayersUpdated +=
                            topStats.topGoals.length +
                            topStats.topAssists.length +
                            topStats.topYellowCards.length +
                            topStats.topRedCards.length;

                        metrics.leaguesProcessed++;
                        logger.info(`Completed league processing`, {
                            leagueName: league.name,
                            goalsPositionsUpdated: topStats.topGoals.length,
                            assistsPositionsUpdated: topStats.topAssists.length,
                            yellowCardsPositionsUpdated: topStats.topYellowCards.length,
                            redCardsPositionsUpdated: topStats.topRedCards.length,
                            leagueProcessingTimeMs: Date.now() - leagueStartTime,
                            process: 'league-complete',
                        });
                    } catch (err) {
                        const errorMsg = (err as Error).message;
                        metrics.errors.push({
                            type: 'league-processing-error',
                            message: errorMsg,
                            meta: { leagueName: league?.name },
                        });
                        logger.error('Failed to process league for top statistics', {
                            league: league?.name,
                            leagueId: league?._id,
                            error: errorMsg,
                            errorStack: (err as Error).stack,
                            leagueProcessingTimeMs: Date.now() - leagueStartTime,
                            process: 'league-error',
                        });
                        metrics.leaguesSkipped++;
                        metrics.apiCallsFailed += 4; // Assume all 4 API calls failed
                    }
                },
                { concurrency: 2 }, // Process 2 leagues concurrently
            );

            // Final comprehensive summary
            logger.success('League top statistics ingestion completed', {
                season: resolvedSeason,
                leagueId,
                metrics: {
                    totalLeaguesToProcess: metrics.totalLeaguesToProcess,
                    leaguesProcessed: metrics.leaguesProcessed,
                    leaguesSkipped: metrics.leaguesSkipped,
                    totalPlayersUpdated: metrics.totalPlayersUpdated,
                    goalsPositionsUpdated: metrics.goalsPositionsUpdated,
                    assistsPositionsUpdated: metrics.assistsPositionsUpdated,
                    yellowCardsPositionsUpdated: metrics.yellowCardsPositionsUpdated,
                    redCardsPositionsUpdated: metrics.redCardsPositionsUpdated,
                    apiCallsSuccessful: metrics.apiCallsSuccessful,
                    apiCallsFailed: metrics.apiCallsFailed,
                    totalErrors: metrics.errors.length,
                    successRate:
                        metrics.totalLeaguesToProcess > 0
                            ? ((metrics.leaguesProcessed / metrics.totalLeaguesToProcess) * 100).toFixed(2) + '%'
                            : '0%',
                },
                errorSummary: metrics.errors.reduce(
                    (acc, error) => {
                        acc[error.type] = (acc[error.type] || 0) + 1;
                        return acc;
                    },
                    {} as Record<string, number>,
                ),
                process: 'final-summary',
            });

            // Log problematic leagues if any
            if (metrics.leaguesSkipped > 0) {
                logger.warn('Some leagues were skipped during processing', {
                    leaguesSkipped: metrics.leaguesSkipped,
                    totalLeagues: metrics.totalLeaguesToProcess,
                    skipRate: ((metrics.leaguesSkipped / metrics.totalLeaguesToProcess) * 100).toFixed(2) + '%',
                    process: 'leagues-skipped-summary',
                });
            }

            return { success: true, metrics } as const;
        } catch (error) {
            const errorMsg = (error as Error).message;
            logger.error('League top statistics ingestion failed', {
                error: errorMsg,
                errorStack: (error as Error).stack,
                season: resolvedSeason,
                leagueId,
                metrics,
                process: 'fatal-error',
            });
            throw error;
        }
    },
});
