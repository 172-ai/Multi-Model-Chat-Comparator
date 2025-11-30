// Unit tests for empty response detection and error handling
import { describe, it, expect, beforeEach } from './test-framework.js';

describe('Empty Response Detection', () => {
    it('should detect empty responses with 0 tokens', () => {
        const result = {
            text: '',
            outputTokens: 0,
            stopReason: 'end_turn'
        };

        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);

        expect(isEmpty).toBe(true);
    });

    it('should detect very short responses with few tokens', () => {
        const result = {
            text: '  ',
            outputTokens: 2,
            stopReason: 'end_turn'
        };

        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);

        expect(isEmpty).toBe(true);
    });

    it('should NOT flag normal responses as empty', () => {
        const result = {
            text: 'Hello! How can I assist you today?',
            outputTokens: 12,
            stopReason: 'end_turn'
        };

        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);

        expect(isEmpty).toBe(false);
    });

    it('should detect null stop_reason as streaming timeout', () => {
        const result = {
            text: '',
            outputTokens: 0,
            stopReason: null
        };

        const isStreamingTimeout = result.stopReason === null &&
            (!result.text || result.text.trim() === '');

        expect(isStreamingTimeout).toBe(true);
    });
});

describe('Cost Calculation', () => {
    it('should format cost in dollars correctly', () => {
        const formatCost = (cost) => {
            if (cost === 0) return '$0.00';
            if (cost < 0.00001) return `$${cost.toFixed(8)}`;
            if (cost < 0.01) return `$${cost.toFixed(6)}`;
            return `$${cost.toFixed(4)}`;
        };

        expect(formatCost(0.000039)).toBe('$0.000039');
        expect(formatCost(0.0010795)).toBe('$0.0011');
        expect(formatCost(0)).toBe('$0.00');
    });

    it('should NOT include per-mille symbol', () => {
        const formatCost = (cost) => {
            if (cost === 0) return '$0.00';
            if (cost < 0.00001) return `$${cost.toFixed(8)}`;
            if (cost < 0.01) return `$${cost.toFixed(6)}`;
            return `$${cost.toFixed(4)}`;
        };

        const result = formatCost(0.000039);
        expect(result.includes('‰')).toBe(false);
        expect(result.startsWith('$')).toBe(true);
    });
});

describe('Streaming Preference', () => {
    let mockStorage;

    beforeEach(() => {
        mockStorage = {
            data: {},
            setItem(key, value) {
                this.data[key] = value;
            },
            getItem(key) {
                return this.data[key] || null;
            }
        };
    });

    it('should default to streaming enabled', () => {
        const stored = mockStorage.getItem('llm_comparator_streaming_enabled');
        const streamingEnabled = stored !== null ? JSON.parse(stored) : true;

        expect(streamingEnabled).toBe(true);
    });

    it('should persist streaming preference', () => {
        mockStorage.setItem('llm_comparator_streaming_enabled', JSON.stringify(false));
        const stored = mockStorage.getItem('llm_comparator_streaming_enabled');
        const streamingEnabled = JSON.parse(stored);

        expect(streamingEnabled).toBe(false);
    });
});

// Simple test framework
const tests = [];
const describes = [];

function describe(name, fn) {
    describes.push({ name, fn });
}

function it(name, fn) {
    tests.push({ name, fn });
}

function expect(value) {
    return {
        toBe(expected) {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        }
    };
}

function beforeEach(fn) {
    // Store setup function
}

// Run tests
export function runTests() {
    console.log('🧪 Running tests...\n');

    let passed = 0;
    let failed = 0;

    describes.forEach(({ name, fn }) => {
        console.log(`\n📦 ${name}`);
        fn();

        tests.forEach(({ name: testName, fn: testFn }) => {
            try {
                testFn();
                console.log(`  ✅ ${testName}`);
                passed++;
            } catch (error) {
                console.log(`  ❌ ${testName}`);
                console.log(`     ${error.message}`);
                failed++;
            }
        });

        tests.length = 0; // Clear tests for next describe
    });

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

export { describe, it, expect, beforeEach };
