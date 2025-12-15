
import { z } from 'zod';
import { context } from '../context.js';

export const run_comparison_test = {
    name: 'run_comparison_test',
    description: 'Run a chat comparison test against multiple models.',
    inputSchema: z.object({
        prompt: z.string().describe('The prompt to send to the models'),
        models: z.array(z.string()).describe('List of model IDs to test (e.g. ["gpt-4", "claude-3-opus-20240229"])'),
        max_tokens: z.number().optional().default(100),
        stream: z.boolean().optional().default(false).describe('Whether to stream responses (validates SSE flow)')
    }),
    handler: async (args) => {
        const results = [];
        const errors = [];

        for (const modelId of args.models) {
            try {
                const provider = detectProvider(modelId);
                if (!provider) {
                    throw new Error(`Unknown provider for model: ${modelId}`);
                }

                const result = await callProvider(provider, modelId, args.prompt, args.max_tokens, args.stream);
                results.push(result);
            } catch (error) {
                errors.push({ model: modelId, error: error.message });
                results.push({ model: modelId, error: error.message, status: 'failed' });
            }
        }

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        summary: {
                            param_prompt: args.prompt,
                            total: args.models.length,
                            successful: results.filter(r => !r.error).length,
                            failed: errors.length
                        },
                        results: results
                    }, null, 2)
                }
            ]
        };
    }
};

// ... (previous code)

export function detectProvider(modelId) {
    if (modelId.startsWith('gpt') || modelId.startsWith('o1-')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('gemini')) return 'google';
    return null;
}

// Helper to parse SSE data
function parseSEEChunk(chunk) {
    const lines = chunk.split('\n');
    const results = [];
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
                results.push(JSON.parse(data));
            } catch (e) {
                // ignore parse errors for partial chunks
            }
        }
    }
    return results;
}

export async function callProvider(provider, modelId, prompt, maxTokens, stream = false) {
    const apiKey = context.getApiKey(provider);
    // ... (rest of function)

    if (!apiKey) throw new Error(`No API key for ${provider}`);

    let url, body;
    const startTime = performance.now();

    if (provider === 'openai') {
        url = `${context.baseUrl}/api/proxy/openai/chat/completions`;
        body = {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            stream: stream
        };
    } else if (provider === 'anthropic') {
        url = `${context.baseUrl}/api/proxy/anthropic/messages`;
        body = {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            stream: stream
        };
    } else if (provider === 'google') {
        // Google uses different endpoint for streaming
        const method = stream ? 'streamGenerateContent' : 'generateContent';
        url = `${context.baseUrl}/api/proxy/google/models/${modelId}:${method}`;
        body = {
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: maxTokens }
        };
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    let text = '';
    let usage = {};
    let timeToFirstToken = null;

    if (stream) {
        // Basic SSE consumer for Node.js fetch (async iterator on body)
        // Note: This requires Node 18+ web streams or node-fetch compatible stream
        const reader = response.body.getReader ? response.body.getReader() : null;

        if (!reader && response.body[Symbol.asyncIterator]) {
            // Node.js native fetch body is async iterable
            for await (const chunk of response.body) {
                const decoded = new TextDecoder().decode(chunk);
                if (!timeToFirstToken) timeToFirstToken = performance.now() - startTime;

                // Very rough parsing just to verify content flow
                // Real apps need a robust parser (eventsource-parser), but here we just accumulating text
                // to prove we got something.
                // We won't reconstruct perfectly due to chunk boundaries splitting JSON, 
                // but we can check if we got *some* data.
                if (provider === 'google') {
                    // Google sends valid JSON array chunks usually, or SSE?
                    // The proxy pipes it. Let's assume it's roughly readable.
                    text += decoded;
                } else {
                    // OpenAI/Anthropic send "data: {...}"
                    const lines = decoded.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                            try {
                                const json = JSON.parse(line.slice(6));
                                if (provider === 'openai') text += (json.choices?.[0]?.delta?.content || '');
                                if (provider === 'anthropic' && json.type === 'content_block_delta') text += (json.delta?.text || '');
                                // Note: Anthropic SSE format is complex (events), this is simplified check.
                            } catch (e) { }
                        }
                    }
                }
            }
        } else if (response.body && response.body.on) {
            // Node.js Readable stream (older node or node-fetch)
            await new Promise((resolve, reject) => {
                response.body.on('data', chunk => {
                    if (!timeToFirstToken) timeToFirstToken = performance.now() - startTime;
                    const decoded = new TextDecoder().decode(chunk);

                    if (provider === 'google') {
                        text += decoded;
                    } else {
                        const lines = decoded.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const json = JSON.parse(line.slice(6));
                                    if (provider === 'openai') text += (json.choices?.[0]?.delta?.content || '');
                                    if (provider === 'anthropic' && json.type === 'content_block_delta') text += (json.delta?.text || '');
                                } catch (e) { }
                            }
                        }
                    }
                });
                response.body.on('end', resolve);
                response.body.on('error', reject);
            });
        } else {
            // Fallback
            text = "(Stream consumed but body iteration not supported in this JS env: type=" + (response.body?.constructor?.name) + ")";
        }
    } else {
        const data = await response.json();

        // Extract text based on provider
        if (provider === 'openai') {
            text = data.choices?.[0]?.message?.content || '';
            usage = data.usage || {};
        } else if (provider === 'anthropic') {
            text = data.content?.[0]?.text || '';
            usage = data.usage || {};
        } else if (provider === 'google') {
            text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            usage = {
                prompt_tokens: data.usageMetadata?.promptTokenCount,
                completion_tokens: data.usageMetadata?.candidatesTokenCount
            };
        }
    }

    const latency = performance.now() - startTime;

    return {
        model: modelId,
        provider,
        status: 'success',
        mode: stream ? 'streaming' : 'non-streaming',
        latency_ms: Math.round(latency),
        ttft_ms: timeToFirstToken ? Math.round(timeToFirstToken) : null,
        ttft_ms: timeToFirstToken ? Math.round(timeToFirstToken) : null,
        response_length: text.length,
        text: text,
        snippet: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        usage
    };
}
