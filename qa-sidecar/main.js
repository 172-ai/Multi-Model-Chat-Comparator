
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import dotenv from 'dotenv';

// Import Journeys
import { initialize_qa_session } from './journeys/setup.js';
import { check_system_health } from './journeys/health.js';
import { discover_provider_models } from './journeys/discovery.js';
import { run_comparison_test } from './journeys/execution.js';
import { verify_pricing_accuracy, audit_export_format } from './journeys/validation.js';

dotenv.config();

// Tool Registry
const tools = [
    initialize_qa_session,
    check_system_health,
    discover_provider_models,
    run_comparison_test,
    verify_pricing_accuracy,
    audit_export_format
];

const server = new Server(
    {
        name: "qa-sidecar",
        version: "1.0.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

// List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: tools.map((tool) => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.inputSchema),
        })),
    };
});

// Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((t) => t.name === request.params.name);

    if (!tool) {
        throw new Error(`Tool not found: ${request.params.name}`);
    }

    // Zod validation
    const args = tool.inputSchema.parse(request.params.arguments);
    return await tool.handler(args);
});

// Transport Setup
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("QA Sidecar MCP Server running on stdio");
