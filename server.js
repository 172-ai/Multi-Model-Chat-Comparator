import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Logger } from './utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/env', (req, res) => {
    Logger.info('API', 'Fetching environment config');
    res.json({
        openai: process.env.OPENAI_API_KEY || null,
        anthropic: process.env.ANTHROPIC_API_KEY || null,
        google: process.env.INFERENCE_TOKEN || null
    });
});

// OpenAI proxy - GET for listing models
app.get('/api/proxy/openai/models', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        const response = await fetch('https://api.openai.com/v1/models', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${apiKey}` }
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// OpenAI proxy - POST for chat completions
app.post('/api/proxy/openai/*', async (req, res) => {
    const path = req.params[0];
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        const url = `https://api.openai.com/v1/${path}`;
        const response = await fetch(url, {
            method: req.method,
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        if (req.body?.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
            }
            res.end();
        } else {
            const data = await response.json();
            res.status(response.status).json(data);
        }
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// Anthropic proxy - GET for listing models (not officially supported, return empty)
app.get('/api/proxy/anthropic/models', async (req, res) => {
    // Anthropic doesn't have a public models list endpoint
    // Return a predefined list of known models
    res.json({
        data: [
            { id: 'claude-3-5-sonnet-20241022', type: 'model' },
            { id: 'claude-3-5-sonnet-20240620', type: 'model' },
            { id: 'claude-3-opus-20240229', type: 'model' },
            { id: 'claude-3-sonnet-20240229', type: 'model' },
            { id: 'claude-3-haiku-20240307', type: 'model' }
        ]
    });
});

// Anthropic proxy - POST for messages
app.post('/api/proxy/anthropic/*', async (req, res) => {
    const path = req.params[0];
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        const url = `https://api.anthropic.com/v1/${path}`;
        const response = await fetch(url, {
            method: req.method,
            headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
            body: JSON.stringify(req.body)
        });

        // Check for error response before streaming
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
            return res.status(response.status).json(errorData);
        }

        if (req.body?.stream) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    res.write(decoder.decode(value, { stream: true }));
                }
                res.end();
            } catch (streamError) {
                console.error('Streaming error:', streamError);
                // Send error event in SSE format
                res.write(`data: ${JSON.stringify({ type: 'error', error: { message: 'Stream interrupted: ' + streamError.message } })}\n\n`);
                res.end();
            }
        } else {
            const data = await response.json();
            res.status(response.status).json(data);
        }
    } catch (error) {
        Logger.error('API', 'Anthropic proxy error', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

// Google proxy - GET for listing models
app.get('/api/proxy/google/models', async (req, res) => {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, {
            method: 'GET'
        });

        const data = await response.json();
        res.status(response.status).json(data);
    } catch (error) {
        res.status(500).json({ error: { message: error.message } });
    }
});

// Google proxy - POST for content generation
app.post('/api/proxy/google/*', async (req, res) => {
    const path = req.params[0];
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        // Google requires API key as query parameter, not in body
        const url = `https://generativelanguage.googleapis.com/v1beta/${path}?key=${apiKey}`;
        Logger.info('API', `Google request to ${path}`);

        const response = await fetch(url, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
        });

        Logger.info('API', `Google response status: ${response.status}`);

        // Check for error response before streaming
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
            return res.status(response.status).json(errorData);
        }

        if (path.includes('streamGenerateContent')) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
            }
            res.end();
        } else {
            const data = await response.json();
            res.status(response.status).json(data);
        }
    } catch (error) {
        Logger.error('API', 'Google proxy error', error);
        res.status(500).json({ error: { message: error.message } });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 404 Handler - Must be AFTER all valid API routes
// This ensures API requests to unknown endpoints return JSON, not HTML
app.all('/api/*', (req, res) => {
    Logger.warn('API', `404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: { message: 'API endpoint not found' } });
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    Logger.info('SYSTEM', `Server running on http://localhost:${PORT}`);
    Logger.info('SYSTEM', 'Environment Config', {
        openai: !!process.env.OPENAI_API_KEY,
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        google: !!process.env.INFERENCE_TOKEN
    });
    console.log(`🚀 Multi-Model Chat Comparator server running on http://localhost:${PORT}`);
    // Keep visible console logs for local dev convenience
    console.log(`📝 Environment variables loaded:`);
    console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Google API Key (INFERENCE_TOKEN): ${process.env.INFERENCE_TOKEN ? '✓ Set' : '✗ Not set'}`);
    console.log(`\n✨ API proxy enabled - all requests will be routed through this server`);
});
