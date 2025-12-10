
import { z } from 'zod';
import { context } from '../context.js';

export const discover_provider_models = {
    name: 'discover_provider_models',
    description: 'Discover available models for a specific AI provider via the backend proxy.',
    inputSchema: z.object({
        provider: z.enum(['openai', 'anthropic', 'google']).describe('The AI provider to query')
    }),
    handler: async (args) => {
        const apiKey = context.getApiKey(args.provider);

        if (!apiKey) {
            return {
                content: [{ type: 'text', text: `Error: No API key configured for ${args.provider}. Use initialize_qa_session first.` }],
                isError: true
            };
        }

        try {
            const url = `${context.baseUrl}/api/proxy/${args.provider}/models`;
            console.log(`[Discovery] Fetching ${url}`);

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'x-api-key': apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Normalize specific provider formats just for display/count
            let count = 0;
            if (args.provider === 'openai') count = data.data?.length;
            if (args.provider === 'google') count = data.models?.length || data.length; // Google proxy might already reshape? No, it returns raw.
            // Wait, server.js Google proxy returns `response.json()` which is `{ models: [] }` usually.
            if (args.provider === 'anthropic') count = data.data?.length || data.length;

            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            provider: args.provider,
                            status: 'success',
                            model_count: count,
                            raw_response_snippet: data
                        }, null, 2)
                    }
                ]
            };
        } catch (error) {
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            provider: args.provider,
                            status: 'error',
                            error: error.message
                        }, null, 2)
                    }
                ],
                isError: true
            };
        }
    }
};
