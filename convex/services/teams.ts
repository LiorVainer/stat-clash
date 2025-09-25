import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const getTeam = internalQuery({
    args: { teamId: v.id('teams') },
    handler: async (ctx, { teamId }): Promise<Doc<'teams'> | null> => ctx.db.get(teamId),
});

export const getTeamsByLeagueInDB = internalQuery({
    args: { leagueId: v.id('leagues'), limit: v.optional(v.number()) },
    handler: async (ctx, { leagueId, limit }): Promise<Doc<'teams'>[]> => {
        let q = ctx.db.query('teams').withIndex('by_league', (q) => q.eq('leagueId', leagueId));
        return limit ? q.take(limit) : q.collect();
    },
});

export const findTeamByProvider = internalQuery({
    args: { provider: v.string(), providerTeamId: v.string() },
    handler: async (ctx, { provider, providerTeamId }): Promise<Doc<'teams'> | null> =>
        ctx.db
            .query('teams')
            .withIndex('by_provider_team', (q) => q.eq('provider', provider).eq('providerTeamId', providerTeamId))
            .first(),
});

export const createTeam = internalMutation({
    args: { data: schema.tables.teams.validator },
    handler: async (ctx, { data }) => ctx.db.insert('teams', data),
});

export const updateTeam = internalMutation({
    args: { teamId: v.id('teams'), data: partial(schema.tables.teams.validator) },
    handler: async (ctx, { teamId, data }) => ctx.db.patch(teamId, data),
});

// Join query to get teams with their league information
export const getTeamsWithLeague = internalQuery({
    args: {
        limit: v.optional(v.number()),
        leagueName: v.optional(v.string()),
        teamName: v.optional(v.string()),
        teamProviderId: v.optional(v.string()),
        leagueProviderId: v.optional(v.string()),
        season: v.optional(v.string()),
    },
    handler: async (ctx, { limit = 50, leagueName, teamName, teamProviderId, leagueProviderId, season }) => {
        // Build the final query properly
        const finalQuery = limit
            ? ctx.db
                  .query('teams')
                  .order('desc')
                  .take(limit || 1000)
            : ctx.db.query('teams').collect();

        const teams = await finalQuery;

        // Fetch leagues in parallel for better performance
        const leagueIds = [...new Set(teams.map((t) => t.leagueId))];
        const leagues = await Promise.all(leagueIds.map((id) => ctx.db.get(id)));
        const leaguesMap = new Map(leagues.filter(Boolean).map((league) => [league!._id, league!]));

        // Join data and apply filters
        return teams
            .map((team) => {
                const league = leaguesMap.get(team.leagueId);

                return {
                    team,
                    league,
                    // Flattened fields for easier access
                    teamName: team.name,
                    leagueName: league?.name,
                    teamProviderId: team.providerTeamId,
                    leagueProviderId: league?.providerLeagueId,
                    season: league?.season,
                };
            })
            .filter((item) => {
                // Apply filters
                if (leagueName && !item.leagueName?.toLowerCase().includes(leagueName.toLowerCase())) return false;
                if (teamName && !item.teamName.toLowerCase().includes(teamName.toLowerCase())) return false;
                if (teamProviderId && item.teamProviderId !== teamProviderId) return false;
                if (leagueProviderId && item.leagueProviderId !== leagueProviderId) return false;
                if (season && item.season !== season) return false;

                return true;
            });
    },
});

// Get teams for a specific league with league info
export const getTeamsByLeagueWithLeagueInfo = internalQuery({
    args: {
        leagueId: v.id('leagues'),
        limit: v.optional(v.number()),
        includeLeagueInfo: v.optional(v.boolean()),
    },
    handler: async (ctx, { leagueId, limit, includeLeagueInfo = true }) => {
        let teamsQuery = ctx.db.query('teams').withIndex('by_league', (q) => q.eq('leagueId', leagueId));
        const teams = limit ? await teamsQuery.take(limit) : await teamsQuery.collect();

        if (!includeLeagueInfo) {
            return teams.map((team) => ({ team, league: null }));
        }

        const league = await ctx.db.get(leagueId);

        return teams.map((team) => ({
            team,
            league,
        }));
    },
});

