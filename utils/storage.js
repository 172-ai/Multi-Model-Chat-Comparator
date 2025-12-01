// LocalStorage wrapper for API keys and settings
const STORAGE_KEYS = {
    OPENAI_KEY: 'llm_comparator_openai_key',
    ANTHROPIC_KEY: 'llm_comparator_anthropic_key',
    GOOGLE_KEY: 'llm_comparator_google_key',
    ENABLED_MODELS: 'llm_comparator_enabled_models',
    HISTORY: 'llm_comparator_history',
    STREAMING_ENABLED: 'llm_comparator_streaming_enabled',
    TEMPERATURE: 'llm_comparator_temperature',
    MAX_TOKENS: 'llm_comparator_max_tokens'
};

export class Storage {
    // API Key Management
    static setApiKey(provider, key) {
        const storageKey = STORAGE_KEYS[`${provider.toUpperCase()}_KEY`];
        if (storageKey) {
            localStorage.setItem(storageKey, key);
        }
    }

    static getApiKey(provider) {
        const storageKey = STORAGE_KEYS[`${provider.toUpperCase()}_KEY`];
        return storageKey ? localStorage.getItem(storageKey) : null;
    }

    static clearApiKey(provider) {
        const storageKey = STORAGE_KEYS[`${provider.toUpperCase()}_KEY`];
        if (storageKey) {
            localStorage.removeItem(storageKey);
        }
    }

    static getAllApiKeys() {
        return {
            openai: this.getApiKey('openai'),
            anthropic: this.getApiKey('anthropic'),
            google: this.getApiKey('google')
        };
    }

    // Enabled Models Management
    static setEnabledModels(models) {
        localStorage.setItem(STORAGE_KEYS.ENABLED_MODELS, JSON.stringify(models));
    }

    static getEnabledModels() {
        const stored = localStorage.getItem(STORAGE_KEYS.ENABLED_MODELS);
        return stored ? JSON.parse(stored) : null;
    }

    // History Management
    static addToHistory(entry) {
        const history = this.getHistory();
        history.unshift({
            ...entry,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 entries
        const trimmedHistory = history.slice(0, 50);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmedHistory));
    }

    static getHistory() {
        const stored = localStorage.getItem(STORAGE_KEYS.HISTORY);
        return stored ? JSON.parse(stored) : [];
    }

    static clearHistory() {
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
    }

    // Streaming Preference
    static setStreamingEnabled(enabled) {
        localStorage.setItem(STORAGE_KEYS.STREAMING_ENABLED, JSON.stringify(enabled));
    }

    static getStreamingEnabled() {
        const stored = localStorage.getItem(STORAGE_KEYS.STREAMING_ENABLED);
        return stored !== null ? JSON.parse(stored) : true; // Default to true
    }

    // Model Parameters
    static setModelParams(params) {
        if (params.temperature !== undefined) {
            localStorage.setItem(STORAGE_KEYS.TEMPERATURE, params.temperature);
        }
        if (params.maxTokens !== undefined) {
            localStorage.setItem(STORAGE_KEYS.MAX_TOKENS, params.maxTokens);
        }
    }

    static getModelParams() {
        const temp = localStorage.getItem(STORAGE_KEYS.TEMPERATURE);
        const maxTokens = localStorage.getItem(STORAGE_KEYS.MAX_TOKENS);

        return {
            temperature: temp !== null ? parseFloat(temp) : 0.7,
            maxTokens: maxTokens !== null ? parseInt(maxTokens) : 2048
        };
    }

    // Clear all data
    static clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }

    // Generic storage methods
    static setItem(key, value) {
        localStorage.setItem(key, value);
    }

    static getItem(key) {
        return localStorage.getItem(key);
    }
}
