// Settings Panel Component
import { MODEL_CONFIGS, DEFAULT_MODELS } from '../config/models.js';
import { Storage } from '../utils/storage.js';

export class SettingsPanel {
    constructor() {
        this.modal = document.getElementById('settingsModal');
        this.settingsBtn = document.getElementById('settingsBtn');
        this.closeBtn = document.getElementById('closeSettingsBtn');
        this.saveBtn = document.getElementById('saveSettingsBtn');

        this.openaiKeyInput = document.getElementById('openaiKey');
        this.anthropicKeyInput = document.getElementById('anthropicKey');
        this.googleKeyInput = document.getElementById('googleKey');

        this.modelCheckboxesContainer = document.getElementById('modelCheckboxes');

        this.init();
    }

    init() {
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

        // Populate model checkboxes
        this.populateModelCheckboxes();

        // Load saved settings
        this.loadSettings();
    }

    populateModelCheckboxes() {
        const fragment = document.createDocumentFragment();

        Object.entries(MODEL_CONFIGS).forEach(([modelId, config]) => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = modelId;
            checkbox.id = `model-${modelId}`;
            checkbox.checked = DEFAULT_MODELS.includes(modelId);

            const text = document.createTextNode(config.displayName);

            label.appendChild(checkbox);
            label.appendChild(text);
            fragment.appendChild(label);
        });

        this.modelCheckboxesContainer.appendChild(fragment);
    }

    loadSettings() {
        // Load API keys
        const apiKeys = Storage.getAllApiKeys();
        if (apiKeys.openai) this.openaiKeyInput.value = apiKeys.openai;
        if (apiKeys.anthropic) this.anthropicKeyInput.value = apiKeys.anthropic;
        if (apiKeys.google) this.googleKeyInput.value = apiKeys.google;

        // Load enabled models
        const enabledModels = Storage.getEnabledModels();
        if (enabledModels) {
            const checkboxes = this.modelCheckboxesContainer.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = enabledModels.includes(checkbox.value);
            });
        }
    }

    save() {
        // Save API keys
        const openaiKey = this.openaiKeyInput.value.trim();
        const anthropicKey = this.anthropicKeyInput.value.trim();
        const googleKey = this.googleKeyInput.value.trim();

        if (openaiKey) Storage.setApiKey('openai', openaiKey);
        if (anthropicKey) Storage.setApiKey('anthropic', anthropicKey);
        if (googleKey) Storage.setApiKey('google', googleKey);

        // Save enabled models
        const checkboxes = this.modelCheckboxesContainer.querySelectorAll('input[type="checkbox"]:checked');
        const enabledModels = Array.from(checkboxes).map(cb => cb.value);
        Storage.setEnabledModels(enabledModels);

        // Show success feedback
        this.saveBtn.textContent = '✓ Saved!';
        setTimeout(() => {
            this.saveBtn.textContent = 'Save Settings';
            this.close();
        }, 1000);

        // Dispatch event for app to reload models
        window.dispatchEvent(new CustomEvent('settingsUpdated'));
    }

    open() {
        this.modal.classList.add('active');
        this.loadSettings(); // Refresh settings when opening
    }

    close() {
        this.modal.classList.remove('active');
    }

    getEnabledModels() {
        const stored = Storage.getEnabledModels();
        return stored || DEFAULT_MODELS;
    }
}
