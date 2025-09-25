import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const playerFields = {
    teamId: v.id('teams'),
    leagueId: v.id('leagues'),
    name: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    positionId: v.string(),
    nationality: v.optional(v.string()),
    photoUrl: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
    provider: v.string(),
    providerPlayerId: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
};

export const playersTable = defineTable(playerFields)
    .index('by_team', ['teamId'])
    .index('by_league', ['leagueId'])
    .index('by_provider_player', ['provider', 'providerPlayerId']);

export default playersTable;
