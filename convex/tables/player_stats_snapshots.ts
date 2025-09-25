import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const playerStatsSnapshotsFields = {
    playerId: v.id('players'),
    leagueId: v.id('leagues'),
    teamId: v.id('teams'),
    season: v.string(),
    provider: v.string(),
    // denormalized info to avoid populate
    playerName: v.string(),
    playerPhotoUrl: v.optional(v.string()),
    teamName: v.string(),
    teamLogoUrl: v.optional(v.string()),
    // grouped stats (camelCase)
    games: v.optional(
        v.object({
            appearances: v.optional(v.number()),
            lineups: v.optional(v.number()),
            minutes: v.optional(v.number()),
            number: v.optional(v.number()),
            position: v.optional(v.string()),
            rating: v.optional(v.string()),
            captain: v.optional(v.boolean()),
        }),
    ),
    substitutes: v.optional(
        v.object({ in: v.optional(v.number()), out: v.optional(v.number()), bench: v.optional(v.number()) }),
    ),
    shots: v.optional(v.object({ total: v.optional(v.number()), onTarget: v.optional(v.number()) })),
    goals: v.optional(
        v.object({
            total: v.optional(v.number()),
            conceded: v.optional(v.number()),
            assists: v.optional(v.number()),
            saves: v.optional(v.number()),
        }),
    ),
    passes: v.optional(
        v.object({ total: v.optional(v.number()), key: v.optional(v.number()), accuracy: v.optional(v.number()) }),
    ),
    tackles: v.optional(
        v.object({
            total: v.optional(v.number()),
            blocks: v.optional(v.number()),
            interceptions: v.optional(v.number()),
        }),
    ),
    duels: v.optional(v.object({ total: v.optional(v.number()), won: v.optional(v.number()) })),
    dribbles: v.optional(
        v.object({ attempts: v.optional(v.number()), success: v.optional(v.number()), past: v.optional(v.number()) }),
    ),
    fouls: v.optional(v.object({ drawn: v.optional(v.number()), committed: v.optional(v.number()) })),
    cards: v.optional(
        v.object({ yellow: v.optional(v.number()), yellowRed: v.optional(v.number()), red: v.optional(v.number()) }),
    ),
    penalty: v.optional(
        v.object({
            won: v.optional(v.number()),
            committed: v.optional(v.number()),
            scored: v.optional(v.number()),
            missed: v.optional(v.number()),
            saved: v.optional(v.number()),
        }),
    ),
    // NEW: League position rankings for different statistics
    leaguePositions: v.optional(
        v.record(
            v.id('leagues'),
            v.object({
                goals: v.optional(v.number()), // Position in top scorers (1-based)
                assists: v.optional(v.number()), // Position in top assists (1-based)
                yellowCards: v.optional(v.number()), // Position in yellow cards (1-based)
                redCards: v.optional(v.number()), // Position in red cards (1-based)
            }),
        ),
    ),
    updatedAt: v.string(),
    createdAt: v.string(),
};

export const playerStatsSnapshotsTable = defineTable(playerStatsSnapshotsFields)
    .index('by_player_season', ['playerId', 'season'])
    .index('by_league_season', ['leagueId', 'season'])
    .index('by_team_season', ['teamId', 'season']);

export default playerStatsSnapshotsTable;
