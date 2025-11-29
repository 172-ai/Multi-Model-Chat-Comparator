import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// API endpoint to provide environment variables to frontend
app.get('/api/env', (req, res) => {
    res.json({
        openai: process.env.OPENAI_API_KEY || null,
        anthropic: process.env.ANTHROPIC_API_KEY || null,
        google: process.env.INFERENCE_TOKEN || null
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Multi-Model Chat Comparator server running on http://localhost:${PORT}`);
    console.log(`📝 Environment variables loaded:`);
    console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Google API Key (INFERENCE_TOKEN): ${process.env.INFERENCE_TOKEN ? '✓ Set' : '✗ Not set'}`);
});
