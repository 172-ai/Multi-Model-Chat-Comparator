# Multi-Model LLM Comparator

A modern web application that allows you to submit a single prompt and compare responses from multiple LLM APIs simultaneously. Features real-time latency tracking, token cost estimation, and comprehensive JSON export capabilities.

![Multi-Model LLM Comparator](https://img.shields.io/badge/Status-Ready-success)

## ✨ Features

- **Multi-Model Comparison**: Submit one prompt and get responses from multiple AI models simultaneously
- **Supported Providers**:
  - OpenAI (GPT-4 Turbo, GPT-4o, GPT-3.5 Turbo, and more)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - Google (Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini Pro)
- **Dynamic Model Discovery**: Models are fetched from each provider's API automatically
- **Dynamic Pricing**: Cost estimates fetched from OpenRouter API (cached 24h)
- **Real-Time Metrics**:
  - Response latency tracking
  - Token usage (input/output/total)
  - Estimated cost per request (real-time pricing)
  - Model context window information
- **Configurable Parameters**:
  - Temperature (0-1)
  - Max Tokens
- **Modern UI**:
  - Dark theme with glassmorphism effects
  - Synchronized card layout
  - Smooth animations and transitions
  - Responsive design
  - Auto-selection of default models
- **Export Functionality**: Download complete comparison data as JSON
- **Persistent Settings**: API keys and model preferences saved locally

## 🚀 Quick Start

### Prerequisites

You'll need API keys from at least one of the following providers:

- [OpenAI API Key](https://platform.openai.com/api-keys)
- [Anthropic API Key](https://console.anthropic.com/)
- [Google AI API Key](https://makersuite.google.com/app/apikey)

### Installation

1. Clone or download this repository
2. Open `index.html` in a modern web browser, or serve it using a local web server

**Using Python:**

```bash
python -m http.server 8000
```

**Using Node.js:**

```bash
npx http-server
```

Then navigate to `http://localhost:8000` (or the appropriate port).

### Configuration

1. Click the ⚙️ settings button in the top-right corner
2. Enter your API keys for the providers you want to use
3. Select which models you want to compare
4. Click "Save Settings"

Your settings will be saved in your browser's localStorage.

## 🐳 Docker Deployment

### Quick Start with Docker

The easiest way to run the application is using Docker:

**Using Docker Compose (Recommended):**

```bash
# Build and start the container
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

**Using Docker directly:**

```bash
# Build the image
docker build -t multi-model-chat-comparator .

# Run the container with environment variables
docker run -d \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your-key-here \
  -e ANTHROPIC_API_KEY=your-key-here \
  -e INFERENCE_TOKEN=your-key-here \
  --name llm-comparator \
  multi-model-chat-comparator
```

### Environment Variables for Docker

You can provide API keys in three ways:

1. **Inline** (as shown above)
2. **Environment file**: Create a `.env` file based on `.env.example`
3. **Via Settings UI**: Configure keys after starting the container

Example `.env` file for docker-compose:

```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
INFERENCE_TOKEN=your-google-api-key
```

Then run: `docker-compose --env-file .env up -d`

### Accessing the Application

Once running, navigate to:

- **Local**: <http://localhost:3000>
- **Network**: http://YOUR_SERVER_IP:3000

## 📖 Usage

1. **Enter a Prompt**: Type your question or prompt in the text area
2. **Submit**: Click "Compare Models" or press Ctrl/Cmd + Enter
3. **View Results**: Responses will appear in synchronized cards with metrics
4. **Export**: Click "Export to JSON" to download the complete comparison data

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Submit prompt
- `Esc`: Close settings panel

## 💰 Cost Estimation

**Important**: Each prompt submission triggers API calls to all selected models simultaneously. This can result in costs across multiple providers.

### Dynamic Pricing (NEW!)

Pricing is now fetched automatically from [OpenRouter API](https://openrouter.ai/api/v1/models) and cached for 24 hours. This ensures you always see up-to-date cost estimates for all models, including newly released ones.

The app displays estimated costs for each response to help you track usage.

## 📊 Export Format

The JSON export includes:

- Original prompt
- All model responses
- Detailed metrics (latency, tokens, costs)
- Model metadata
- Timestamps
- Summary statistics

Example export structure:

```json
{
  "exportedAt": "2024-01-01T12:00:00.000Z",
  "prompt": "Your prompt here",
  "responses": [
    {
      "model": "GPT-4 Turbo",
      "provider": "openai",
      "response": "Model response text...",
      "metrics": {
        "latency": 1234,
        "inputTokens": 10,
        "outputTokens": 50,
        "totalTokens": 60,
        "estimatedCost": 0.002
      },
      "metadata": {
        "contextWindow": 128000,
        "timestamp": "2024-01-01T12:00:00.000Z"
      }
    }
  ],
  "summary": {
    "totalModels": 6,
    "successfulResponses": 6,
    "failedResponses": 0,
    "totalCost": 0.015,
    "averageLatency": 1500
  }
}
```

## 🔒 Security & Privacy

- **API Keys**: Stored locally in your browser's localStorage
- **Backend Proxy**: All API calls routed through Node.js server to secure keys
- **No Data Collection**: Your prompts and responses are never sent to any third-party servers (except the LLM providers)
- **Structured Logging**: Cloud-ready JSON logging for production environments

## 🛠️ Technical Details

### Architecture

- **Node.js Backend**: Express server with API proxy for secure key management
- **ES6 Modules**: Modern JavaScript with no build process required
- **Modular Design**: Separate components for UI, API providers, and utilities
- **Dynamic Discovery**: Models fetched from provider APIs
- **Dynamic Pricing**: Cost data from OpenRouter API with 24h caching
- **Responsive**: Works on desktop and mobile devices
- **Modern CSS**: Custom properties, glassmorphism, animations

### Browser Compatibility

Requires a modern browser with support for:

- ES6 Modules
- Fetch API
- CSS Custom Properties
- CSS Backdrop Filter

Tested on:

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## 📝 License

This project is open source and available for personal and commercial use.

## 🤝 Contributing

Contributions are welcome! Feel free to:

- Add support for additional LLM providers
- Improve the UI/UX
- Add new features
- Fix bugs

## 📧 Support

For issues or questions, please open an issue in the repository.

---

**Built with ❤️ for the AI community**
