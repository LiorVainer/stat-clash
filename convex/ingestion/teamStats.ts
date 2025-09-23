// filepath: convex/ingestion/teamStats.ts
'use node';

import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { internal } from '../_generated/api';
import { IngestionLogger } from '../logs/ingestion';
import { FootballService, StatisticsListData } from '../api/football';
import Bluebird from 'bluebird';
import { WithoutSystemFields } from 'convex/server';
import { Doc } from '../_generated/dataModel';

// Use detailed types from the codegen client
type ApiTeamStats = NonNullable<StatisticsListData['response']>;
type HomeAwayTotal = NonNullable<ApiTeamStats['clean_sheet']>;
type HomeAwayTotalStrings = NonNullable<NonNullable<NonNullable<ApiTeamStats['goals']>['for']>['average']>;
type ApiFixtures = NonNullable<ApiTeamStats['fixtures']>;
type ApiGoals = NonNullable<ApiTeamStats['goals']>;
type ApiBiggest = NonNullable<ApiTeamStats['biggest']>;
type ApiPenalty = NonNullable<ApiTeamStats['penalty']>;
type ApiCards = NonNullable<ApiTeamStats['cards']>;
type ApiLineups = ApiTeamStats['lineups'];

// Derive field types from the Convex Document for precise return types
type Snap = Doc<'team_stats_snapshots'>;

const toHomeAwayTotal = (v?: Partial<HomeAwayTotal>): Snap['cleanSheet'] =>
    v
        ? {
              home: v.home ?? undefined,
              away: v.away ?? undefined,
              total: v.total ?? undefined,
          }
        : undefined;

const toHomeAwayTotalStrings = (
    v?: Partial<HomeAwayTotalStrings>,
): NonNullable<NonNullable<Snap['goals']>['for']>['average'] =>
    v
        ? {
              home: v.home ?? undefined,
              away: v.away ?? undefined,
              total: v.total ?? undefined,
          }
        : undefined;

const mapFixtures = (fx?: Partial<ApiFixtures>): Snap['fixtures'] =>
    fx
        ? {
              played: toHomeAwayTotal(fx.played),
              wins: toHomeAwayTotal(fx.wins),
              draws: toHomeAwayTotal(fx.draws),
              loses: toHomeAwayTotal(fx.loses),
          }
        : undefined;

const mapGoals = (g?: Partial<ApiGoals>): Snap['goals'] =>
    g
        ? {
              for: g.for
                  ? {
                        total: toHomeAwayTotal(g.for.total),
                        average: toHomeAwayTotalStrings(g.for.average),
                    }
                  : undefined,
              against: g.against
                  ? {
                        total: toHomeAwayTotal(g.against.total),
                        average: toHomeAwayTotalStrings(g.against.average),
                    }
                  : undefined,
          }
        : undefined;

const mapBiggest = (b?: Partial<ApiBiggest>): Snap['biggest'] =>
    b
        ? {
              streak: b.streak
                  ? {
                        wins: b.streak.wins ?? undefined,
                        draws: b.streak.draws ?? undefined,
                        loses: b.streak.loses ?? undefined,
                    }
                  : undefined,
              wins: b.wins
                  ? {
                        home: b.wins.home ?? undefined,
                        away: b.wins.away ?? undefined,
                    }
                  : undefined,
              loses: b.loses
                  ? {
                        home: b.loses.home ?? undefined,
                        away: b.loses.away ?? undefined,
                    }
                  : undefined,
              goalsFor: b.goals
                  ? {
                        home: b.goals.for?.home ?? undefined,
                        away: b.goals.for?.away ?? undefined,
                    }
                  : undefined,
              goalsAgainst: b.goals
                  ? {
                        home: b.goals.against?.home ?? undefined,
                        away: b.goals.against?.away ?? undefined,
                    }
                  : undefined,
          }
        : undefined;

const mapCleanSheet = (cs?: Partial<HomeAwayTotal>): Snap['cleanSheet'] => toHomeAwayTotal(cs);
const mapFailedToScore = (fts?: Partial<HomeAwayTotal>): Snap['failedToScore'] => toHomeAwayTotal(fts);

const mapPenalty = (p?: Partial<ApiPenalty>): Snap['penalty'] =>
    p
        ? {
              scored: p.scored
                  ? {
                        total: p.scored.total ?? undefined,
                        percentage: p.scored.percentage ?? undefined,
                    }
                  : undefined,
              missed: p.missed
                  ? {
                        total: p.missed.total ?? undefined,
                        percentage: p.missed.percentage ?? undefined,
                    }
                  : undefined,
          }
        : undefined;

const mapCards = (cards?: Partial<ApiCards>): Snap['cards'] => {
    if (!cards) return undefined;
    const mapIntervals = (obj?: ApiCards['yellow']) => ({
        min_0_15: obj?.['0-15']?.total ?? undefined,
        min_16_30: obj?.['16-30']?.total ?? undefined,
        min_31_45: obj?.['31-45']?.total ?? undefined,
        min_46_60: obj?.['46-60']?.total ?? undefined,
        min_61_75: obj?.['61-75']?.total ?? undefined,
        min_76_90: obj?.['76-90']?.total ?? undefined,
        min_91_105: obj?.['91-105']?.total ?? undefined,
        min_106_120: obj?.['106-120']?.total ?? undefined,
    });
    return {
        yellow: cards.yellow ? mapIntervals(cards.yellow) : undefined,
        red: cards.red ? mapIntervals(cards.red) : undefined,
    };
};

