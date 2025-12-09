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

    async makeRequest(modelId, prompt, options = {}, onChunk = null) {
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

    async makeRequest(modelId, prompt, options = {}, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        const temperature = options.temperature !== undefined ? options.temperature : DEFAULT_PARAMS.temperature;
        const maxTokens = options.maxTokens !== undefined ? options.maxTokens : DEFAULT_PARAMS.max_tokens;

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
                    temperature: temperature,
                    max_tokens: maxTokens,
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

            // Process any remaining buffer content
            if (buffer && buffer.trim()) {
                const lines = buffer.split('\n');
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
                        } catch (e) { /* ignore */ }
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
        // Updated to remove specific version IDs that might be restricted/deprecated
        return [
            {
                id: 'claude-3-5-sonnet-20241022',
                name: 'Claude 3.5 Sonnet (v2)',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-opus-20240229',
                name: 'Claude 3 Opus',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            },
            {
                id: 'claude-3-haiku-20240307',
                name: 'Claude 3 Haiku',
                provider: 'anthropic',
                contextWindow: 200000,
                capabilities: ['chat', 'streaming']
            }
        ];
    }

    async makeRequest(modelId, prompt, options = {}, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        const temperature = options.temperature !== undefined ? options.temperature : DEFAULT_PARAMS.temperature;
        const maxTokens = options.maxTokens !== undefined ? options.maxTokens : DEFAULT_PARAMS.max_tokens;

        console.log('='.repeat(80));
        console.log(`[ANTHROPIC REQUEST] Model: ${modelId}, Streaming: ${!!onChunk}`);
        console.log('Prompt:', prompt.substring(0, 100));

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
                    temperature: temperature,
                    max_tokens: maxTokens,
                    stream: onChunk ? true : false
                })
            });

            console.log(`[ANTHROPIC RESPONSE] Status: ${response.status}, OK: ${response.ok}`);

            if (!response.ok) {
                const errorBody = await response.json();
                console.log('[ANTHROPIC ERROR RESPONSE]:', JSON.stringify(errorBody, null, 2));
                const errorMessage = errorBody.error?.message || errorBody.message || `HTTP ${response.status}`;
                throw new Error(errorMessage);
            }

            // Handle streaming response
            if (onChunk && response.body) {
                return await this.handleStreamingResponse(response, tracker, pricing, modelId, prompt, onChunk);
            }

            // Handle non-streaming response
            const latency = tracker.stop();
            const data = await response.json();
            console.log('[ANTHROPIC SUCCESS]:', {
                model: modelId,
                usage: data.usage,
                stopReason: data.stop_reason
            });
            const completion = data.content[0]?.text || '';
            const usage = data.usage;
            const stopReason = data.stop_reason;

            // Check for empty response (truly empty, not just short)
            // Note: Short responses like "4" or "Yes" are valid and should not be flagged
            if (!completion || completion.trim() === '') {
                let errorMsg = 'Empty Response from Claude';
                let suggestion = 'Claude returned no meaningful content. ';

                if (stopReason === 'end_turn') {
                    errorMsg = 'Claude Completed Turn with Empty Response';
                    suggestion = `Claude believes its turn is complete but returned no content. This commonly occurs due to:

• **Prompt Structure**: The model may interpret the conversation as already complete
• **Intermittent Behavior**: Some Claude models occasionally exhibit this behavior (known issue)
• **Context Confusion**: The model may think it already responded

**Recommended Actions**:
1. Try rephrasing your prompt with more explicit instructions
2. Add "Please provide a detailed response" to your prompt
3. If using tool results, avoid adding text immediately after them
4. Retry the request (intermittent issue may resolve)
5. Try a different Claude model (e.g., Haiku or Opus instead of Sonnet)

**Technical Details**: stop_reason="${stopReason}", output_tokens=${usage.output_tokens}, input_tokens=${usage.input_tokens}`;
                } else if (stopReason === 'max_tokens') {
                    errorMsg = 'Response Truncated (Max Tokens Reached)';
                    suggestion = `The response was cut off because it reached the maximum token limit.

**Recommended Actions**:
1. Increase the max_tokens parameter in settings
2. Use a shorter or more focused prompt
3. Break your question into smaller parts

**Technical Details**: stop_reason="${stopReason}", max_tokens_limit=${DEFAULT_PARAMS.max_tokens}`;
                } else if (stopReason === 'stop_sequence') {
                    errorMsg = 'Response Stopped at Stop Sequence';
                    suggestion = `The model encountered a predefined stop sequence.

**Technical Details**: stop_reason="${stopReason}"`;
                } else {
                    // Unknown reason for empty response - likely streaming timeout
                    if (stopReason === null) {
                        errorMsg = 'Streaming Connection Interrupted';
                        suggestion = `The streaming connection was interrupted before receiving a complete response from Claude.

**Most Likely Causes**:
• **Proxy/Network Timeout**: The connection between the proxy server and Anthropic's API timed out
• **Network Interruption**: Temporary network issue during streaming
• **API Connection Reset**: Anthropic's server closed the connection unexpectedly

**Recommended Actions**:
1. **Retry immediately** - This is usually a transient network issue
2. Check your internet connection stability
3. If it persists, check Anthropic's status page for API outages
4. Try using a different network (e.g., switch from WiFi to ethernet)
5. Consider increasing proxy timeout settings if this happens frequently

**Technical Details**: stop_reason=null (never received), output_tokens=${usage.output_tokens}, response_length=${completion.length}, latency=${latency}ms
**Diagnosis**: No stop_reason received indicates the streaming connection ended prematurely, likely due to network/proxy timeout rather than an API-level issue.`;
                    } else {
                        errorMsg = 'Unexpected Empty Response';
                        suggestion = `Claude returned an empty response without a clear reason.

**Possible Causes**:
• API service overload (HTTP 529 - try again later)
• Network timeout or connection issue
• Model-specific intermittent behavior

**Recommended Actions**:
1. Retry the request after a few seconds
2. Check Anthropic's status page for service issues
3. Try a different model
4. Simplify your prompt

**Technical Details**: stop_reason="${stopReason || 'null'}", output_tokens=${usage.output_tokens}, response_length=${completion.length}`;
                    }
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
            };

            return {
                text: completion,
                latency,
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens,
                totalTokens: usage.input_tokens + usage.output_tokens,
                estimatedCost: Metrics.calculateCost(pricing, usage.input_tokens, usage.output_tokens),
            };
        } catch (error) {
            console.error('[ANTHROPIC ERROR]:', error.message);
            console.error('Stack:', error.stack);

            // Check if this is a "model not available" error
            // Anthropic API sometimes returns "model: <model_id>" or specific error types
            const isModelError = error.message.includes('model:') ||
                error.message.includes('not found') ||
                error.message.includes('not available');

            if (isModelError) {
                const modelIdFromError = error.message.replace('model:', '').replace('Error:', '').trim();
                return {
                    error: `Model Unavailable: ${modelIdFromError || modelId}`,
                    errorSuggestion: `The model "${modelId}" is not available with your current API key or tier.
                    
**Common Reasons:**
• **Tier Restrictions**: Some models (like Claude 3.5 Sonnet) require a paid tier (Build Tier 1+)
• **Deprecation**: The model ID might be outdated
• **Region**: The model might not be available in your region

**Recommended Actions:**
1. Check your Anthropic Console (Settings > Plans) to verify your tier
2. Use **Claude 3 Haiku** or **Claude 3 Opus** (usually available on free tier)
3. Remove this model from your settings if it persists`,
                    errorType: 'model_not_available',
                    latency: tracker.stop()
                };
            }

            // Return error WITHOUT parsing through ErrorHandler
            // ErrorHandler is replacing "model" errors
            return {
                error: error.message,
                errorSuggestion: 'Check console logs for details. This may be a temporary API issue.',
                errorType: 'api_error',
                latency: tracker.stop(),
                rawError: {
                    message: error.message,
                    stack: error.stack
                }
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
        let stopReason = null;

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
                                stopReason = parsed.delta?.stop_reason || stopReason;
                            }
                        } catch (e) {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            // Process any remaining buffer content
            if (buffer && buffer.trim()) {
                const lines = buffer.split('\n');
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
                            } else if (parsed.type === 'message_delta') {
                                outputTokens = parsed.usage?.output_tokens || outputTokens;
                                stopReason = parsed.delta?.stop_reason || stopReason;
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }

            const latency = tracker.stop();
            // Use reported tokens or estimate
            if (!inputTokens) inputTokens = Metrics.estimateTokenCount(prompt);
            if (!outputTokens) outputTokens = Metrics.estimateTokenCount(fullText);

            // Check for empty response (truly empty, not just short) - streaming mode
            // Note: Short responses like "4" or "Yes" are valid and should not be flagged
            // Only flag as empty if we have BOTH empty text AND a problematic stop_reason
            // This prevents false positives for short but valid responses
            const hasEmptyText = !fullText || fullText.trim() === '';
            const hasProblematicStopReason = stopReason === 'end_turn' || stopReason === 'max_tokens' || stopReason === 'stop_sequence';

            if (hasEmptyText && hasProblematicStopReason) {
                let errorMsg = 'Empty Response from Claude';
                let suggestion = 'Claude returned no meaningful content. ';

                if (stopReason === 'end_turn') {
                    errorMsg = 'Claude Completed Turn with Empty Response';
                    suggestion = `Claude believes its turn is complete but returned no content. This commonly occurs due to:

• **Prompt Structure**: The model may interpret the conversation as already complete
• **Intermittent Behavior**: Some Claude models occasionally exhibit this behavior (known issue)
• **Context Confusion**: The model may think it already responded

**Recommended Actions**:
1. Try rephrasing your prompt with more explicit instructions
2. Add "Please provide a detailed response" to your prompt
3. If using tool results, avoid adding text immediately after them
4. Retry the request (intermittent issue may resolve)
5. Try a different Claude model (e.g., Haiku or Opus instead of Sonnet)

**Technical Details**: stop_reason="${stopReason}", output_tokens=${outputTokens}, input_tokens=${inputTokens}, streaming=true`;
                } else if (stopReason === 'max_tokens') {
                    errorMsg = 'Response Truncated (Max Tokens Reached)';
                    suggestion = `The response was cut off because it reached the maximum token limit.

**Recommended Actions**:
1. Increase the max_tokens parameter in settings
2. Use a shorter or more focused prompt
3. Break your question into smaller parts

**Technical Details**: stop_reason="${stopReason}", max_tokens_limit=${DEFAULT_PARAMS.max_tokens}`;
                } else if (stopReason === 'stop_sequence') {
                    errorMsg = 'Response Stopped at Stop Sequence';
                    suggestion = `The model encountered a predefined stop sequence.

**Technical Details**: stop_reason="${stopReason}"`;
                }

                return {
                    text: fullText,
                    latency,
                    inputTokens,
                    outputTokens,
                    totalTokens: inputTokens + outputTokens,
                    estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                    warning: errorMsg,
                    warningSuggestion: suggestion,
                    warningType: 'empty_response',
                    stopReason: stopReason,
                    streamed: true
                };
            }

            return {
                text: fullText,
                latency,
                inputTokens,
                outputTokens,
                totalTokens: inputTokens + outputTokens,
                estimatedCost: Metrics.calculateCost(pricing, inputTokens, outputTokens),
                stopReason: stopReason,
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
            // Fetch models from Google API via proxy
            const response = await fetch(`${API_ENDPOINTS.google}/models`, {
                method: 'GET',
                headers: { 'x-api-key': this.apiKey }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();

            // Filter for models that support generateContent and are Gemini models
            const chatModels = (data.models || [])
                .filter(model =>
                    model.supportedGenerationMethods?.includes('generateContent') &&
                    model.name.includes('gemini')
                )
                .map(model => {
                    const id = model.name.replace('models/', '');
                    return {
                        id: id,
                        name: model.displayName || id,
                        provider: 'google',
                        contextWindow: model.inputTokenLimit || 32000,
                        capabilities: model.supportedGenerationMethods || ['generateContent']
                    };
                })
                .sort((a, b) => b.id.localeCompare(a.id));

            return chatModels;
        } catch (error) {
            console.error('Error listing Google models:', error);
            // Fallback to known models if API fails (e.g. no key yet)
            return [
                {
                    id: 'gemini-1.5-pro-latest',
                    name: 'Gemini 1.5 Pro',
                    provider: 'google',
                    contextWindow: 1048576,
                    capabilities: ['generateContent']
                },
                {
                    id: 'gemini-1.5-flash-latest',
                    name: 'Gemini 1.5 Flash',
                    provider: 'google',
                    contextWindow: 1048576,
                    capabilities: ['generateContent']
                },
                {
                    id: 'gemini-pro',
                    name: 'Gemini Pro',
                    provider: 'google',
                    contextWindow: 30720,
                    capabilities: ['generateContent']
                }
            ];
        }
    }

    async makeRequest(modelId, prompt, options = {}, onChunk = null) {
        const tracker = Metrics.createPerformanceTracker();
        const pricing = getModelPricing(modelId);

        const temperature = options.temperature !== undefined ? options.temperature : DEFAULT_PARAMS.temperature;
        const maxTokens = options.maxTokens !== undefined ? options.maxTokens : DEFAULT_PARAMS.max_tokens;

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
                        temperature: temperature,
                        maxOutputTokens: maxTokens
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

            // Process any remaining buffer content
            if (buffer && buffer.trim()) {
                const lines = buffer.split('\n');
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
                        } catch (e) { /* ignore */ }
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

    static async executeRequest(modelConfig, prompt, apiKey, options = {}, onChunk = null) {
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
            const result = await provider.makeRequest(modelConfig.id, prompt, options, onChunk);

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
