#!/usr/bin/env node

// Test runner
import { runTests } from './unit.test.js';

console.log('🚀 Multi-Model Chat Comparator - Test Suite\n');
console.log('='.repeat(50));

const results = runTests();

console.log('='.repeat(50));

if (results.failed > 0) {
    console.log('\n❌ Tests failed!');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
}
