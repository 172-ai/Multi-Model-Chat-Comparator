import dotenv from 'dotenv';

dotenv.config();

import { initialize_qa_session } from './journeys/setup.js';
import { check_system_health } from './journeys/health.js';
import { run_comparison_test } from './journeys/execution.js';
import { discover_provider_models } from './journeys/discovery.js';
import { verify_pricing_accuracy, audit_export_format } from './journeys/validation.js';
import { context } from './context.js';

async function runValidationChain() {
    console.log('🚀 Starting QA Sidecar Validation Chain...\n');

    // Step 1: Initialize Session
    console.log('1. [initialize_qa_session] Setting up Local environment...');
    // Use real keys from .env if available, fallback to mock
    const initResult = await initialize_qa_session.handler({
        environment: 'local',
        keys: {
            openai: process.env.OPENAI_API_KEY || 'sk-test-key-mock',
            anthropic: process.env.ANTHROPIC_API_KEY || 'sk-ant-test-mock',
            google: process.env.INFERENCE_TOKEN || 'test-token'
        }
    });
    console.log('   Result:', JSON.parse(initResult.content[0].text).sessionId ? '✅ Session Created' : '❌ Failed');

    // Step 2: Health Check
    console.log('\n2. [check_system_health] Pinging localhost:3000...');
    const healthResult = await check_system_health.handler({});
    const healthData = JSON.parse(healthResult.content[0].text);
    console.log('   Result:', healthData.status === 'ok' ? '✅ Backend Healthy' : `❌ Backend Unhealthy: ${healthData.error || 'Unknown'}`);

    // Step 3: Logic Verification (Pricing)
    console.log('\n3. [verify_pricing_accuracy] Testing Logic Import...');
    const pricingResult = await verify_pricing_accuracy.handler({
        modelId: 'gpt-4',
        inputTokens: 1000,
        outputTokens: 1000
    });
    const pricingData = JSON.parse(pricingResult.content[0].text);
    console.log('   Match:', pricingData.match ? '✅ Calculation Matches' : '❌ Calculation Mismatch');

    // Step 4: Logic Verification (Export)
    console.log('\n4. [audit_export_format] Testing Export Schema...');
    const exportResult = await audit_export_format.handler({});
    const exportData = JSON.parse(exportResult.content[0].text);
    console.log('   Valid:', exportData.valid ? '✅ Schema Valid' : '❌ Schema Invalid');

    // Step 5: Discovery (Network + Keys) for ALL providers
    console.log('\n5. [discover_provider_models] Testing Proxy Connectivity...');

    // Check which keys are available (using the same logic as context.js would)
    const availableProviders = [];
    if (process.env.OPENAI_API_KEY) availableProviders.push('openai');
    if (process.env.ANTHROPIC_API_KEY) availableProviders.push('anthropic');
    if (process.env.INFERENCE_TOKEN) availableProviders.push('google');

    if (availableProviders.length === 0) {
        console.log('   ⚠️ No API Keys found in .env. Falling back to Mock Key test for OpenAI only.');
        availableProviders.push('openai');
    }

    const discoveredModels = {};

    for (const provider of availableProviders) {
        process.stdout.write(`   👉 Checking ${provider}... `);
        const discResult = await discover_provider_models.handler({ provider });
        const discData = JSON.parse(discResult.content[0].text);

        if (discData.status === 'error') {
            if (discData.error.includes('401') || discData.error.includes('403')) {
                console.log(`❌ Auth Failed (401/403). Key exists but was rejected.`);
            } else {
                console.log(`❌ Error: ${discData.error}`);
            }
        } else {
            // Success!
            let modelCount = discData.model_count;
            let firstModelId = null;

            const raw = discData.raw_response_snippet;

            if (provider === 'google' && raw.models && raw.models.length > 0) {
                // Google returns "models/name", strip prefix
                firstModelId = raw.models[0].name.replace('models/', '');
                // Try to find flash if possible
                const flash = raw.models.find(m => m.name.includes('flash'));
                if (flash) firstModelId = flash.name.replace('models/', '');
            } else if (provider === 'openai' && raw.data && raw.data.length > 0) {
                firstModelId = raw.data[0].id;
                const turbo = raw.data.find(m => m.id.includes('gpt-3.5'));
                if (turbo) firstModelId = turbo.id;
            } else if (provider === 'anthropic' && Array.isArray(raw)) {
                if (raw.length > 0) firstModelId = raw[0].id;
            }

            if (firstModelId) discoveredModels[provider] = firstModelId;
            console.log(`✅ Success! Found ${modelCount || '?'} models. (Sample: ${firstModelId})`);
        }
    }

    // Report on missing providers
    const allProviders = ['openai', 'anthropic', 'google'];
    const missing = allProviders.filter(p => !availableProviders.includes(p));
    if (missing.length > 0) {
        console.log(`   ℹ️ Skipped: ${missing.join(', ')} (No API Key in .env)`);
    }

    // Step 6: Functional Testing (Stream vs Non-Stream)
    console.log('\n6. [run_comparison_test] Functional Testing (Stream vs Non-Stream)...');

    // Pick a model based on what we discovered
    let testModel = null;
    let testProvider = null;

    if (discoveredModels.google) { testModel = discoveredModels.google; testProvider = 'google'; }
    else if (discoveredModels.openai) { testModel = discoveredModels.openai; testProvider = 'openai'; }
    else if (discoveredModels.anthropic) { testModel = discoveredModels.anthropic; testProvider = 'anthropic'; }

    if (testModel) {
        console.log(`   👉 Target Model: ${testModel} (${testProvider})`);
        const prompt = "How many planets are in Solar System? Answer with just the number.";

        // A. Non-Streaming
        process.stdout.write('   a) Non-Streaming... ');
        const resNonStream = await run_comparison_test.handler({
            models: [testModel],
            prompt: prompt,
            stream: false
        });
        const jsonNonStream = JSON.parse(resNonStream.content[0].text);
        const r1 = jsonNonStream.results[0];
        if (r1.status === 'success') {
            console.log(`✅ Success (${r1.latency_ms}ms)`);
            console.log(`      Response: "${r1.snippet}"`);
        } else {
            console.log(`❌ Failed: ${r1.error}`);
        }

        // B. Streaming
        process.stdout.write('   b) Streaming...     ');
        const resStream = await run_comparison_test.handler({
            models: [testModel],
            prompt: prompt,
            stream: true
        });
        const jsonStream = JSON.parse(resStream.content[0].text);
        const r2 = jsonStream.results[0];
        if (r2.status === 'success') {
            console.log(`✅ Success (TTFT: ${r2.ttft_ms}ms, Total: ${r2.latency_ms}ms)`);
            console.log(`      Response: "${r2.snippet}"`);
            if (!r2.ttft_ms && testProvider === 'google') {
                console.log(`      (Note: TTFT may be null if Google Proxy buffers chunks)`);
            }
        } else {
            console.log(`❌ Failed: ${r2.error}`);
        }

    } else {
        console.log('   ⚠️ Skipping Functional Test (No working provider found)');
    }

    console.log('\n✨ Validation Chain Complete! Ready for Deployment?');
}

runValidationChain().catch(console.error);
