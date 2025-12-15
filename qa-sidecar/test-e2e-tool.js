
import dotenv from 'dotenv';
dotenv.config();

import { validate_model_response } from './journeys/e2e.js';
import { initialize_qa_session } from './journeys/setup.js';

async function test() {
    console.log('🧪 Testing validate_model_response tool...\n');

    // Init session for context
    await initialize_qa_session.handler({ environment: 'local', keys: { google: process.env.INFERENCE_TOKEN } });

    // Test 1: Simple Hi
    console.log('1. Testing "Hi" (expect text success)...');
    const r1 = await validate_model_response.handler({ prompt: "Hi", expectJson: false });
    const j1 = JSON.parse(r1.content[0].text);
    if (!j1.execution || j1.execution.status !== 'success') console.error('❌ Failed:', j1);
    else console.log('✅ Success:', j1.response.text.substring(0, 50) + '...');

    // Test 2: JSON
    console.log('\n2. Testing JSON (expect valid parse)...');
    const r2 = await validate_model_response.handler({
        prompt: "Return a JSON object with key 'status' set to 'ok'. Do not use markdown.",
        expectJson: true
    });
    const j2 = JSON.parse(r2.content[0].text);
    if (j2.validation.passed) console.log('✅ JSON Validated:', j2.response.parsed);
    else console.error('❌ JSON Validation Failed:', j2.validation.errors);

    // Test 3: Markdown JSON (expect extraction)
    console.log('\n3. Testing Markdown JSON (expect extraction)...');
    const r3 = await validate_model_response.handler({
        prompt: "Return a JSON object with key 'type' set to 'markdown' inside a markdown block.",
        expectJson: true
    });
    const j3 = JSON.parse(r3.content[0].text);
    if (j3.validation.passed) console.log('✅ Markdown JSON Extracted:', j3.response.parsed);
    else console.error('❌ Markdown Extraction Failed:', j3.validation.errors);
}

test().catch(console.error);
