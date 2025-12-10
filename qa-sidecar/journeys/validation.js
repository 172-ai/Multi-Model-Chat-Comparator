
import { z } from 'zod';
import { Metrics } from '../../api/metrics.js';
import { Exporter } from '../../utils/export.js';
import { pricingService } from '../../api/pricing-service.js';

// Ensure PricingService has data (it fetches on demand, but we can force it)
// We might need to wait for it.

export const verify_pricing_accuracy = {
    name: 'verify_pricing_accuracy',
    description: 'Verify the accuracy of cost calculations against the logic in Metrics and PricingService.',
    inputSchema: z.object({
        modelId: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number()
    }),
    handler: async (args) => {
        // Force cache refresh to ensure we have data
        await pricingService.fetchAllModels();
        const pricing = await pricingService.getPricing(args.modelId);

        if (!pricing) {
            return {
                content: [{ type: 'text', text: `Error: No pricing found for model ${args.modelId}` }],
                isError: true
            };
        }

        const calculatedCost = Metrics.calculateCost(pricing, args.inputTokens, args.outputTokens);

        // Expected logic (Re-implemented for "QA" verification)
        const expectedInputCost = (args.inputTokens / 1000) * pricing.input;
        const expectedOutputCost = (args.outputTokens / 1000) * pricing.output;
        const expectedTotal = expectedInputCost + expectedOutputCost;

        const match = Math.abs(calculatedCost - expectedTotal) < 0.0000001;

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        model: args.modelId,
                        pricing_used: pricing,
                        inputs: { input: args.inputTokens, output: args.outputTokens },
                        system_calculation: calculatedCost,
                        qa_calculation: expectedTotal,
                        match: match
                    }, null, 2)
                }
            ]
        };
    }
};

export const audit_export_format = {
    name: 'audit_export_format',
    description: 'Audit the structure of the export JSON artifact.',
    inputSchema: z.object({
        mockData: z.any().optional().describe('Optional override data to test specific edge cases')
    }),
    handler: async (args) => {
        const mockInput = args.mockData || {
            prompt: "Test Prompt",
            responses: [
                {
                    model: "gpt-4-test",
                    provider: "openai",
                    text: "Test Response",
                    latency: 100,
                    inputTokens: 10,
                    outputTokens: 10,
                    totalTokens: 20,
                    estimatedCost: 0.001,
                    contextWindow: 8192,
                    timestamp: new Date().toISOString(),
                    rawApiRequest: { debug: true },
                    rawApiResponse: { debug: true }
                }
            ]
        };

        // Use the actual App logic to generate the schema
        const exportedData = Exporter.exportToJSON(mockInput);

        // Validate Schema (Zod)
        const exportSchema = z.object({
            exportedAt: z.string(),
            prompt: z.string(),
            responses: z.array(z.object({
                model: z.string(),
                provider: z.string(),
                response: z.string(),
                metrics: z.object({
                    latency: z.number(),
                    estimatedCost: z.number()
                }),
                rawApiRequest: z.any().optional(),
                rawApiResponse: z.any().optional()
            })),
            summary: z.object({
                totalModels: z.number(),
                totalCost: z.number()
            })
        });

        const validation = exportSchema.safeParse(exportedData);

        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify({
                        valid: validation.success,
                        errors: validation.success ? [] : validation.error.errors,
                        generated_artifact: exportedData
                    }, null, 2)
                }
            ]
        };
    }
};
