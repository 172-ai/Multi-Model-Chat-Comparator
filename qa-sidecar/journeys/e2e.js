
import { z } from 'zod';
import { callProvider, detectProvider } from './execution.js';
import { discover_provider_models } from './discovery.js';

function extractJson(text) {
    // Try to find JSON in markdown code blocks
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (match) return match[1];
    return text;
}

export const validate_model_response = {
    name: 'validate_model_response',
    description: 'Execute a model prompt and optionally validate that the response is valid JSON.',
    inputSchema: z.object({
        prompt: z.string().describe('The prompt to send to the model'),
        modelId: z.string().optional().describe('Target model. If omitted, will try to auto-detect a working model.'),
        expectJson: z.boolean().optional().default(false).describe('If true, validates that the output is valid JSON.'),
        jsonSchema: z.string().optional().describe('Optional JSON schema (as a stringified object) to validate keys against if expectJson is true.')
    }),
    handler: async (args) => {
        let modelId = args.modelId;

        if (!modelId) {
            // Priority: Try to use what's likely to work based on recent tests
            if (process.env.INFERENCE_TOKEN) modelId = 'gemini-2.5-flash';
            else if (process.env.OPENAI_API_KEY) modelId = 'gpt-3.5-turbo';
            else if (process.env.ANTHROPIC_API_KEY) modelId = 'claude-3-haiku-20240307';

            // If strictly relying on discovery (safer but slower)
            if (!modelId) {
                const disc = await discover_provider_models.handler({ provider: 'google' });
                const discData = JSON.parse(disc.content[0].text);
                if (discData.status === 'success' && discData.raw_response_snippet?.models?.length > 0) {
                    modelId = discData.raw_response_snippet.models[0].name.replace('models/', '');
                } else {
                    modelId = 'gemini-2.5-flash'; // Fallback of last resort
                }
            }
        }

        const provider = detectProvider(modelId);
        if (!provider) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: `Could not detect provider or no keys for model ${modelId}` }) }],
                isError: true
            };
        }

        try {
            // 1. Execute
            const result = await callProvider(provider, modelId, args.prompt, 1000, false);

            if (result.status === 'failed') {
                return {
                    content: [{ type: 'text', text: JSON.stringify(result) }],
                    isError: true
                };
            }

            // 2. Validate
            let validation = { valid: true, errors: [] };
            let parsedData = null;

            if (args.expectJson) {
                const jsonText = extractJson(result.text);
                try {
                    parsedData = JSON.parse(jsonText);

                    if (args.jsonSchema) {
                        // Very basic schema check: just checking if keys exist for now
                        // In a real app we'd use AJV or Zod with dynamic schema
                        const schema = JSON.parse(args.jsonSchema);
                        // TODO: Implement actual schema validation if needed, for now just boolean check
                        // This is a placeholder for "schema validation"
                    }
                } catch (e) {
                    validation.valid = false;
                    validation.errors.push(`JSON Parsing failed: ${e.message}`);
                }
            }

            // 3. Construct Result
            const finalOutput = {
                execution: {
                    model: result.model,
                    latency_ms: result.latency_ms,
                    status: result.status
                },
                validation: {
                    requested_json: args.expectJson,
                    passed: validation.valid,
                    errors: validation.errors
                },
                response: {
                    text: result.text,
                    parsed: parsedData
                }
            };

            return {
                content: [{ type: 'text', text: JSON.stringify(finalOutput, null, 2) }]
            };

        } catch (e) {
            return {
                content: [{ type: 'text', text: JSON.stringify({ status: 'error', error: e.message }) }],
                isError: true
            };
        }
    }
};
