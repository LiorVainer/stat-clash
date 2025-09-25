import { z } from 'zod';

// Player Data Validation Schema
export const PlayerDataSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    name: z.string().min(1),
    position: z.string().min(1),
    nationality: z.string().optional(),
    photoUrl: z.string().url().optional(),
    dateOfBirth: z.string().optional(),
    providerPlayerId: z.string(),
});

// Team Data Validation Schema
export const TeamDataSchema = z.object({
    name: z.string().min(1),
    shortName: z.string().optional(),
    crestUrl: z.string().url().optional(),
    providerTeamId: z.string(),
});

// League Data Validation Schema
export const LeagueDataSchema = z.object({
    name: z.string().min(1),
    code: z.string().optional(),
    season: z.string(),
    providerLeagueId: z.string(),
});

// Validation helper functions
export function validatePlayerData(data: unknown) {
    return PlayerDataSchema.parse(data);
}

export function validateTeamData(data: unknown) {
    return TeamDataSchema.parse(data);
}

export function validateLeagueData(data: unknown) {
    return LeagueDataSchema.parse(data);
}

// Type exports for TypeScript
export type PlayerData = z.infer<typeof PlayerDataSchema>;
export type TeamData = z.infer<typeof TeamDataSchema>;
export type LeagueData = z.infer<typeof LeagueDataSchema>;
