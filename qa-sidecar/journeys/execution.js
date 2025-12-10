
import { z } from 'zod';
import { context } from '../context.js';

export const run_comparison_test = {
    name: 'run_comparison_test',
    description: 'Run a chat comparison test against multiple models.',
    inputSchema: z.object({
        prompt: z.string().describe('The prompt to send to the models'),
        models: z.array(z.string()).describe('List of model IDs to test (e.g. ["gpt-4", "claude-3-opus-20240229"])'),
        max_tokens: z.number().optional().default(100)
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

                const result = await callProvider(provider, modelId, args.prompt, args.max_tokens);
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

function detectProvider(modelId) {
    if (modelId.startsWith('gpt') || modelId.startsWith('o1-')) return 'openai';
    if (modelId.startsWith('claude')) return 'anthropic';
    if (modelId.startsWith('gemini')) return 'google';
    return null;
}

async function callProvider(provider, modelId, prompt, maxTokens) {
    const apiKey = context.getApiKey(provider);
    if (!apiKey) throw new Error(`No API key for ${provider}`);

    let url, body;
    const startTime = performance.now();

    if (provider === 'openai') {
        url = `${context.baseUrl}/api/proxy/openai/chat/completions`;
        body = {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens
        };
    } else if (provider === 'anthropic') {
        url = `${context.baseUrl}/api/proxy/anthropic/messages`;
        body = {
            model: modelId,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens
        };
    } else if (provider === 'google') {
        url = `${context.baseUrl}/api/proxy/google/models/${modelId}:generateContent`;
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

    const latency = performance.now() - startTime;

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
    }

    const data = await response.json();

    // Extract text based on provider
    let text = '';
    let usage = {};

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

    return {
        model: modelId,
        provider,
        status: 'success',
        latency_ms: Math.round(latency),
        response_length: text.length,
        snippet: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        usage
    };
}
