// API provider integrations with streaming and dynamic model discovery
import { API_ENDPOINTS, getModelPricing, DEFAULT_PARAMS, STREAMING_CONFIG } from '../config/models.js';
import { Metrics } from './metrics.js';
import { ErrorHandler } from '../utils/error-handler.js';

export class APIProvider {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async listModels() {
        throw new Error('listModels must be implemented by subclass');
    }

    async makeRequest(modelId, prompt, onChunk = null) {
        throw new Error('makeRequest must be implemented by subclass');
    }
}

// OpenAI Provider
export class OpenAIProvider extends APIProvider {
    async listModels() {
        try {
            const response = await fetch(`${API_ENDPOINTS.openai}/models`, {
                headers: {
                    'x-api-key': this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Filter for chat models only
            const chatModels = data.data
                .filter(model =>
                    model.id.includes('gpt-4') ||
                    model.id.includes('gpt-3.5-turbo')
                )
                .map(model => ({
                    id: model.id,
                    name: model.id,
                    provider: 'openai',
                    contextWindow: this.getContextWindow(model.id),
                    capabilities: ['chat', 'streaming']
                }))
                .sort((a, b) => b.id.localeCompare(a.id)); // Newest first

            return chatModels;
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'openai', null);
            throw new Error(errorInfo.message);
        }
    }

    getContextWindow(modelId) {
        if (modelId.includes('gpt-4-turbo')) return 128000;
        if (modelId.includes('gpt-4')) return 8192;
        if (modelId.includes('gpt-3.5-turbo-16k')) return 16385;
        if (modelId.includes('gpt-3.5')) return 4096;
        return 8192;
    }

    async makeRequest(modelId, prompt, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        try {
            const response = await fetch(`${API_ENDPOINTS.openai}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: DEFAULT_PARAMS.temperature,
                    max_tokens: DEFAULT_PARAMS.max_tokens,
                    stream: onChunk ? true : false
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            // Handle streaming response
            if (onChunk && response.body) {
                return await this.handleStreamingResponse(response, tracker, pricing, modelId, onChunk);
            }

            // Handle non-streaming response
            const latency = tracker.stop();
            const data = await response.json();
            const completion = data.choices[0]?.message?.content || '';
            const usage = data.usage;
            const finishReason = data.choices[0]?.finish_reason;

            // Check for empty response
            if (!completion || completion.trim() === '') {
                let errorMsg = 'Empty response from model';
                let suggestion = 'The model returned no content.';

                if (finishReason === 'content_filter') {
                    errorMsg = 'Response blocked by content filter';
                    suggestion = 'OpenAI content filters blocked this response. Try rephrasing your prompt.';
                } else if (finishReason === 'length') {
                    errorMsg = 'Response truncated (max tokens reached)';
                    suggestion = 'The response was cut off. Try a shorter prompt or increase max_tokens.';
                }

                return {
                    text: completion,
                    latency,
                    inputTokens: usage.prompt_tokens,
                    outputTokens: usage.completion_tokens,
                    totalTokens: usage.total_tokens,
                    estimatedCost: Metrics.calculateCost(pricing, usage.prompt_tokens, usage.completion_tokens),
                    warning: errorMsg,
                    warningSuggestion: suggestion,
                    warningType: 'empty_response',
                    finishReason: finishReason
                };
            }

            return {
                text: completion,
                latency,
                inputTokens: usage.prompt_tokens,
                outputTokens: usage.completion_tokens,
                totalTokens: usage.total_tokens,
                estimatedCost: Metrics.calculateCost(pricing, usage.prompt_tokens, usage.completion_tokens),
                finishReason: finishReason
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'openai', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop()
            };
        }
    }

    async handleStreamingResponse(response, tracker, pricing, modelId, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices[0]?.delta?.content;
                            if (content) {
                                fullText += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            const latency = tracker.stop();
            const inputTokens = Metrics.estimateTokenCount(prompt);
            const outputTokens = Metrics.estimateTokenCount(fullText);

            return {
                text: fullText,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                streamed: true
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'openai', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop(),
                text: fullText // Return partial text if available
            };
        }
    }
}

// Anthropic Provider
export class AnthropicProvider extends APIProvider {
    async listModels() {
        // Anthropic doesn't provide a models list endpoint, so we return known models
        return [
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'claude-3-5-sonnet-20241022',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-5-sonnet-20240620',
                name: 'claude-3-5-sonnet-20240620',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'claude-3-opus-20240229',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-sonnet-20240229',
                name: 'claude-3-sonnet-20240229',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'claude-3-haiku-20240307',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            }
        ];
    }

    async makeRequest(modelId, prompt, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        try {
            const response = await fetch(`${API_ENDPOINTS.anthropic}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: modelId,
                    messages: [{ role: 'user', content: prompt }],
                    temperature: DEFAULT_PARAMS.temperature,
                    max_tokens: DEFAULT_PARAMS.max_tokens,
                    stream: onChunk ? true : false
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            // Handle streaming response
            if (onChunk && response.body) {
                return await this.handleStreamingResponse(response, tracker, pricing, modelId, prompt, onChunk);
            }

            // Handle non-streaming response
            const latency = tracker.stop();
            const data = await response.json();
            const completion = data.content[0]?.text || '';
            const usage = data.usage;
            const stopReason = data.stop_reason;

            // Check for empty response or safety filter
            if (!completion || completion.trim() === '') {
                let errorMsg = 'Empty response from model';
                let suggestion = 'The model returned no content.';

                if (stopReason === 'end_turn' && usage.output_tokens === 0) {
                    errorMsg = 'Model returned empty response';
                    suggestion = 'This may be due to safety filters or the model interpreting the prompt as complete. Try rephrasing your prompt.';
                } else if (stopReason === 'max_tokens') {
                    errorMsg = 'Response truncated (max tokens reached)';
                    suggestion = 'The response was cut off. Try a shorter prompt or increase max_tokens.';
                } else if (stopReason === 'stop_sequence') {
                    errorMsg = 'Response stopped at stop sequence';
                    suggestion = 'The model encountered a stop sequence.';
                }

                return {
                    text: completion,
                    latency,
                    inputTokens: usage.input_tokens,
                    outputTokens: usage.output_tokens,
                    totalTokens: usage.input_tokens + usage.output_tokens,
                    estimatedCost: Metrics.calculateCost(pricing, usage.input_tokens, usage.output_tokens),
                    warning: errorMsg,
                    warningSuggestion: suggestion,
                    warningType: 'empty_response',
                    stopReason: stopReason
                };
            }

            return {
                text: completion,
                latency,
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                totalTokens: usage.input_tokens + usage.output_tokens,
                estimatedCost: Metrics.calculateCost(pricing, usage.input_tokens, usage.output_tokens),
                stopReason: stopReason
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'anthropic', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop()
            };
        }
    }

    async handleStreamingResponse(response, tracker, pricing, modelId, prompt, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        let inputTokens = 0;
        let outputTokens = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.type === 'content_block_delta') {
                                const content = parsed.delta?.text;
                                if (content) {
                                    fullText += content;
                                    onChunk(content);
                                }
                            } else if (parsed.type === 'message_start') {
                                inputTokens = parsed.message?.usage?.input_tokens || 0;
                            } else if (parsed.type === 'message_delta') {
                                outputTokens = parsed.usage?.output_tokens || 0;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            const latency = tracker.stop();

            // Use reported tokens or estimate
            if (!inputTokens) inputTokens = Metrics.estimateTokenCount(prompt);
            if (!outputTokens) outputTokens = Metrics.estimateTokenCount(fullText);

            return {
                text: fullText,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                streamed: true
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'anthropic', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop(),
                text: fullText
            };
        }
    }
}

// Google Provider
export class GoogleProvider extends APIProvider {
    async listModels() {
        try {
            const response = await fetch(`${API_ENDPOINTS.google}/models`, {
                headers: { 'x-api-key': this.apiKey }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Filter for models that support generateContent
            const chatModels = data.models
                .filter(model =>
                    model.supportedGenerationMethods?.includes('generateContent') &&
                    (model.name.includes('gemini'))
                )
                .map(model => ({
                    id: model.name.replace('models/', ''),
                    name: model.name.replace('models/', ''),
                    provider: 'google',
                    contextWindow: model.inputTokenLimit || 32000,
                    capabilities: model.supportedGenerationMethods || ['generateContent']
                }))
                .sort((a, b) => b.id.localeCompare(a.id));

            return chatModels;
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'google', null);
            throw new Error(errorInfo.message);
        }
    }

    async makeRequest(modelId, prompt, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        try {
            const endpoint = onChunk
                ? `${API_ENDPOINTS.google}/models/${modelId}:streamGenerateContent`
                : `${API_ENDPOINTS.google}/models/${modelId}:generateContent`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: DEFAULT_PARAMS.temperature,
                        maxOutputTokens: DEFAULT_PARAMS.max_tokens
                    }
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `HTTP ${response.status}`);
            }

            // Handle streaming response
            if (onChunk && response.body) {
                return await this.handleStreamingResponse(response, tracker, pricing, modelId, prompt, onChunk);
            }

            // Handle non-streaming response
            const latency = tracker.stop();
            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                return {
                    text: '',
                    latency,
                    inputTokens: 0,
                    outputTokens: 0,
                    totalTokens: 0,
                    estimatedCost: 0,
                    warning: 'No response generated',
                    warningSuggestion: 'Google safety filters may have blocked this response. Try rephrasing your prompt.',
                    warningType: 'empty_response'
                };
            }

            const completion = data.candidates[0]?.content?.parts[0]?.text || '';
            const inputTokens = data.usageMetadata?.promptTokenCount || Metrics.estimateTokenCount(prompt);
            const outputTokens = data.usageMetadata?.candidatesTokenCount || Metrics.estimateTokenCount(completion);
            const finishReason = data.candidates[0]?.finishReason;

            // Check for empty response
            if (!completion || completion.trim() === '') {
                let errorMsg = 'Empty response from model';
                let suggestion = 'The model returned no content.';

                if (finishReason === 'SAFETY') {
                    errorMsg = 'Response blocked by safety filters';
                    suggestion = 'Google safety filters blocked this response. Try rephrasing your prompt to avoid sensitive topics.';
                } else if (finishReason === 'MAX_TOKENS') {
                    errorMsg = 'Response truncated (max tokens reached)';
                    suggestion = 'The response was cut off. Try a shorter prompt or increase maxOutputTokens.';
                }

                return {
                    text: completion,
                    latency,
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                    warning: errorMsg,
                    warningSuggestion: suggestion,
                    warningType: 'empty_response',
                    finishReason: finishReason
                };
            }

            return {
                text: completion,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                finishReason: finishReason
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'google', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop()
            };
        }
    }

    async handleStreamingResponse(response, tracker, pricing, modelId, prompt, onChunk) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';
        let inputTokens = 0;
        let outputTokens = 0;

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                // Google streams JSON objects separated by newlines
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const parsed = JSON.parse(line);

                            if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                                const content = parsed.candidates[0].content.parts[0]?.text;
                                if (content) {
                                    fullText += content;
                                    onChunk(content);
                                }
                            }

                            if (parsed.usageMetadata) {
                                inputTokens = parsed.usageMetadata.promptTokenCount || inputTokens;
                                outputTokens = parsed.usageMetadata.candidatesTokenCount || outputTokens;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            const latency = tracker.stop();

            // Use reported tokens or estimate
            if (!inputTokens) inputTokens = Metrics.estimateTokenCount(prompt);
            if (!outputTokens) outputTokens = Metrics.estimateTokenCount(fullText);

            return {
                text: fullText,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                streamed: true
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, 'google', modelId);
            return {
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop(),
                text: fullText
            };
        }
    }
}