const topLineup = (lineups?: ApiLineups): Snap['lineups'] => {
    const arr = lineups ?? [];
    const top = arr.reduce<{ formation?: string; played?: number }>(
        (max, l) => ((l.played ?? 0) > (max.played ?? 0) ? l : max),
        {},
    );
    return top.formation || top.played !== undefined ? { formation: top.formation, played: top.played } : undefined;
};

export const TeamStatsMappers = {
    toHomeAwayTotal,
    toHomeAwayTotalStrings,
    fixtures: mapFixtures,
    goals: mapGoals,
    biggest: mapBiggest,
    cleanSheet: mapCleanSheet,
    failedToScore: mapFailedToScore,
    penalty: mapPenalty,
    cards: mapCards,
    topLineup,
} as const;

export const ingestTeamStats = internalAction({
    args: {
        season: v.optional(v.string()),
        leagueId: v.optional(v.id('leagues')),
    },
    handler: async (ctx, { season, leagueId }) => {
        const logger = new IngestionLogger(ctx, 'ingest-team-stats');
        const football = new FootballService(logger);

        const resolvedSeason = season || new Date().getFullYear().toString();

        try {
            await logger.info('Starting team stats ingestion', { season: resolvedSeason, leagueId });

            // Determine leagues to process (avoid filter(Boolean) which widens types)
            let leagues: Doc<'leagues'>[] = [];
            if (leagueId) {
                const league = await ctx.runQuery(internal.services.leagues.getLeague, { leagueId });
                if (league) leagues = [league];
            } else {
                leagues = await ctx.runQuery(internal.services.leagues.getTopLeagues, {});
            }

            // For each league, fetch teams and ingest their stats
            await Bluebird.map(
                leagues,
                async (league) => {
                    if (!league) return;

                    await logger.info('Fetching teams for league', { league: league.name, season: resolvedSeason });
                    const teams = await ctx.runQuery(internal.services.teams.getTeamsByLeague, {
                        leagueId: league._id,
                    });

                    // Process teams with limited concurrency
                    await Bluebird.map(
                        teams,
                        async (team) => {
                            try {
                                // Fetch team statistics from API
                                const raw = await football.getTeamStats(
                                    team.providerTeamId,
                                    league.providerLeagueId,
                                    resolvedSeason,
                                );
                                if (!raw) return;

                                const payload: WithoutSystemFields<Doc<'team_stats_snapshots'>> = {
                                    teamId: team._id,
                                    leagueId: league._id,
                                    season: resolvedSeason,
                                    provider: 'api-football' as const,
                                    teamName: team.name,
                                    teamLogoUrl: team.crestUrl,
                                    leagueName: league.name,
                                    form: raw.form ?? undefined,
                                    fixtures: TeamStatsMappers.fixtures(raw.fixtures),
                                    goals: TeamStatsMappers.goals(raw.goals),
                                    biggest: TeamStatsMappers.biggest(raw.biggest),
                                    cleanSheet: TeamStatsMappers.cleanSheet(raw.clean_sheet),
                                    failedToScore: TeamStatsMappers.failedToScore(raw.failed_to_score),
                                    penalty: TeamStatsMappers.penalty(raw.penalty),
                                    cards: TeamStatsMappers.cards(raw.cards),
                                    lineups: TeamStatsMappers.topLineup(raw.lineups),
                                    updatedAt: new Date().toISOString(),
                                    createdAt: new Date().toISOString(),
                                };

                                // Upsert by team+season+provider
                                const existing = await ctx.runQuery(
                                    internal.services.teamStatsSnapshots.findTeamStatsByProvider,
                                    {
                                        teamId: team._id,
                                        season: resolvedSeason,
                                        provider: 'api-football',
                                    },
                                );

                                if (existing) {
                                    await ctx.runMutation(internal.services.teamStatsSnapshots.updateTeamStats, {
                                        statsId: existing._id,
                                        data: {
                                            ...payload,
                                            createdAt: existing.createdAt,
                                        },
                                    });
                                    await logger.info('Updated team stats snapshot', {
                                        team: team.name,
                                        league: league.name,
                                    });
                                } else {
                                    await ctx.runMutation(internal.services.teamStatsSnapshots.createTeamStats, {
                                        data: payload,
                                    });
                                    await logger.info('Created team stats snapshot', {
                                        team: team.name,
                                        league: league.name,
                                    });
                                }
                            } catch (err) {
                                await logger.error('Failed to ingest team stats', {
                                    team: team.name,
                                    league: league.name,
                                    error: (err as Error).message,
                                });
                            }
                        },
                        { concurrency: 5 },
                    );
                },
                { concurrency: 3 },
            );

            await logger.success('Team stats ingestion completed', { season: resolvedSeason });
            return { success: true } as const;
        } catch (error) {
            await logger.error('Team stats ingestion failed', { error: (error as Error).message });
            throw error;
        }
    },
});
