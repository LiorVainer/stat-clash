'use node';

import { CustomLogLevel } from './levels.logger';
import { Timer } from './timer';
import { ActionCtx } from '../_generated/server';
import { BaseLogger } from './base-logger.logger';
import { ProcessTypes } from '../models/log.model';
import { internal } from '../_generated/api';

// Interface for API call logging parameters
export interface ApiCallLogParams {
    provider: string;
    resource: string;
    responseTime: number;
    statusCode: number;
    params?: string;
    error?: string;
}

// Enhanced ingestion logger that works WITH Logtail, not instead of it
export class IngestionLogger extends BaseLogger {
    private timer: Timer;
    private metrics = {
        jobType: '',
        apiCalls: 0,
        recordsProcessed: 0,
        recordsCreated: 0,
        recordsUpdated: 0,
        errors: 0,
    };

    constructor(
        private ctx: ActionCtx,
        private jobType: string,
    ) {
        super(ProcessTypes.INGESTION);
        this.timer = new Timer();
        this.metrics.jobType = jobType;
    }

    // Log to multiple destinations: Console + Convex table + Logtail (if enabled)
    private async baseLog(level: CustomLogLevel, message: string, data?: Record<string, any>) {
        const timestamp = new Date().toISOString();

        this.log(level, message, data);

        try {
            await this.ctx.runMutation(internal.services.logs.createIngestionLog, {
                jobType: this.jobType,
                level,
                message,
                data: data || {},
                timestamp,
                // Include current metrics snapshot
                apiCalls: this.metrics.apiCalls,
                recordsProcessed: this.metrics.recordsProcessed,
                recordsCreated: this.metrics.recordsCreated,
                recordsUpdated: this.metrics.recordsUpdated,
                errors: this.metrics.errors,
                durationMs: this.timer.total(),
            });
        } catch (error) {
            console.error('Failed to write to ingestion_logs table:', error);
        }
    }

    async info(message: string, data?: Record<string, any>) {
        await this.baseLog('info', message, data);
    }

    async warn(message: string, data?: Record<string, any>) {
        await this.baseLog('warn', message, data);
    }

    async error(message: string, data?: Record<string, any>) {
        this.metrics.errors++;
        await this.baseLog('error', message, data);
    }

    async success(message: string, data?: Record<string, any>) {
        await this.baseLog('success', message, data);
    }

    // Log API calls to the dedicated api_ingest_log table using interface
    async logApiCall(params: ApiCallLogParams) {
        this.metrics.apiCalls++;

        try {
            await this.ctx.runMutation(internal.services.logs.createApiIngestLog, {
                provider: params.provider,
                resource: params.resource,
                providerParams: params.params,
                ok: params.statusCode >= 200 && params.statusCode < 300,
                statusCode: params.statusCode,
                durationMs: params.responseTime,
                error: params.error,
                createdAt: new Date().toISOString(),
            });
        } catch (dbError) {
            console.error('Failed to write to api_ingest_log table:', dbError);
        }
    }

    // Metrics tracking
    incrementProcessed() {
        this.metrics.recordsProcessed++;
    }
    incrementCreated() {
        this.metrics.recordsCreated++;
    }
    incrementUpdated() {
        this.metrics.recordsUpdated++;
    }

    // Final job summary
    async finish() {
        const duration = this.timer.total();
        await this.success('Job completed', {
            ...this.metrics,
            durationMs: duration,
            recordsPerSecond: Math.round(this.metrics.recordsProcessed / (duration / 1000)) || 0,
        });
        return this.metrics;
    }
}
