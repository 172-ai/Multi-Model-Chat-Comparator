import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.get('/api/env', (req, res) => {
    res.json({
        openai: process.env.OPENAI_API_KEY || null,
        anthropic: process.env.ANTHROPIC_API_KEY || null,
        google: process.env.INFERENCE_TOKEN || null
    });
});

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

app.all('/api/proxy/google/*', async (req, res) => {
    const path = req.params[0];
    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (!apiKey) return res.status(401).json({ error: { message: 'API key required' } });

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/${path}${req.method === 'GET' ? `?key=${apiKey}` : ''}`;
        const response = await fetch(url, {
            method: req.method,
            headers: { 'Content-Type': 'application/json' },
            body: req.method !== 'GET' ? JSON.stringify({ ...req.body, key: undefined }) : undefined
        });

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
        res.status(500).json({ error: { message: error.message } });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`🚀 Multi-Model Chat Comparator server running on http://localhost:${PORT}`);
    console.log(`📝 Environment variables loaded:`);
    console.log(`   - OpenAI API Key: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Anthropic API Key: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`   - Google API Key (INFERENCE_TOKEN): ${process.env.INFERENCE_TOKEN ? '✓ Set' : '✗ Not set'}`);
    console.log(`\n✨ API proxy enabled - all requests will be routed through this server`);
});
