// Top leagues to ingest - reduces API calls and focuses on major leagues
export const TOP_LEAGUES = [
    { name: 'Premier League', footballApiId: 39 },
    { name: 'La Liga', footballApiId: 140 },
    { name: 'Serie A', footballApiId: 135 },
    { name: 'Bundesliga', footballApiId: 78 },
    { name: 'Ligue 1', footballApiId: 61 },
] as const;

// Extract just the IDs for API calls
export const TOP_LEAGUE_IDS = TOP_LEAGUES.map((league) => league.footballApiId);

// Helper to get league info by ID
export const getLeagueInfoById = (id: number) => {
    return TOP_LEAGUES.find((league) => league.footballApiId === id);
};
