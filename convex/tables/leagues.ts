import { defineTable } from 'convex/server';
import { v } from 'convex/values';

export const leagueFields = {
    name: v.string(),
    code: v.optional(v.string()),
    season: v.string(),
    provider: v.string(),
    providerLeagueId: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
};

export const leaguesTable = defineTable(leagueFields).index('by_provider_league', ['provider', 'providerLeagueId']);

export default leaguesTable;