// Search teams by name with league joins
export const searchTeamsWithLeague = internalQuery({
    args: {
        searchTerm: v.string(),
        limit: v.optional(v.number()),
        leagueId: v.optional(v.id('leagues')),
        season: v.optional(v.string()),
    },
    handler: async (ctx, { searchTerm, limit = 25, leagueId, season }) => {
        // Build the final query based on whether leagueId is provided
        const finalQuery = leagueId
            ? ctx.db.query('teams').withIndex('by_league', (q) => q.eq('leagueId', leagueId))
            : ctx.db.query('teams');

        const teams = await finalQuery.collect();

        // Filter by search term
        const filteredTeams = teams
            .filter((team) => {
                const matchesSearch = team.name.toLowerCase().includes(searchTerm.toLowerCase());
                return matchesSearch;
            })
            .slice(0, limit);

        // Get league info for filtered teams
        const leagueIds = [...new Set(filteredTeams.map((t) => t.leagueId))];
        const leagues = await Promise.all(leagueIds.map((id) => ctx.db.get(id)));
        const leaguesMap = new Map(leagues.filter(Boolean).map((league) => [league!._id, league!]));

        const results = filteredTeams.map((team) => {
            const league = leaguesMap.get(team.leagueId);

            return {
                team,
                league,
            };
        });

        // Apply season filter if provided
        if (season) {
            return results.filter((result) => result.league?.season === season);
        }

        return results;
    },
});

// Get team with detailed stats including player count
export const getTeamWithDetails = internalQuery({
    args: {
        teamId: v.id('teams'),
        includePlayerCount: v.optional(v.boolean()),
    },
    handler: async (ctx, { teamId, includePlayerCount = false }) => {
        const team = await ctx.db.get(teamId);
        if (!team) return null;

        const league = await ctx.db.get(team.leagueId);

        let playerCount = 0;
        if (includePlayerCount) {
            const players = await ctx.db
                .query('players')
                .withIndex('by_team', (q) => q.eq('teamId', teamId))
                .collect();
            playerCount = players.length;
        }

        return {
            team,
            league,
            playerCount: includePlayerCount ? playerCount : undefined,
        };
    },
});

// Get teams with player statistics
export const getTeamsWithPlayerStats = internalQuery({
    args: {
        leagueId: v.optional(v.id('leagues')),
        limit: v.optional(v.number()),
    },
    handler: async (ctx, { leagueId, limit = 50 }) => {
        // Build the query properly based on whether leagueId is provided
        const teams = leagueId
            ? await (limit
                  ? ctx.db
                        .query('teams')
                        .withIndex('by_league', (q) => q.eq('leagueId', leagueId))
                        .take(limit)
                  : ctx.db
                        .query('teams')
                        .withIndex('by_league', (q) => q.eq('leagueId', leagueId))
                        .collect())
            : await (limit ? ctx.db.query('teams').take(limit) : ctx.db.query('teams').collect());

        // Get league info and player counts in parallel
        const leagueIds = [...new Set(teams.map((t) => t.leagueId))];
        const leagues = await Promise.all(leagueIds.map((id) => ctx.db.get(id)));
        const leaguesMap = new Map(leagues.filter(Boolean).map((league) => [league!._id, league!]));

        // Get player counts for each team
        const teamPlayerCounts = await Promise.all(
            teams.map(async (team) => {
                const players = await ctx.db
                    .query('players')
                    .withIndex('by_team', (q) => q.eq('teamId', team._id))
                    .collect();
                return { teamId: team._id, playerCount: players.length };
            }),
        );
        const playerCountsMap = new Map(teamPlayerCounts.map((item) => [item.teamId, item.playerCount]));

        return teams.map((team) => ({
            team,
            league: leaguesMap.get(team.leagueId),
            playerCount: playerCountsMap.get(team._id) || 0,
        }));
    },
});
