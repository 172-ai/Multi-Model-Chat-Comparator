// API provider integrations
import { MODEL_CONFIGS, API_ENDPOINTS } from '../config/models.js';
import { Metrics } from './metrics.js';

export class APIProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async makeRequest(modelId, prompt) {
        throw new Error('makeRequest must be implemented by subclass');
    }
}

// OpenAI Provider
export class OpenAIProvider extends APIProvider {
    async makeRequest(modelId, prompt) {
        const config = MODEL_CONFIGS[modelId];
        const tracker = Metrics.createPerformanceTracker();

        try {
            const response = await fetch(API_ENDPOINTS.openai, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: config.name,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: config.defaultParams.temperature,
                    max_tokens: config.defaultParams.max_tokens
                })
            });

            const latency = tracker.stop();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const completion = data.choices[0].message.content;
            const usage = data.usage;

            return {
                text: completion,
                latency,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                estimatedCost: Metrics.calculateCost(modelId, usage.prompt_tokens, usage.completion_tokens)
            };
        } catch (error) {
            return {
                error: error.message,
                latency: tracker.stop()
            };
        }
    }
}

// Anthropic Provider
export class AnthropicProvider extends APIProvider {
    async makeRequest(modelId, prompt) {
        const config = MODEL_CONFIGS[modelId];
        const tracker = Metrics.createPerformanceTracker();

        try {
            const response = await fetch(API_ENDPOINTS.anthropic, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: config.name,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: config.defaultParams.temperature,
                    max_tokens: config.defaultParams.max_tokens
                })
            });

            const latency = tracker.stop();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();
            const completion = data.content[0].text;
            const usage = data.usage;

            return {
                text: completion,
                latency,
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                totalTokens: usage.input_tokens + usage.output_tokens,
                estimatedCost: Metrics.calculateCost(modelId, usage.input_tokens, usage.output_tokens)
            };
        } catch (error) {
            return {
                error: error.message,
                latency: tracker.stop()
            };
        }
    }
}

// Google Provider
export class GoogleProvider extends APIProvider {
    async makeRequest(modelId, prompt) {
        const config = MODEL_CONFIGS[modelId];
        const tracker = Metrics.createPerformanceTracker();

        try {
            const url = `${API_ENDPOINTS.google}/${config.name}:generateContent?key=${this.apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: config.defaultParams.temperature,
                        maxOutputTokens: config.defaultParams.maxOutputTokens
                    }
                })
            });

            const latency = tracker.stop();

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                throw new Error('No response generated');
            }

            const completion = data.candidates[0].content.parts[0].text;

            // Google doesn't always return token counts, so we estimate
            const inputTokens = data.usageMetadata?.promptTokenCount || Metrics.estimateTokenCount(prompt);
            const outputTokens = data.usageMetadata?.candidatesTokenCount || Metrics.estimateTokenCount(completion);

            return {
                text: completion,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(modelId, inputTokens, outputTokens)
            };
        } catch (error) {
            return {
                error: error.message,
                latency: tracker.stop()
            };
        }
    }
}

// Provider factory
export class ProviderFactory {
    static createProvider(provider, apiKey) {
        switch (provider) {
            case 'openai':
                return new OpenAIProvider(apiKey);
            case 'anthropic':
                return new AnthropicProvider(apiKey);
            case 'google':
                return new GoogleProvider(apiKey);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    static async executeRequest(modelId, prompt, apiKeys) {
        const config = MODEL_CONFIGS[modelId];
        const apiKey = apiKeys[config.provider];

        if (!apiKey) {
            return {
                model: config.displayName,
                provider: config.provider,
                error: 'API key not configured',
                latency: 0
            };
        }

        try {
            const provider = this.createProvider(config.provider, apiKey);
            const result = await provider.makeRequest(modelId, prompt);

            return {
                model: config.displayName,
                provider: config.provider,
                contextWindow: config.contextWindow,
                timestamp: new Date().toISOString(),
                ...result
            };
        } catch (error) {
            return {
                model: config.displayName,
                provider: config.provider,
                error: error.message,
                latency: 0
            };
        }
    }
}
