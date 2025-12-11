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

    // Step 5: Discovery (Network + Keys)
    console.log('\n5. [discover_provider_models] Testing Proxy Connectivity...');
    const discResult = await discover_provider_models.handler({ provider: 'openai' });
    const discData = JSON.parse(discResult.content[0].text);

    if (discData.status === 'error') {
        console.log('   ❌ Discovery Failed:', discData.error);
        if (discData.error.includes('401')) {
            console.log('      (Hint: API Key rejected by provider. Check .env)');
        } else if (discData.error.includes('No API key')) {
            console.log('      (Hint: .env file not loaded or key missing)');
        }
    } else {
        console.log(`   ✅ Discovery Successful! Found ${discData.model_count} OpenAI models.`);
    }

    console.log('\n✨ Validation Chain Complete!');
}

runValidationChain().catch(console.error);
