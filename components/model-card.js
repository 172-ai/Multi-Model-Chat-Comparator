// Enhanced Model Card Component with streaming support
import { Metrics } from '../api/metrics.js';
import { getDisplayName } from '../config/models.js';
import { ErrorHandler } from '../utils/error-handler.js';

export class ModelCard {
  constructor(modelConfig) {
    this.modelConfig = modelConfig;
    this.modelId = modelConfig.id;
    this.element = this.createCard();
    this.isStreaming = false;
    this.streamedText = '';
  }

  createCard() {
    const card = document.createElement('div');
    card.className = 'model-card';
    card.id = `card-${this.modelId}`;

    const displayName = getDisplayName(this.modelId);
    const providerName = this.modelConfig.provider.charAt(0).toUpperCase() + this.modelConfig.provider.slice(1);

    card.innerHTML = `
      <div class="model-header">
        <div class="model-info">
          <h3>${displayName}</h3>
          <span class="model-provider">${providerName}</span>
        </div>
      </div>
      <div class="model-response" id="response-${this.modelId}">
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text"></div>
      </div>
      <div class="model-metrics">
        <div class="metric">
          <span class="metric-label">Latency</span>
          <span class="metric-value latency" id="latency-${this.modelId}">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Tokens</span>
          <span class="metric-value" id="tokens-${this.modelId}">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Cost</span>
          <span class="metric-value cost" id="cost-${this.modelId}">--</span>
        </div>
        <div class="metric">
          <span class="metric-label">Context</span>
          <span class="metric-value" id="context-${this.modelId}">${Metrics.formatTokens(this.modelConfig.contextWindow)}</span>
        </div>
      </div>
    `;

    return card;
  }

  setLoading() {
    this.element.classList.add('loading');
    this.element.classList.remove('success', 'error', 'streaming');
    this.isStreaming = false;
    this.streamedText = '';

    const responseDiv = document.getElementById(`response-${this.modelId}`);
    responseDiv.innerHTML = `
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    `;
  }

  setStreaming() {
    this.element.classList.remove('loading');
    this.element.classList.add('streaming');
    this.isStreaming = true;
    this.streamedText = '';

    const responseDiv = document.getElementById(`response-${this.modelId}`);
    responseDiv.innerHTML = '<span class="typing-indicator">▋</span>';
  }

  appendStreamChunk(chunk) {
    if (!this.isStreaming) return;

    this.streamedText += chunk;
    const responseDiv = document.getElementById(`response-${this.modelId}`);
    responseDiv.textContent = this.streamedText;

    // Auto-scroll to bottom
    responseDiv.scrollTop = responseDiv.scrollHeight;
  }

  setResponse(result) {
    this.element.classList.remove('loading', 'streaming');
    this.isStreaming = false;

    const responseDiv = document.getElementById(`response-${this.modelId}`);
    const latencyEl = document.getElementById(`latency-${this.modelId}`);
    const tokensEl = document.getElementById(`tokens-${this.modelId}`);
    const costEl = document.getElementById(`cost-${this.modelId}`);

    if (result.error) {
      this.element.classList.add('error');

      const errorInfo = ErrorHandler.formatErrorForDisplay({
        message: result.error,
        suggestion: result.errorSuggestion,
        type: result.errorType
      });

      responseDiv.innerHTML = `
        <div class="error-message">
          <div class="error-title">
            <span class="error-icon">⚠️</span>
            <strong>${errorInfo.title}</strong>
          </div>
          ${errorInfo.description ? `<p class="error-suggestion">${errorInfo.description}</p>` : ''}
          ${errorInfo.canRetry ? '<button class="btn btn-secondary retry-btn" data-model-id="' + this.modelId + '">Retry</button>' : ''}
        </div>
      `;

      // Add retry button listener
      if (errorInfo.canRetry) {
        const retryBtn = responseDiv.querySelector('.retry-btn');
        retryBtn.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('retryModel', {
            detail: { modelId: this.modelId }
          }));
        });
      }

      latencyEl.textContent = result.latency ? Metrics.formatLatency(result.latency) : '--';

      // Show partial text if available
      if (result.text) {
        const partialDiv = document.createElement('div');
        partialDiv.className = 'partial-response';
        partialDiv.innerHTML = `<p><em>Partial response before error:</em></p><p>${result.text}</p>`;
        responseDiv.appendChild(partialDiv);
      }
    } else if (result.warning) {
      // Handle warnings (like empty responses) - different styling from errors
      this.element.classList.add('warning');

      responseDiv.innerHTML = `
        <div class="warning-message">
          <div class="warning-title">
            <span class="warning-icon">⚠️</span>
            <strong>${result.warning}</strong>
          </div>
          ${result.warningSuggestion ? `<p class="warning-suggestion">${result.warningSuggestion}</p>` : ''}
          ${result.stopReason ? `<p class="warning-detail">Stop reason: <code>${result.stopReason}</code></p>` : ''}
          <button class="btn btn-secondary show-raw-btn" data-model-id="${this.modelId}">Show Raw Response</button>
          <pre class="raw-response hidden" id="raw-${this.modelId}"></pre>
        </div>
      `;

      // Add show raw response button listener
      const showRawBtn = responseDiv.querySelector('.show-raw-btn');
      const rawResponsePre = responseDiv.querySelector('.raw-response');
      showRawBtn.addEventListener('click', () => {
        if (rawResponsePre.classList.contains('hidden')) {
          // Show raw response
          rawResponsePre.textContent = JSON.stringify(result, null, 2);
          rawResponsePre.classList.remove('hidden');
          showRawBtn.textContent = 'Hide Raw Response';
        } else {
          // Hide raw response
          rawResponsePre.classList.add('hidden');
          showRawBtn.textContent = 'Show Raw Response';
        }
      });

      latencyEl.textContent = Metrics.formatLatency(result.latency);
      tokensEl.textContent = Metrics.formatTokens(result.totalTokens);

      const costFormatted = Metrics.formatCost(result.estimatedCost);
      if (costFormatted === 'N/A') {
        costEl.parentElement.style.display = 'none';
      } else {
        costEl.parentElement.style.display = 'flex';
        costEl.textContent = costFormatted;
      }
    } else {
      this.element.classList.add('success');
      responseDiv.textContent = result.text || this.streamedText;

      latencyEl.textContent = Metrics.formatLatency(result.latency);
      tokensEl.textContent = Metrics.formatTokens(result.totalTokens);

      const costFormatted = Metrics.formatCost(result.estimatedCost);
      if (costFormatted === 'N/A') {
        costEl.parentElement.style.display = 'none';
      } else {
        costEl.parentElement.style.display = 'flex';
        costEl.textContent = costFormatted;
      }
    }
  }

  getElement() {
    return this.element;
  }

  getModelId() {
    return this.modelId;
  }

  getModelConfig() {
    return this.modelConfig;
  }
}
