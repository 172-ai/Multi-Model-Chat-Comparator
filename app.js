// Main Application
import { MODEL_CONFIGS } from './config/models.js';
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

        this.init();
    }

    init() {
        // Set up event listeners
        this.promptInput.onSubmit((prompt) => this.handleSubmit(prompt));
        this.exportBtn.addEventListener('click', () => this.handleExport());

        // Listen for settings updates
        window.addEventListener('settingsUpdated', () => {
            this.updateModelCards();
        });

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

    updateModelCards() {
        // Clear existing cards
        this.modelsGrid.innerHTML = '';
        this.modelCards.clear();

        // Get enabled models
        const enabledModels = this.settingsPanel.getEnabledModels();

        // Create cards for enabled models
        enabledModels.forEach(modelId => {
            const config = MODEL_CONFIGS[modelId];
            if (config) {
                const card = new ModelCard(modelId, config);
                this.modelCards.set(modelId, card);
                this.modelsGrid.appendChild(card.getElement());
            }
        });

        // Hide cards initially (show skeleton state)
        this.modelsGrid.style.display = enabledModels.length > 0 ? 'grid' : 'none';
    }

    async handleSubmit(prompt) {
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

        // Set all cards to loading state
        this.modelCards.forEach(card => card.setLoading());

        // Get enabled models
        const enabledModels = this.settingsPanel.getEnabledModels();

        // Execute requests in parallel
        const requests = enabledModels.map(modelId =>
            ProviderFactory.executeRequest(modelId, prompt, apiKeys)
        );

        try {
            const results = await Promise.all(requests);

            // Update cards with results
            results.forEach(result => {
                const modelId = this.getModelIdFromDisplayName(result.model);
                const card = this.modelCards.get(modelId);
                if (card) {
                    card.setResponse(result);
                }
            });

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

    getModelIdFromDisplayName(displayName) {
        for (const [modelId, config] of Object.entries(MODEL_CONFIGS)) {
            if (config.displayName === displayName) {
                return modelId;
            }
        }
        return null;
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
