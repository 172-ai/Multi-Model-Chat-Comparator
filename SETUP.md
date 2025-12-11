# Multi-Model Chat Comparator - Phase 2 Setup Instructions

## Prerequisites

You need to fix an npm permission issue before installing dependencies.

## Fix NPM Permission Issue

Run this command to fix the npm cache permissions:

```bash
sudo chown -R $(whoami) ~/.npm
```

## Install Dependencies

After fixing permissions, install the required Node.js packages:

```bash
cd /Users/yevgeniy.leybzon/Documents/Multi-Model-Chat-Comparator/Multi-Model-Chat-Comparator
npm install
```

This will install:

- `express` - Web server
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable loading

## Configure Environment Variables (Optional)

Create a `.env` file in the project root with your API keys:

```bash
cp .env.example .env
```

Then edit `.env` and add your API keys:

```
OPENAI_API_KEY=sk-your-key-here
ANTHROPIC_API_KEY=sk-ant-your-key-here
INFERENCE_TOKEN=your-google-key-here
```

**Note**: If you don't set environment variables, you can still enter API keys manually in the settings panel.

## Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000`

## Usage

1. Open `http://localhost:3000` in your browser
2. Click the settings button (⚙️) in the top right
3. Enter your API keys (or they'll be pre-filled from environment variables)
4. The app will automatically fetch available models from each provider
5. Select which models you want to compare
6. Click "Save Settings"
7. Enter a prompt and click "Send"
8. Watch as responses stream in real-time from all selected models!

## Features

- **Dynamic Model Discovery**: Models are fetched from each provider's API
- **Streaming Responses**: See responses appear in real-time
- **Enhanced Error Handling**: Clear error messages with actionable suggestions
- **API Key Validation**: Visual feedback when API keys are valid/invalid
- **Environment Variable Support**: Auto-load API keys from .env file
- **Only Selected Models**: Main screen shows only the models you've selected

## Unified QA Deployment (172.ai)

To deploy the application with the QA Sidecar enabled in a single container (or process):

### Option A: Run Locally (No Docker)

This runs both the Web App (background) and QA Sidecar (foreground) on your machine.

```bash
./scripts/start-unified.sh
```

* **Web App**: `http://localhost:3000`
- **Qa Sidecar**: Hooks into your terminal's stdio (for MCP clients).

### Option B: Run via Docker (Unified Container)

This builds and runs the unified container locally for testing.

```bash
# Build
docker build -f Dockerfile.qa -t qa-sidecar-unified .

# Run
docker run -p 3000:3000 qa-sidecar-unified
```
