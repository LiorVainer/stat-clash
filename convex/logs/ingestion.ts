'use node';

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

    override info(message: string, data?: Record<string, any>) {
        this.log('info', message, { ...data, ...this.metrics });
    }

    override warn(message: string, data?: Record<string, any>) {
        this.log('warn', message, { ...data, ...this.metrics });
    }

    override error(message: string, data?: Record<string, any>) {
        this.metrics.errors++;
        this.log('error', message, { ...data, ...this.metrics });
    }

    override success(message: string, data?: Record<string, any>) {
        this.log('success', message, { ...data, ...this.metrics });
    }

    // Log API calls to the dedicated api_ingest_log table using interface
    async logApiCall(params: ApiCallLogParams) {
        this.log('info', `API call: ${params.provider} ${params.resource}`, params);
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
