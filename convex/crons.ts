import { cronJobs } from 'convex/server';
import { internal } from './_generated/api';

const crons = cronJobs();

// Daily team stats ingestion - runs at 2 AM UTC every day
crons.daily('daily-team-stats-ingestion', { hourUTC: 2, minuteUTC: 0 }, internal.ingestion.teamStats.ingestTeamStats, {
    season: new Date().getFullYear().toString(),
});

// Daily player stats ingestion - runs at 3 AM UTC every day
crons.daily(
    'daily-player-stats-ingestion',
    { hourUTC: 3, minuteUTC: 0 },
    internal.ingestion.playerStats.ingestPlayerStats,
    {
        season: new Date().getFullYear().toString(),
    },
);

export default crons;
