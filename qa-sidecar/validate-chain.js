
import { initialize_qa_session } from './journeys/setup.js';
import { check_system_health } from './journeys/health.js';
import { discover_provider_models } from './journeys/discovery.js';
import { verify_pricing_accuracy, audit_export_format } from './journeys/validation.js';
import { context } from './context.js';

async function runValidationChain() {
    console.log('🚀 Starting QA Sidecar Validation Chain...\n');

    // Step 1: Initialize Session
    console.log('1. [initialize_qa_session] Setting up Local environment...');
    const initResult = await initialize_qa_session.handler({
        environment: 'local',
        keys: { openai: 'sk-test-key-mock' } // Mock key for safety
    });
    console.log('   Result:', JSON.parse(initResult.content[0].text).sessionId ? '✅ Session Created' : '❌ Failed');

    // Step 2: Health Check
    console.log('\n2. [check_system_health] Pinging localhost:3000...');
    const healthResult = await check_system_health.handler({});
    const healthData = JSON.parse(healthResult.content[0].text);
    console.log('   Result:', healthData.status === 'ok' ? '✅ Backend Healthy' : `❌ Backend Unhealthy: ${healthData.error || 'Unknown'}`);

    // Step 3: Logic Verification (Pricing)
    console.log('\n3. [verify_pricing_accuracy] Testing Logic Import...');
    // Note: Model ID must exist in caching service logic or fallback
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
    // This might fail if localhost:3000 is checking real keys against OpenAI.
    // Our proxy checks "if (!apiKey) 401". It passes the key to OpenAI. OpenAI will return 401 for 'sk-test-key-mock'.
    // This PROVES the sidecar is hitting the proxy correctly.
    console.log('\n5. [discover_provider_models] Testing Proxy Connectivity...');
    const discResult = await discover_provider_models.handler({ provider: 'openai' });
    const discData = JSON.parse(discResult.content[0].text); // Might contain error

    if (discData.status === 'error') {
        console.log('   Note: Discovery returned error (Expected with mock key):', discData.error);
        // If error is HTTP 401, that implies connectivity to proxy worked!
        if (discData.error.includes('401')) {
            console.log('   ✅ Connectivity Validated (Got 401 from Upstream via Proxy)');
        } else {
            console.log('   ⚠️ Connectivity Uncertain:', discData.error);
        }
    } else {
        console.log('   ✅ Discovery Successful (Real Key used?)');
    }

    console.log('\n✨ Validation Chain Complete!');
}

runValidationChain().catch(console.error);
