
import { z } from 'zod';
import { context } from '../context.js';

export const check_system_health = {
    name: 'check_system_health',
    description: 'Verify that the backend API is reachable and healthy.',
    inputSchema: z.object({}),
    handler: async (args) => {
        try {
            const url = `${context.baseUrl}/api/health`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Health check failed with status: ${response.status}`);
            }

            const data = await response.json();
            return {
                content: [
                    {
                        type: 'text',
                        text: JSON.stringify({
                            status: 'ok',
                            endpoint: url,
                            data: data
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
                            status: 'error',
                            endpoint: `${context.baseUrl}/api/health`,
                            error: error.message
                        }, null, 2)
                    }
                ],
                isError: true
            };
        }
    }
};
