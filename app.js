// Main Application with streaming support and dynamic models
import { ProviderFactory } from './api/providers.js';
import { Storage } from './utils/storage.js';
import { Exporter } from './utils/export.js';
import { PromptInput } from './components/prompt-input.js';
import { ModelCard } from './components/model-card.js';
import { SettingsPanel } from './components/settings-panel.js';

class App {
    constructor() {
        this.promptInput = new PromptInput();
        this.settingsPanel = new SettingsPanel();
        this.modelsGrid = document.getElementById('modelsGrid');
        this.exportSection = document.getElementById('exportSection');
        this.exportBtn = document.getElementById('exportBtn');

        this.currentResults = null;
        this.modelCards = new Map();
        this.currentPrompt = '';

        this.init();
    }

    async init() {
        // Set up event listeners
        this.promptInput.onSubmit((prompt) => this.handleSubmit(prompt));
        this.exportBtn.addEventListener('click', () => this.handleExport());

        // Listen for settings updates
        window.addEventListener('settingsUpdated', (e) => {
            this.updateModelCards(e.detail?.availableModels);
        });

        // Listen for retry events
        window.addEventListener('retryModel', (e) => {
            this.retryModel(e.detail.modelId);
        });

        // Wait for settings panel to initialize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Initialize model cards
        this.updateModelCards();

        // Check if API keys are configured
        this.checkApiKeys();
    }

    checkApiKeys() {
        const apiKeys = Storage.getAllApiKeys();
        const hasAnyKey = apiKeys.openai || apiKeys.anthropic || apiKeys.google;

        if (!hasAnyKey) {
            // Show settings panel if no API keys are configured
            setTimeout(() => {
                this.settingsPanel.open();
            }, 500);
        }
    }

    updateModelCards(availableModels) {
        // Clear existing cards
        this.modelsGrid.innerHTML = '';
        this.modelCards.clear();

        // Get enabled models
        const enabledModelIds = this.settingsPanel.getEnabledModels();

        if (enabledModelIds.length === 0) {
            this.modelsGrid.innerHTML = `
                <div class="no-models-message">
                    <p>No models selected</p>
                    <button id="selectModelsBtn" class="primary-btn">Select Models</button>
                    <p class="sub-text">Configure API keys and models in settings to get started</p>
                </div>
            `;

            // Add listener to the dynamic button
            const btn = document.getElementById('selectModelsBtn');
            if (btn) {
                btn.addEventListener('click', () => this.settingsPanel.open());
            }
            return;
        }

        // Get available models metadata
        const availableModelsData = availableModels || this.settingsPanel.getAvailableModels();

        // Combine all models
        const allModels = [
            ...(availableModelsData.openai || []),
            ...(availableModelsData.anthropic || []),
            ...(availableModelsData.google || [])
        ];

        // Create cards only for enabled models
        enabledModelIds.forEach(modelId => {
            const modelConfig = allModels.find(m => m.id === modelId);
            if (modelConfig) {
                const card = new ModelCard(modelConfig);
                this.modelCards.set(modelId, card);
                this.modelsGrid.appendChild(card.getElement());
            }
        });

        // Show grid
        this.modelsGrid.style.display = this.modelCards.size > 0 ? 'grid' : 'none';
    }

    async handleSubmit(prompt) {
        this.currentPrompt = prompt;

        // Disable input during processing
        this.promptInput.setDisabled(true);
        this.exportSection.classList.add('hidden');

        // Get API keys
        const apiKeys = Storage.getAllApiKeys();

        // Validate at least one API key is present
        if (!apiKeys.openai && !apiKeys.anthropic && !apiKeys.google) {
            alert('Please configure at least one API key in settings.');
            this.promptInput.setDisabled(false);
            this.settingsPanel.open();
            return;
        }

        // Set all cards to streaming state
        this.modelCards.forEach(card => card.setStreaming());

        // Execute requests with streaming (if enabled)
        const streamingEnabled = Storage.getStreamingEnabled();
        const results = [];
        const promises = [];

        this.modelCards.forEach((card, modelId) => {
            const modelConfig = card.getModelConfig();
            const apiKey = apiKeys[modelConfig.provider];

            // Create streaming callback only if streaming is enabled
            const onChunk = streamingEnabled ? (chunk) => {
                card.appendStreamChunk(chunk);
            } : null;

            // Execute request
            const params = Storage.getModelParams();
            const options = {
                temperature: params.temperature,
                maxTokens: params.maxTokens
            };

            const promise = ProviderFactory.executeRequest(
                modelConfig,
                prompt,
                apiKey,
                options,
                onChunk
            ).then(result => {
                card.setResponse(result);
                results.push(result);
                return result;
            });

            promises.push(promise);
        });

        try {
            await Promise.all(promises);

            // Store results for export
            this.currentResults = {
                prompt,
                responses: results,
                timestamp: new Date().toISOString()
            };

            // Save to history
            Storage.addToHistory(this.currentResults);

            // Show export button
            this.exportSection.classList.remove('hidden');

        } catch (error) {
            console.error('Error executing requests:', error);
            alert('An error occurred while processing your request. Please try again.');
        } finally {
            // Re-enable input
            this.promptInput.setDisabled(false);
        }
    }

    async retryModel(modelId) {
        const card = this.modelCards.get(modelId);
        if (!card || !this.currentPrompt) return;

        const modelConfig = card.getModelConfig();
        const apiKeys = Storage.getAllApiKeys();
        const apiKey = apiKeys[modelConfig.provider];

        if (!apiKey) {
            alert(`Please configure your ${modelConfig.provider} API key in settings.`);
            return;
        }

        // Set card to streaming state
        card.setStreaming();

        // Create streaming callback
        const onChunk = (chunk) => {
            card.appendStreamChunk(chunk);
        };

        try {
            const params = Storage.getModelParams();
            const options = {
                temperature: params.temperature,
                maxTokens: params.maxTokens
            };

            const result = await ProviderFactory.executeRequest(
                modelConfig,
                this.currentPrompt,
                apiKey,
                options,
                onChunk
            );

            card.setResponse(result);

            // Update results if they exist
            if (this.currentResults) {
                const index = this.currentResults.responses.findIndex(r => r.modelId === modelId);
                if (index >= 0) {
                    this.currentResults.responses[index] = result;
                }
            }
        } catch (error) {
            console.error(`Error retrying ${modelId}:`, error);
            card.setResponse({
                error: 'Retry failed',
                errorSuggestion: 'Please try again or check your API key.',
                errorType: 'unknown',
                latency: 0
            });
        }
    }

    handleExport() {
        if (this.currentResults) {
            Exporter.downloadJSON(this.currentResults);
        }
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
} else {
    new App();
}
