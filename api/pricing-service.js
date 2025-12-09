// Dynamic pricing service using OpenRouter API
// Fetches model pricing and caches for 1 day

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day in milliseconds

class PricingService {
    constructor() {
        this.cache = new Map();
        this.lastFetch = null;
        this.allModels = null;
        this.fetchPromise = null;
    }

    // Check if cache is still valid
    isCacheValid() {
        if (!this.lastFetch) return false;
        return (Date.now() - this.lastFetch) < CACHE_DURATION_MS;
    }

    // Fetch all models from OpenRouter API
    async fetchAllModels() {
        // If already fetching, wait for that request
        if (this.fetchPromise) {
            return this.fetchPromise;
        }

        // If cache is valid, return cached data
        if (this.isCacheValid() && this.allModels) {
            return this.allModels;
        }

        // Fetch fresh data
        this.fetchPromise = (async () => {
            try {
                console.log('[PricingService] Fetching models from OpenRouter API...');
                const response = await fetch(OPENROUTER_API_URL);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();
                this.allModels = data.data || [];
                this.lastFetch = Date.now();

                // Build cache map for quick lookups
                this.cache.clear();
                for (const model of this.allModels) {
                    if (model.pricing) {
                        this.cache.set(model.id, {
                            // OpenRouter prices are per 1M tokens, convert to per 1K
                            input: parseFloat(model.pricing.prompt) * 1000,
                            output: parseFloat(model.pricing.completion) * 1000,
                            source: 'openrouter'
                        });
                    }
                }

                console.log(`[PricingService] Cached pricing for ${this.cache.size} models`);
                return this.allModels;
            } catch (error) {
                console.error('[PricingService] Failed to fetch from OpenRouter:', error.message);
                return [];
            } finally {
                this.fetchPromise = null;
            }
        })();

        return this.fetchPromise;
    }

    // Get pricing for a specific model
    // modelId can be from any provider (openai, anthropic, google)
    async getPricing(modelId) {
        // Ensure cache is populated
        await this.fetchAllModels();

        // Try exact match first
        if (this.cache.has(modelId)) {
            return this.cache.get(modelId);
        }

        // Try common model ID mappings
        const mappings = this.getModelMappings(modelId);
        for (const mappedId of mappings) {
            if (this.cache.has(mappedId)) {
                return this.cache.get(mappedId);
            }
        }

        // Try partial match (e.g., "gpt-4-turbo" matches "openai/gpt-4-turbo")
        for (const [cachedId, pricing] of this.cache.entries()) {
            if (cachedId.includes(modelId) || modelId.includes(cachedId.split('/').pop())) {
                return pricing;
            }
        }

        return null;
    }

    // Map provider-specific model IDs to OpenRouter format
    getModelMappings(modelId) {
        const mappings = [];

        // OpenRouter uses "provider/model" format
        mappings.push(`openai/${modelId}`);
        mappings.push(`anthropic/${modelId}`);
        mappings.push(`google/${modelId}`);

        // Common aliases
        if (modelId.includes('gpt-4o')) {
            mappings.push('openai/gpt-4o');
            mappings.push('openai/gpt-4o-2024-11-20');
        }
        if (modelId.includes('gpt-4-turbo')) {
            mappings.push('openai/gpt-4-turbo');
            mappings.push('openai/gpt-4-turbo-preview');
        }
        if (modelId.includes('claude-3-5-sonnet')) {
            mappings.push('anthropic/claude-3.5-sonnet');
            mappings.push('anthropic/claude-3-5-sonnet-20241022');
        }
        if (modelId.includes('claude-3-opus')) {
            mappings.push('anthropic/claude-3-opus');
            mappings.push('anthropic/claude-3-opus-20240229');
        }
        if (modelId.includes('claude-3-haiku')) {
            mappings.push('anthropic/claude-3-haiku');
            mappings.push('anthropic/claude-3-haiku-20240307');
        }
        if (modelId.includes('gemini-1.5-pro')) {
            mappings.push('google/gemini-pro-1.5');
            mappings.push('google/gemini-1.5-pro');
        }
        if (modelId.includes('gemini-1.5-flash')) {
            mappings.push('google/gemini-flash-1.5');
            mappings.push('google/gemini-1.5-flash');
        }

        return mappings;
    }

    // Force refresh the cache
    async refresh() {
        this.lastFetch = null;
        this.cache.clear();
        return this.fetchAllModels();
    }

    // Get cache status
    getCacheStatus() {
        return {
            isCached: this.isCacheValid(),
            modelCount: this.cache.size,
            lastFetch: this.lastFetch ? new Date(this.lastFetch).toISOString() : null,
            expiresAt: this.lastFetch ? new Date(this.lastFetch + CACHE_DURATION_MS).toISOString() : null
        };
    }
}

// Export singleton instance
export const pricingService = new PricingService();
