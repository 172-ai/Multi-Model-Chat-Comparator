// Enhanced Settings Panel Component with dynamic model discovery
import { ProviderFactory } from '../api/providers.js';
import { Storage } from '../utils/storage.js';
import { getDisplayName } from '../config/models.js';

export class SettingsPanel {
    constructor() {
        this.modal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeSettingsBtn');
        this.saveBtn = document.getElementById('saveSettingsBtn');

        this.openaiKeyInput = document.getElementById('openaiKey');
        this.anthropicKeyInput = document.getElementById('anthropicKey');
        this.googleKeyInput = document.getElementById('googleKey');
        this.streamingEnabledCheckbox = document.getElementById('streamingEnabled');

        this.temperatureInput = document.getElementById('temperatureInput');
        this.temperatureValue = document.getElementById('temperatureValue');
        this.maxTokensInput = document.getElementById('maxTokensInput');

        this.modelCheckboxesContainer = document.getElementById('modelCheckboxes');

        this.availableModels = {
            openai: [],
            anthropic: [],
            google: []
        };

        this.init();
    }

    async init() {
        // Event listeners
        this.settingsBtn.addEventListener('click', () => this.open());
        this.closeBtn.addEventListener('click', () => this.close());
        this.saveBtn.addEventListener('click', () => this.save());

        // Close on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.close();
            }
        });

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close();
            }
        });

        // API key validation on input
        this.openaiKeyInput.addEventListener('blur', () => this.validateAndFetchModels('openai'));
        this.anthropicKeyInput.addEventListener('blur', () => this.validateAndFetchModels('anthropic'));
        this.googleKeyInput.addEventListener('blur', () => this.validateAndFetchModels('google'));

        // Temperature slider update
        this.temperatureInput.addEventListener('input', (e) => {
            this.temperatureValue.textContent = e.target.value;
        });

        // Load API keys from environment and localStorage
        await this.loadApiKeysFromEnvironment();
        this.loadSettings();

        // Fetch models for any configured API keys
        await this.fetchAllModels();
    }

    async loadApiKeysFromEnvironment() {
        try {
            const response = await fetch('/api/env');
            if (response.ok) {
                const envKeys = await response.json();

                // Set keys from environment if not already in localStorage
                if (envKeys.openai && !Storage.getApiKey('openai')) {
                    this.openaiKeyInput.value = envKeys.openai;
                    Storage.setApiKey('openai', envKeys.openai);
                }
                if (envKeys.anthropic && !Storage.getApiKey('anthropic')) {
                    this.anthropicKeyInput.value = envKeys.anthropic;
                    Storage.setApiKey('anthropic', envKeys.anthropic);
                }
                if (envKeys.google && !Storage.getApiKey('google')) {
                    this.googleKeyInput.value = envKeys.google;
                    Storage.setApiKey('google', envKeys.google);
                }
            }
        } catch (error) {
            console.log('Could not load environment variables (running without backend?)');
        }
    }

    async validateAndFetchModels(provider) {
        const input = this[`${provider}KeyInput`];
        const apiKey = input.value.trim();

        if (!apiKey) {
            this.setValidationState(input, null);
            return;
        }

        // Show loading state
        this.setValidationState(input, 'loading');

        try {
            const models = await ProviderFactory.listModels(provider, apiKey);

            if (models && models.length > 0) {
                this.availableModels[provider] = models;
                this.setValidationState(input, 'valid');

                // If no models are selected, auto-select defaults for this provider
                const currentSelected = Storage.getEnabledModels() || [];
                if (currentSelected.length === 0) {
                    this.selectDefaultModels(provider);
                }

                this.updateModelCheckboxes();
            } else {
                this.setValidationState(input, 'invalid');
            }
        } catch (error) {
            console.error(`Error fetching ${provider} models:`, error);
            this.setValidationState(input, 'invalid');
        }
    }

    selectDefaultModels(specificProvider = null) {
        let currentSelected = Storage.getEnabledModels() || [];
        // Double check in case we already have selections
        if (currentSelected.length > 0) return;

        const providers = specificProvider ? [specificProvider] : ['openai', 'anthropic', 'google'];
        const newSelections = [];

        // Preferred models in priority order
        const defaults = {
            openai: ['gpt-4-turbo', 'gpt-4o', 'gpt-4'],
            anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
            google: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
        };

        providers.forEach(provider => {
            const models = this.availableModels[provider] || [];
            if (models.length === 0) return;

            // Try to find a preferred model
            let selected = null;
            for (const pref of defaults[provider]) {
                const found = models.find(m => m.id === pref || m.id.includes(pref));
                if (found) {
                    selected = found.id;
                    break;
                }
            }

            // Fallback: pick the first available if no preference match
            if (!selected && models.length > 0) {
                selected = models[0].id;
            }

            if (selected) {
                newSelections.push(selected);
            }
        });

        if (newSelections.length > 0) {
            Storage.setEnabledModels(newSelections);
            // We need to re-render checkboxes to reflect this new state immediately
            // But validation method calls updateModelCheckboxes right after this return
        }
    }

    setValidationState(input, state) {
        // Remove existing validation classes
        input.classList.remove('valid', 'invalid', 'loading');

        // Remove existing validation icon
        const existingIcon = input.parentElement.querySelector('.validation-icon');
        if (existingIcon) {
            existingIcon.remove();
        }

        if (state) {
            input.classList.add(state);

            // Add validation icon
            const icon = document.createElement('span');
            icon.className = 'validation-icon';

            if (state === 'valid') {
                icon.textContent = '✓';
                icon.style.color = 'var(--color-success)';
            } else if (state === 'invalid') {
                icon.textContent = '✗';
                icon.style.color = 'var(--color-error)';
            } else if (state === 'loading') {
                icon.textContent = '⟳';
                icon.style.color = 'var(--color-text-secondary)';
            }

            input.parentElement.appendChild(icon);
        }
    }

    async fetchAllModels() {
        const apiKeys = Storage.getAllApiKeys();

        const promises = [];
        if (apiKeys.openai) {
            promises.push(this.validateAndFetchModels('openai'));
        }
        if (apiKeys.anthropic) {
            promises.push(this.validateAndFetchModels('anthropic'));
        }
        if (apiKeys.google) {
            promises.push(this.validateAndFetchModels('google'));
        }

        await Promise.all(promises);

        // After fetching all, if we still have no selections, try to select defaults
        const currentSelected = Storage.getEnabledModels() || [];
        if (currentSelected.length === 0) {
            this.selectDefaultModels();
            // Force save to persist these defaults immediately
            Storage.setEnabledModels(this.selectDefaultModelsInternal());
        }
    }

    // Helper to get default selections without side effects
    selectDefaultModelsInternal() {
        const selections = [];
        const defaults = {
            openai: ['gpt-4-turbo', 'gpt-4o', 'gpt-4'],
            anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
            google: ['gemini-1.5-pro', 'gemini-1.5-flash']
        };

        ['openai', 'anthropic', 'google'].forEach(p => {
            const models = this.availableModels[p] || [];
            for (const pref of defaults[p]) {
                const found = models.find(m => m.id === pref || m.id.includes(pref));
                if (found) {
                    selections.push(found.id);
                    break;
                }
            }
            // Fallback
            if (selections.filter(id => this.isProviderModel(id, p)).length === 0 && models.length > 0) {
                selections.push(models[0].id);
            }
        });
        return selections;
    }

    isProviderModel(modelId, provider) {
        return this.availableModels[provider]?.some(m => m.id === modelId);
    }

    updateModelCheckboxes() {
        // Clear existing checkboxes
        this.modelCheckboxesContainer.innerHTML = '';

        // Get currently selected models
        const selectedModels = Storage.getEnabledModels() || [];

        // Combine all available models
        const allModels = [
            ...this.availableModels.openai,
            ...this.availableModels.anthropic,
            ...this.availableModels.google
        ];

        if (allModels.length === 0) {
            this.modelCheckboxesContainer.innerHTML = '<p class="no-models-message">Enter API keys above to load available models</p>';
            return;
        }

        // Group models by provider
        const modelsByProvider = {
            openai: this.availableModels.openai,
            anthropic: this.availableModels.anthropic,
            google: this.availableModels.google
        };

        // Create checkboxes grouped by provider
        Object.entries(modelsByProvider).forEach(([provider, models]) => {
            if (models.length === 0) return;

            // Provider header
            const header = document.createElement('h4');
            header.className = 'provider-header';
            header.textContent = provider.charAt(0).toUpperCase() + provider.slice(1);
            this.modelCheckboxesContainer.appendChild(header);

            // Model checkboxes
            models.forEach(model => {
                const label = document.createElement('label');
                label.className = 'checkbox-label';
                label.title = `Context: ${model.contextWindow.toLocaleString()} tokens`;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = model.id;
                checkbox.id = `model-${model.id}`;
                checkbox.checked = selectedModels.includes(model.id);

                const nameSpan = document.createElement('span');
                nameSpan.className = 'model-name';
                nameSpan.textContent = getDisplayName(model.id);

                const contextSpan = document.createElement('span');
                contextSpan.className = 'model-context';
                contextSpan.textContent = `${(model.contextWindow / 1000).toFixed(0)}K`;

                label.appendChild(checkbox);
                label.appendChild(nameSpan);
                label.appendChild(contextSpan);
                this.modelCheckboxesContainer.appendChild(label);
            });
        });
    }

    loadSettings() {
        // Load API keys
        const apiKeys = Storage.getAllApiKeys();
        if (apiKeys.openai) this.openaiKeyInput.value = apiKeys.openai;
        if (apiKeys.anthropic) this.anthropicKeyInput.value = apiKeys.anthropic;
        if (apiKeys.google) this.googleKeyInput.value = apiKeys.google;

        // Load streaming preference
        this.streamingEnabledCheckbox.checked = Storage.getStreamingEnabled();

        // Load model parameters
        const params = Storage.getModelParams();
        this.temperatureInput.value = params.temperature;
        this.temperatureValue.textContent = params.temperature;
        this.maxTokensInput.value = params.maxTokens;
    }

    save() {
        // Save API keys
        const openaiKey = this.openaiKeyInput.value.trim();
        const anthropicKey = this.anthropicKeyInput.value.trim();
        const googleKey = this.googleKeyInput.value.trim();

        if (openaiKey) Storage.setApiKey('openai', openaiKey);
        if (anthropicKey) Storage.setApiKey('anthropic', anthropicKey);
        if (googleKey) Storage.setApiKey('google', googleKey);

        // Save streaming preference
        Storage.setStreamingEnabled(this.streamingEnabledCheckbox.checked);

        // Save model parameters
        Storage.setModelParams({
            temperature: parseFloat(this.temperatureInput.value),
            maxTokens: parseInt(this.maxTokensInput.value)
        });

        // Save enabled models
        const checkboxes = this.modelCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        const enabledModels = Array.from(checkboxes).map(cb => cb.value);
        Storage.setEnabledModels(enabledModels);

        // Save available models metadata
        Storage.setItem('available_models', JSON.stringify(this.availableModels));

        // Show success feedback
        this.saveBtn.textContent = '✓ Saved!';
        setTimeout(() => {
            this.saveBtn.textContent = 'Save Settings';
            this.close();
        }, 1000);

        // Dispatch event for app to reload models
        window.dispatchEvent(new CustomEvent('settingsUpdated', {
            detail: { availableModels: this.availableModels }
        }));
    }

    async open() {
        this.modal.classList.add('active');
        this.loadSettings();

        // Refresh models if needed
        const hasModels = Object.values(this.availableModels).some(arr => arr.length > 0);
        if (!hasModels) {
            await this.fetchAllModels();
        }
    }

    close() {
        this.modal.classList.remove('active');
    }

    getEnabledModels() {
        return Storage.getEnabledModels() || [];
    }

    getAvailableModels() {
        // Try to load from storage first
        const stored = Storage.getItem('available_models');
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch (e) {
                return this.availableModels;
            }
        }
        return this.availableModels;
    }
}
