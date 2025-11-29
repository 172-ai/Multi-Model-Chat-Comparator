# Multi-Model LLM Comparator

A modern web application that allows you to submit a single prompt and compare responses from multiple LLM APIs simultaneously. Features real-time latency tracking, token cost estimation, and comprehensive JSON export capabilities.

![Multi-Model LLM Comparator](https://img.shields.io/badge/Status-Ready-success)

## ✨ Features

- **Multi-Model Comparison**: Submit one prompt and get responses from multiple AI models simultaneously
- **Supported Providers**:
  - OpenAI (GPT-4 Turbo, GPT-4, GPT-3.5 Turbo)
  - Anthropic (Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku)
  - Google (Gemini 1.5 Pro, Gemini 1.5 Flash)
- **Real-Time Metrics**:
  - Response latency tracking
  - Token usage (input/output/total)
  - Estimated cost per request
  - Model context window information
- **Modern UI**:
  - Dark theme with glassmorphism effects
  - Synchronized card layout
  - Smooth animations and transitions
  - Responsive design
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

## 📖 Usage

1. **Enter a Prompt**: Type your question or prompt in the text area
2. **Submit**: Click "Compare Models" or press Ctrl/Cmd + Enter
3. **View Results**: Responses will appear in synchronized cards with metrics
4. **Export**: Click "Export to JSON" to download the complete comparison data

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter`: Submit prompt
- `Esc`: Close settings panel

## 💰 Cost Considerations

**Important**: Each prompt submission triggers API calls to all selected models simultaneously. This can result in costs across multiple providers. Current pricing (as of implementation):

| Model | Input (per 1K tokens) | Output (per 1K tokens) |
|-------|----------------------|------------------------|
| GPT-4 Turbo | $0.01 | $0.03 |
| GPT-4 | $0.03 | $0.06 |
| GPT-3.5 Turbo | $0.0005 | $0.0015 |
| Claude 3.5 Sonnet | $0.003 | $0.015 |
| Claude 3 Opus | $0.015 | $0.075 |
| Claude 3 Haiku | $0.00025 | $0.00125 |
| Gemini 1.5 Pro | $0.00125 | $0.005 |
| Gemini 1.5 Flash | $0.000075 | $0.0003 |

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
- **No Backend**: All API calls are made directly from your browser
- **No Data Collection**: Your prompts and responses are never sent to any third-party servers
- **Client-Side Only**: Everything runs in your browser

⚠️ **Note**: For production use, consider implementing a backend proxy to secure API keys and add rate limiting.

## 🛠️ Technical Details

### Architecture

- **Pure JavaScript**: No build process required, uses ES6 modules
- **Modular Design**: Separate components for UI, API providers, and utilities
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
