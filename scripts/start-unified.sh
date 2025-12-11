#!/bin/sh

# Unified Startup Script for QA Sidecar + Web App
# Usage: ./scripts/start-unified.sh

# Function to cleanup background processes on exit
cleanup() {
    echo "[Unified] Shutting down..." >&2
    kill $(jobs -p) 2>/dev/null
}

# Trap signals
trap cleanup EXIT INT TERM

echo "[Unified] Starting Main Web App (background)..." >&2
# Start server.js in background. Redirect ALL output to stderr to keep stdout clean for MCP
node server.js >&2 2>&2 &

# Wait for App to be ready (simple delay, could be improved with wait-on)
echo "[Unified] Waiting for Web App to initialize..." >&2
sleep 5

echo "[Unified] Starting QA Sidecar (foreground)..." >&2
# Run the Sidecar. Its stdout/stdin will be connected to the container/shell stdio
# This allows MCP clients to communicate with it directly
node qa-sidecar/main.js
