
import { v4 as uuidv4 } from 'uuid';

/**
 * Singleton class to manage the shared state of the QA session.
 * Stores configuration, API keys, and session metrics.
 */
class QAContext {
    constructor() {
        this.reset();
    }

    reset() {
        this.sessionId = null;
        this.environment = 'local';
        this.baseUrl = 'http://localhost:3000';
        this.keys = {
            openai: process.env.OPENAI_API_KEY || null,
            anthropic: process.env.ANTHROPIC_API_KEY || null,
            google: process.env.INFERENCE_TOKEN || null
        };
        this.startTime = null;
    }

    initialize(environment = 'local', keys = {}) {
        this.reset();
        this.sessionId = uuidv4();
        this.environment = environment;
        this.startTime = new Date();

        if (process.env.REMOTE_URL) {
            this.baseUrl = process.env.REMOTE_URL;
        } else if (environment === 'local') {
            this.baseUrl = 'http://localhost:3000';
        } else if (environment === 'staging') {
            this.baseUrl = process.env.STAGING_URL || 'http://localhost:3000';
        } else if (environment === 'production') {
            if (process.env.NODE_ENV !== 'production') {
                console.warn('Initializing PRODUCTION context from non-production env');
            }
            this.baseUrl = process.env.PROD_URL;
        }

        // Merge provided keys with env vars (env vars take precedence if not explicitly overridden, 
        // actually keys param should override env for testing different keys)
        if (keys.openai) this.keys.openai = keys.openai;
        if (keys.anthropic) this.keys.anthropic = keys.anthropic;
        if (keys.google) this.keys.google = keys.google;

        console.log(`[QAContext] Session ${this.sessionId} initialized for ${environment}`);
        return this.getStatus();
    }

    getStatus() {
        return {
            sessionId: this.sessionId,
            environment: this.environment,
            baseUrl: this.baseUrl,
            keysConfigured: {
                openai: !!this.keys.openai,
                anthropic: !!this.keys.anthropic,
                google: !!this.keys.google
            },
            uptime: this.startTime ? (new Date() - this.startTime) / 1000 : 0
        };
    }

    getApiKey(provider) {
        if (provider === 'google') return this.keys.google;
        return this.keys[provider];
    }
}

export const context = new QAContext();
