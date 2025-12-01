
// Token counting and cost calculation utilities
import { getModelPricing } from '../config/models.js';

export class Metrics {
    // Approximate token counting (rough estimate based on character count)
    // For production, consider using tiktoken or similar library
    static estimateTokenCount(text) {
        if (!text) return 0;
        // Rough approximation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    // Calculate cost based on token usage and pricing
    // pricing should be an object with { input: number, output: number } per 1K tokens
    static calculateCost(pricing, inputTokens, outputTokens) {
        if (!pricing) return null;

        const inputCost = (inputTokens / 1000) * pricing.input;
        const outputCost = (outputTokens / 1000) * pricing.output;

        return inputCost + outputCost;
    }

    // Format cost for display
    static formatCost(cost) {
        if (cost === null || cost === undefined) return 'N/A';
        if (cost === 0) return '$0.0000';
        if (cost < 0.0001) {
            // For very small costs, show more decimal places
            return `$${cost.toFixed(6)}`;
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
