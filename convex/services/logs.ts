import { internalMutation } from '../_generated/server';
import schema from '../schema';

export const createIngestionLog = internalMutation({
    args: schema.tables.ingestion_logs.validator,
    handler: async (ctx, args) => ctx.db.insert('ingestion_logs', args),
});

export const createApiIngestLog = internalMutation({
    args: schema.tables.api_ingest_log.validator,
    handler: async (ctx, args) => ctx.db.insert('api_ingest_log', args),
});
