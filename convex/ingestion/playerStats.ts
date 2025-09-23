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

        try {
            await logger.info('Starting player stats ingestion', { season: resolvedSeason, leagueId, teamId });

            // Determine teams to process

            if (teamId) {
                const team = await ctx.runQuery(internal.services.teams.getTeam, { teamId });
                if (team) {
                    teams = [team];
                    resolvedLeague = await ctx.runQuery(internal.services.leagues.getLeague, {
                        leagueId: team.leagueId,
                    });
                }
            } else if (leagueId) {
                resolvedLeague = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
                if (resolvedLeague) {
                    teams = await ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, { leagueId });
                }
            } else {
                const leagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});
                // Fetch teams for all leagues in parallel
                const allTeamsArrays = await Promise.all(
                    leagues.map((l) =>
                        ctx.runQuery(internal.services.teams.getTeamsByLeagueInDB, {
                            leagueId: l._id,
                        }),
                    ),
                );
                teams = allTeamsArrays.flat();
            }

            // For each team, fetch existing players and ingest stats
            await Bluebird.map(
                teams,
                async (team) => {
                    try {
                        const league =
                            resolvedLeague ||
                            (await ctx.runQuery(internal.services.leagues.getLeague, { leagueId: team.leagueId }));
                        if (!league) return;

                        const players = await ctx.runQuery(internal.services.players.getPlayersByTeamInDB, {
                            teamId: team._id,
                        });
                        if (!players.length) {
                            await logger.warn('No players found for team when ingesting stats (skipping)', {
                                team: team.name,
                                league: league.name,
                                teamId: team._id,
                            });
                            return;
                        }

                        await Bluebird.map(
                            players,
                            async (player) => {
                                try {
                                    const stats = await football.getPlayerStats(
                                        player.providerPlayerId,
                                        resolvedSeason,
                                    );

                                    if (!stats) return;

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
                                        await logger.info('Updated player stats snapshot', {
                                            player: player.name,
                                            team: team.name,
                                        });
                                    } else {
                                        await ctx.runMutation(
                                            internal.services.playerStatsSnapshots.createPlayerStats,
                                            {
                                                data: payload,
                                            },
                                        );
                                        await logger.info('Created player stats snapshot', {
                                            player: player.name,
                                            team: team.name,
                                        });
                                    }
                                } catch (error) {
                                    await logger.error('Failed to ingest player stats', {
                                        player: player.name,
                                        team: team.name,
                                        error,
                                    });
                                }
                            },
                            { concurrency: 8 },
                        );
                    } catch (err) {
                        await logger.error('Failed to process team for player stats', {
                            team: team?.name,
                            error: (err as Error).message,
                        });
                    }
                },
                { concurrency: 3 },
            );

            await logger.success('Player stats ingestion completed', { season: resolvedSeason, leagueId, teamId });
            return { success: true } as const;
        } catch (error) {
            await logger.error('Player stats ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
