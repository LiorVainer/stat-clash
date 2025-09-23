import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const teamStatsSnapshotsFields = {
    teamId: v.id('teams'),
    leagueId: v.id('leagues'),
    season: v.string(),
    provider: v.string(),
    // denormalized
    teamName: v.string(),
    teamLogoUrl: v.optional(v.string()),
    leagueName: v.string(),
    form: v.optional(v.string()),
    fixtures: v.optional(
        v.object({
            played: v.optional(
                v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
            ),
            wins: v.optional(
                v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
            ),
            draws: v.optional(
                v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
            ),
            loses: v.optional(
                v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
            ),
        }),
    ),
    goals: v.optional(
        v.object({
            for: v.optional(
                v.object({
                    total: v.optional(
                        v.object({
                            home: v.optional(v.number()),
                            away: v.optional(v.number()),
                            total: v.optional(v.number()),
                        }),
                    ),
                    average: v.optional(
                        v.object({
                            home: v.optional(v.string()),
                            away: v.optional(v.string()),
                            total: v.optional(v.string()),
                        }),
                    ),
                }),
            ),
            against: v.optional(
                v.object({
                    total: v.optional(
                        v.object({
                            home: v.optional(v.number()),
                            away: v.optional(v.number()),
                            total: v.optional(v.number()),
                        }),
                    ),
                    average: v.optional(
                        v.object({
                            home: v.optional(v.string()),
                            away: v.optional(v.string()),
                            total: v.optional(v.string()),
                        }),
                    ),
                }),
            ),
        }),
    ),
    biggest: v.optional(
        v.object({
            streak: v.optional(
                v.object({
                    wins: v.optional(v.number()),
                    draws: v.optional(v.number()),
                    loses: v.optional(v.number()),
                }),
            ),
            wins: v.optional(v.object({ home: v.optional(v.string()), away: v.optional(v.string()) })),
            loses: v.optional(v.object({ home: v.optional(v.string()), away: v.optional(v.string()) })),
            goalsFor: v.optional(v.object({ home: v.optional(v.number()), away: v.optional(v.number()) })),
            goalsAgainst: v.optional(v.object({ home: v.optional(v.number()), away: v.optional(v.number()) })),
        }),
    ),
    cleanSheet: v.optional(
        v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
    ),
    failedToScore: v.optional(
        v.object({ home: v.optional(v.number()), away: v.optional(v.number()), total: v.optional(v.number()) }),
    ),
    penalty: v.optional(
        v.object({
            scored: v.optional(v.object({ total: v.optional(v.number()), percentage: v.optional(v.string()) })),
            missed: v.optional(v.object({ total: v.optional(v.number()), percentage: v.optional(v.string()) })),
        }),
    ),
    cards: v.optional(
        v.object({
            yellow: v.optional(
                v.object({
                    min_0_15: v.optional(v.number()),
                    min_16_30: v.optional(v.number()),
                    min_31_45: v.optional(v.number()),
                    min_46_60: v.optional(v.number()),
                    min_61_75: v.optional(v.number()),
                    min_76_90: v.optional(v.number()),
                    min_91_105: v.optional(v.number()),
                    min_106_120: v.optional(v.number()),
                }),
            ),
            red: v.optional(
                v.object({
                    min_0_15: v.optional(v.number()),
                    min_16_30: v.optional(v.number()),
                    min_31_45: v.optional(v.number()),
                    min_46_60: v.optional(v.number()),
                    min_61_75: v.optional(v.number()),
                    min_76_90: v.optional(v.number()),
                    min_91_105: v.optional(v.number()),
                    min_106_120: v.optional(v.number()),
                }),
            ),
        }),
    ),
    lineups: v.optional(v.object({ formation: v.optional(v.string()), played: v.optional(v.number()) })),
    updatedAt: v.string(),
    createdAt: v.string(),
};

export const teamStatsSnapshotsTable = defineTable(teamStatsSnapshotsFields)
    .index('by_team_season', ['teamId', 'season'])
    .index('by_league_season', ['leagueId', 'season']);

export default teamStatsSnapshotsTable;
