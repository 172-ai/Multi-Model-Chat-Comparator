// LocalStorage wrapper for API keys and settings
const STORAGE_KEYS = {
    OPENAI_KEY: 'llm_comparator_openai_key',
    ANTHROPIC_KEY: 'llm_comparator_anthropic_key',
    GOOGLE_KEY: 'llm_comparator_google_key',
    ENABLED_MODELS: 'llm_comparator_enabled_models',
    HISTORY: 'llm_comparator_history'
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

    // Clear all data
    static clearAll() {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
    }
}
