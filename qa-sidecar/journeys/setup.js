
import { z } from 'zod';
import { context } from '../context.js';

export const initialize_qa_session = {
    name: 'initialize_qa_session',
    description: 'Initialize a new QA session, setting the environment and API keys context.',
    inputSchema: z.object({
        environment: z.enum(['local', 'staging', 'production']).default('local').describe('Target environment for testing'),
        keys: z.object({
            openai: z.string().optional(),
            anthropic: z.string().optional(),
            google: z.string().optional()
        }).optional().describe('API keys to use for this session (overrides env vars)')
    }),
    handler: async (args) => {
        const status = context.initialize(args.environment, args.keys);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(status, null, 2)
                }
            ]
        };
    }
};