// Provider factory
export class ProviderFactory {
    static createProvider(provider, apiKey) {
        switch (provider) {
            case 'openai':
                return new OpenAIProvider(apiKey);
            case 'anthropic':
                return new AnthropicProvider(apiKey);
            case 'google':
                return new GoogleProvider(apiKey);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    static async listModels(provider, apiKey) {
        try {
            const providerInstance = this.createProvider(provider, apiKey);
            return await providerInstance.listModels();
        } catch (error) {
            console.error(`Error listing models for ${provider}:`, error);
            return [];
        }
    }

    static async executeRequest(modelConfig, prompt, apiKey, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();

        if (!apiKey) {
            return {
                model: modelConfig.name,
                provider: modelConfig.provider,
                error: 'API key not configured',
                errorSuggestion: `Please add your ${modelConfig.provider} API key in settings.`,
                errorType: 'auth',
                latency: 0
            };
        }

        try {
            const provider = this.createProvider(modelConfig.provider, apiKey);
            const result = await provider.makeRequest(modelConfig.id, prompt, onChunk);

            return {
                model: modelConfig.name,
                modelId: modelConfig.id,
                provider: modelConfig.provider,
                contextWindow: modelConfig.contextWindow,
                timestamp: new Date().toISOString(),
                ...result
            };
        } catch (error) {
            const errorInfo = ErrorHandler.parseError(error, modelConfig.provider, modelConfig.id);
            return {
                model: modelConfig.name,
                modelId: modelConfig.id,
                provider: modelConfig.provider,
                error: errorInfo.message,
                errorSuggestion: errorInfo.suggestion,
                errorType: errorInfo.type,
                latency: tracker.stop()
            };
        }
    }
}
