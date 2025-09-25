import { internalMutation, internalQuery } from '../_generated/server';
import { v } from 'convex/values';
import { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { partial } from 'convex-helpers/validators';

export const findPlayerByProvider = internalQuery({
    args: { provider: v.string(), providerPlayerId: v.string() },
    handler: async (ctx, { provider, providerPlayerId }): Promise<Doc<'players'> | null> =>
        ctx.db
            .query('players')
            .withIndex('by_provider_player', (q) => q.eq('provider', provider).eq('providerPlayerId', providerPlayerId))
            .first(),
});

export const createPlayer = internalMutation({
    args: { data: schema.tables.players.validator },
    handler: async (ctx, { data }) => ctx.db.insert('players', data),
});

export const updatePlayer = internalMutation({
    args: { playerId: v.id('players'), data: partial(schema.tables.players.validator) },
    handler: async (ctx, { playerId, data }) => ctx.db.patch(playerId, data),
});

export const getPlayersByTeamInDB = internalQuery({
    args: { teamId: v.id('teams') },
    handler: async (ctx, { teamId }): Promise<Doc<'players'>[]> =>
        ctx.db
            .query('players')
            .withIndex('by_team', (q) => q.eq('teamId', teamId))
            .collect(),
});

// Join query to get players with their team and league information
export const getPlayersWithTeamAndLeague = internalQuery({
    args: {
        limit: v.optional(v.number()),
        teamName: v.optional(v.string()),
        teamProviderId: v.optional(v.string()),
        leagueName: v.optional(v.string()),
        playerName: v.optional(v.string()),
        positionId: v.optional(v.id('positions')),
    },
    handler: async (ctx, { limit = 50, teamName, teamProviderId, leagueName, playerName, positionId }) => {
        // Build the final query properly
        const players = limit
            ? await ctx.db
                  .query('players')
                  .order('desc')
                  .take(limit || 1000)
            : await ctx.db.query('players').collect();

        // Fetch teams and leagues in parallel for better performance
        const teamIds = [...new Set(players.map((p) => p.teamId))];
        const teams = await Promise.all(teamIds.map((id) => ctx.db.get(id)));
        const teamsMap = new Map(teams.filter(Boolean).map((team) => [team!._id, team!]));

        const leagueIds = [...new Set(teams.filter(Boolean).map((t) => t!.leagueId))];
        const leagues = await Promise.all(leagueIds.map((id) => ctx.db.get(id)));
        const leaguesMap = new Map(leagues.filter(Boolean).map((league) => [league!._id, league!]));

        // Join data and apply filters
        return players
            .map((player) => {
                const team = teamsMap.get(player.teamId);
                const league = team ? leaguesMap.get(team.leagueId) : null;

                return {
                    player,
                    team,
                    league,
                    // Flattened fields for easier access
                    playerName: player.name,
                    teamName: team?.name,
                    leagueName: league?.name,
                    positionId: player.positionId,
                    teamProviderId: team?.providerTeamId,
                };
            })
            .filter((item) => {
                // Apply filters
                if (teamName && !item.teamName?.toLowerCase().includes(teamName.toLowerCase())) return false;
                if (teamProviderId && item.teamProviderId !== teamProviderId) return false;
                if (leagueName && !item.leagueName?.toLowerCase().includes(leagueName.toLowerCase())) return false;
                if (playerName && !item.playerName.toLowerCase().includes(playerName.toLowerCase())) return false;
                if (positionId && item.positionId !== positionId) return false;

                return true;
            });
    },
});

// Get players for a specific team with team and league info
export const getPlayersByTeamWithJoins = internalQuery({
    args: {
        teamId: v.id('teams'),
        includeTeamInfo: v.optional(v.boolean()),
        includeLeagueInfo: v.optional(v.boolean()),
    },
    handler: async (ctx, { teamId, includeTeamInfo = true, includeLeagueInfo = true }) => {
        const players = await ctx.db
            .query('players')
            .withIndex('by_team', (q) => q.eq('teamId', teamId))
            .collect();

        if (!includeTeamInfo && !includeLeagueInfo) {
            return players.map((player) => ({ player, team: null, league: null }));
        }

        const team = includeTeamInfo ? await ctx.db.get(teamId) : null;
        const league = includeLeagueInfo && team ? await ctx.db.get(team.leagueId) : null;

        return players.map((player) => ({
            player,
            team,
            league,
        }));
    },
});

// Search players by name with team and league joins
export const searchPlayersWithJoins = internalQuery({
    args: {
        searchTerm: v.string(),
        limit: v.optional(v.number()),
        teamId: v.optional(v.id('teams')),
        leagueId: v.optional(v.id('leagues')),
    },
    handler: async (ctx, { searchTerm, limit = 25, teamId, leagueId }) => {
        // Build the final query based on whether teamId is provided
        const finalQuery = teamId
            ? ctx.db.query('players').withIndex('by_team', (q) => q.eq('teamId', teamId))
            : ctx.db.query('players');

        const players = await finalQuery.collect();

        // Filter by search term
        const filteredPlayers = players
            .filter((player) => {
                return player.name.toLowerCase().includes(searchTerm.toLowerCase());
            })
            .slice(0, limit);

        // Get team and league info for filtered players
        const teamIds = [...new Set(filteredPlayers.map((p) => p.teamId))];
        const teams = await Promise.all(teamIds.map((id) => ctx.db.get(id)));
        const teamsMap = new Map(teams.filter(Boolean).map((team) => [team!._id, team!]));

        const leagueIds = [...new Set(teams.filter(Boolean).map((t) => t!.leagueId))];
        const leagues = await Promise.all(leagueIds.map((id) => ctx.db.get(id)));
        const leaguesMap = new Map(leagues.filter(Boolean).map((league) => [league!._id, league!]));

        const results = filteredPlayers.map((player) => {
            const team = teamsMap.get(player.teamId);
            const league = team ? leaguesMap.get(team.leagueId) : null;

            return {
                player,
                team,
                league,
            };
        });

        // Apply league filter if provided
        if (leagueId) {
            return results.filter((result) => result.league?._id === leagueId);
        }

        return results;
    },
});

// Get player by provider ID (assumes 'api-football' provider)
export const getPlayerByProviderId = internalQuery({
    args: { providerPlayerId: v.string() },
    handler: async (ctx, { providerPlayerId }): Promise<Doc<'players'> | null> =>
        ctx.db
            .query('players')
            .withIndex('by_provider_player', (q) =>
                q.eq('provider', 'api-football').eq('providerPlayerId', providerPlayerId),
            )
            .first(),
});
