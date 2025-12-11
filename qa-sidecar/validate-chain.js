import dotenv from 'dotenv';

dotenv.config();

import { initialize_qa_session } from './journeys/setup.js';
import { check_system_health } from './journeys/health.js';
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
        // Note: The previous logic already injected mock keys into the context for this specific run.
    }

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
            if (!modelCount && discData.raw_response_snippet) {
                // Try to infer from raw snippet if count logic failed
                const raw = discData.raw_response_snippet;
                if (Array.isArray(raw)) modelCount = raw.length;
                else if (raw.data && Array.isArray(raw.data)) modelCount = raw.data.length;
                else if (raw.models && Array.isArray(raw.models)) modelCount = raw.models.length;
            }
            console.log(`✅ Success! Found ${modelCount || '?'} models.`);
        }
    }

    // Report on missing providers
    const allProviders = ['openai', 'anthropic', 'google'];
    const missing = allProviders.filter(p => !availableProviders.includes(p));
    if (missing.length > 0) {
        console.log(`   ℹ️ Skipped: ${missing.join(', ')} (No API Key in .env)`);
    }

    console.log('\n✨ Validation Chain Complete! Ready for Deployment?');
}

runValidationChain().catch(console.error);
