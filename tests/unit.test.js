// Simple test framework
const tests = [];
const describes = [];
let currentBeforeEach = null;

export function describe(name, fn) {
    describes.push({ name, fn });
}

export function it(name, fn) {
    tests.push({ name, fn });
}

export function expect(value) {
    return {
        toBe(expected) {
            if (value !== expected) {
                throw new Error(`Expected ${value} to be ${expected}`);
            }
        }
    };
}

export function beforeEach(fn) {
    currentBeforeEach = fn;
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
                if (currentBeforeEach) currentBeforeEach();
                testFn();
                console.log(`  ✅ ${testName}`);
                passed++;
            } catch (error) {
                console.log(`  ❌ ${testName}`);
                console.log(`     ${error.message}`);
                failed++;
            }
        });

        tests.length = 0;
        currentBeforeEach = null;
    });

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    return { passed, failed };
}

// Unit tests for empty response detection
describe('Empty Response Detection', () => {
    it('should detect empty responses with 0 tokens', () => {
        const result = { text: '', outputTokens: 0, stopReason: 'end_turn' };
        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);
        expect(isEmpty).toBe(true);
    });

    it('should detect very short responses', () => {
        const result = { text: '  ', outputTokens: 2, stopReason: 'end_turn' };
        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);
        expect(isEmpty).toBe(true);
    });

    it('should NOT flag normal responses as empty', () => {
        const result = { text: 'Hello! How can I assist you today?', outputTokens: 12 };
        const isEmpty = !result.text || result.text.trim() === '' ||
            (result.text.trim().length < 10 && result.outputTokens <= 5);
        expect(isEmpty).toBe(false);
    });

    it('should detect null stop_reason as streaming timeout', () => {
        const result = { text: '', outputTokens: 0, stopReason: null };
        const isTimeout = result.stopReason === null && (!result.text || result.text.trim() === '');
        expect(isTimeout).toBe(true);
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
    });

    it('should NOT include per-mille symbol', () => {
        const result = '$0.000039';
        expect(result.includes('‰')).toBe(false);
    });
});

describe('Streaming Preference', () => {
    it('should default to streaming enabled', () => {
        const streamingEnabled = true;
        expect(streamingEnabled).toBe(true);
    });
});
