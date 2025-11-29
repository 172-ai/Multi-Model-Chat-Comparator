// Token counting and cost calculation utilities
import { MODEL_CONFIGS } from '../config/models.js';

export class Metrics {
    // Approximate token counting (rough estimate based on character count)
    // For production, consider using tiktoken or similar library
    static estimateTokenCount(text) {
        if (!text) return 0;
        // Rough approximation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    // Calculate cost based on token usage and model pricing
    static calculateCost(modelId, inputTokens, outputTokens) {
        const config = MODEL_CONFIGS[modelId];
        if (!config || !config.pricing) return 0;

        const inputCost = inputTokens * config.pricing.input;
        const outputCost = outputTokens * config.pricing.output;

        return inputCost + outputCost;
    }

    // Format cost for display
    static formatCost(cost) {
        if (cost < 0.01) {
            return `$${(cost * 1000).toFixed(4)}‰`; // Show in per-mille for very small costs
        }
        return `$${cost.toFixed(4)}`;
    }

    // Format latency for display
    static formatLatency(milliseconds) {
        if (milliseconds < 1000) {
            return `${Math.round(milliseconds)}ms`;
        }
        return `${(milliseconds / 1000).toFixed(2)}s`;
    }

    // Format token count for display
    static formatTokens(count) {
        if (count >= 1000) {
            return `${(count / 1000).toFixed(1)}K`;
        }
        return count.toString();
    }

    // Get model metadata
    static getModelMetadata(modelId) {
        const config = MODEL_CONFIGS[modelId];
        if (!config) return null;

        return {
            name: config.displayName,
            provider: config.provider,
            contextWindow: config.contextWindow,
            pricing: config.pricing
        };
    }

    // Performance tracker for measuring API call latency
    static createPerformanceTracker() {
        const startTime = performance.now();

        return {
            stop: () => {
                const endTime = performance.now();
                return endTime - startTime;
            }
        };
    }
}
