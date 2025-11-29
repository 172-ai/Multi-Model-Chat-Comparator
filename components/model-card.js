// Model Card Component
import { Metrics } from '../api/metrics.js';

export class ModelCard {
    constructor(modelId, config) {
        this.modelId = modelId;
        this.config = config;
        this.element = this.createCard();
    }

    createCard() {
        const card = document.createElement('div');
        card.className = 'model-card';
        card.id = `card-${this.modelId}`;

        card.innerHTML = `
      <div class="model-header">
        <div class="model-info">
          <h3>${this.config.displayName}</h3>
          <span class="model-provider">${this.config.provider}</span>
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
          <span class="metric-value" id="context-${this.modelId}">${Metrics.formatTokens(this.config.contextWindow)}</span>
        </div>
      </div>
    `;

        return card;
    }

    setLoading() {
        this.element.classList.add('loading');
        this.element.classList.remove('success', 'error');

        const responseDiv = document.getElementById(`response-${this.modelId}`);
        responseDiv.innerHTML = `
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
      <div class="skeleton skeleton-text"></div>
    `;
    }

    setResponse(result) {
        this.element.classList.remove('loading');

        const responseDiv = document.getElementById(`response-${this.modelId}`);
        const latencyEl = document.getElementById(`latency-${this.modelId}`);
        const tokensEl = document.getElementById(`tokens-${this.modelId}`);
        const costEl = document.getElementById(`cost-${this.modelId}`);

        if (result.error) {
            this.element.classList.add('error');
            responseDiv.innerHTML = `
        <div class="error-message">
          <strong>Error:</strong> ${result.error}
        </div>
      `;
            latencyEl.textContent = result.latency ? Metrics.formatLatency(result.latency) : '--';
        } else {
            this.element.classList.add('success');
            responseDiv.textContent = result.text;

            latencyEl.textContent = Metrics.formatLatency(result.latency);
            tokensEl.textContent = Metrics.formatTokens(result.totalTokens);
            costEl.textContent = Metrics.formatCost(result.estimatedCost);
        }
    }

    getElement() {
        return this.element;
    }
}
