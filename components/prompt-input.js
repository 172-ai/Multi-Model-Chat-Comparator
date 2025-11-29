// Prompt Input Component
export class PromptInput {
    constructor() {
        this.textarea = document.getElementById('promptInput');
        this.charCounter = document.getElementById('charCounter');
        this.submitBtn = document.getElementById('submitBtn');
        this.clearBtn = document.getElementById('clearBtn');

        this.init();
    }

    init() {
        // Character counter
        this.textarea.addEventListener('input', () => {
            this.updateCharCounter();
        });

        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this.clear();
        });

        // Submit on Ctrl/Cmd + Enter
        this.textarea.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                this.submitBtn.click();
            }
        });
    }

    updateCharCounter() {
        const length = this.textarea.value.length;
        this.charCounter.textContent = `${length} character${length !== 1 ? 's' : ''}`;
    }

    getValue() {
        return this.textarea.value.trim();
    }

    clear() {
        this.textarea.value = '';
        this.updateCharCounter();
        this.textarea.focus();
    }

    setDisabled(disabled) {
        this.textarea.disabled = disabled;
        this.submitBtn.disabled = disabled;
        this.clearBtn.disabled = disabled;
    }

    onSubmit(callback) {
        this.submitBtn.addEventListener('click', () => {
            const value = this.getValue();
            if (value) {
                callback(value);
            }
        });
    }
}
