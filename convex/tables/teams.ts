import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const teamFields = {
    leagueId: v.id('leagues'),
    name: v.string(),
    shortName: v.optional(v.string()),
    crestUrl: v.optional(v.string()),
    provider: v.string(),
    providerTeamId: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
};

export const teamsTable = defineTable(teamFields)
    .index('by_league', ['leagueId'])
    .index('by_provider_team', ['provider', 'providerTeamId']);

export default teamsTable;
