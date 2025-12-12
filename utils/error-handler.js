// Enhanced error handling utilities
export class ErrorHandler {
    static parseError(error, provider, modelId) {
        if (!error) {
            return {
                message: 'Unknown error occurred',
                suggestion: 'An unexpected error occurred. Please try again.',
                type: 'unknown',
                provider,
                modelId,
                timestamp: new Date().toISOString()
            };
        }

        // Extract error message from various API response formats
        let message = error.message || String(error) || 'Unknown error occurred';
        let suggestion = '';
        let type = 'unknown';

        // Parse error based on provider
        if (provider === 'openai') {
            ({ message, suggestion, type } = this.parseOpenAIError(error, message));
        } else if (provider === 'anthropic') {
            ({ message, suggestion, type } = this.parseAnthropicError(error, message));
        } else if (provider === 'google') {
            ({ message, suggestion, type } = this.parseGoogleError(error, message));
        }

        return {
            message,
            suggestion,
            type,
            provider,
            modelId,
            timestamp: new Date().toISOString()
        };
    }

    static parseOpenAIError(error, defaultMessage) {
        let message = defaultMessage;
        let suggestion = '';
        let type = 'unknown';

        // Check for specific error patterns
        if (message.includes('401') || message.includes('Incorrect API key')) {
            type = 'auth';
            message = 'Invalid API key';
            suggestion = 'Please check your OpenAI API key in settings and ensure it\'s correct.';
        } else if (message.includes('429') || message.includes('Rate limit')) {
            type = 'rate_limit';
            message = 'Rate limit exceeded';
            suggestion = 'You\'ve made too many requests. Please wait a few moments and try again.';
        } else if (message.includes('quota')) {
            type = 'quota';
            message = 'Quota exceeded';
            suggestion = 'You\'ve exceeded your API usage quota. Check your OpenAI account billing.';
        } else if (message.includes('model') && message.includes('does not exist')) {
            type = 'model_not_found';
            message = 'Model not available';
            suggestion = 'This model may have been deprecated. Try refreshing the model list in settings.';
        } else if (message.includes('timeout') || message.includes('ECONNABORTED')) {
            type = 'timeout';
            message = 'Request timed out';
            suggestion = 'The request took too long. Try again or use a different model.';
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            type = 'network';
            message = 'Network error';
            suggestion = 'Please check your internet connection and try again.';
        }

        return { message, suggestion, type };
    }

    static parseAnthropicError(error, defaultMessage) {
        let message = defaultMessage;
        let suggestion = '';
        let type = 'unknown';

        if (message.includes('401') || message.includes('authentication')) {
            type = 'auth';
            message = 'Invalid API key';
            suggestion = 'Please check your Anthropic API key in settings and ensure it\'s correct.';
        } else if (message.includes('429') || message.includes('rate_limit')) {
            type = 'rate_limit';
            message = 'Rate limit exceeded';
            suggestion = 'You\'ve made too many requests. Please wait a few moments and try again.';
        } else if (message.includes('overloaded')) {
            type = 'overloaded';
            message = 'Service overloaded';
            suggestion = 'Anthropic\'s servers are currently busy. Please try again in a moment.';
        } else if (message.includes('model_not_found') || message.includes('model does not exist') || message.includes('invalid model')) {
            type = 'model_not_found';
            message = 'Model not available';
            suggestion = 'This model may not be available. Try refreshing the model list in settings.';
        } else if (message.includes('timeout')) {
            type = 'timeout';
            message = 'Request timed out';
            suggestion = 'The request took too long. Try again or use a different model.';
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            type = 'network';
            message = 'Network error';
            suggestion = 'Please check your internet connection and try again.';
        }

        return { message, suggestion, type };
    }

    static parseGoogleError(error, defaultMessage) {
        let message = defaultMessage;
        let suggestion = '';
        let type = 'unknown';

        if (message.includes('401') || message.includes('API key')) {
            type = 'auth';
            message = 'Invalid API key';
            suggestion = 'Please check your Google API key in settings and ensure it\'s correct.';
        } else if (message.includes('429') || message.includes('quota')) {
            type = 'rate_limit';
            message = 'Rate limit or quota exceeded';
            suggestion = 'You\'ve exceeded your quota. Check your Google Cloud console for limits.';
        } else if (message.includes('404') || message.includes('not found')) {
            type = 'model_not_found';
            message = 'Model not found';
            suggestion = 'This model may not be available in your region. Try refreshing the model list.';
        } else if (message.includes('SAFETY')) {
            type = 'safety';
            message = 'Content filtered by safety settings';
            suggestion = 'Your prompt was blocked by safety filters. Try rephrasing your request.';
        } else if (message.includes('timeout')) {
            type = 'timeout';
            message = 'Request timed out';
            suggestion = 'The request took too long. Try again or use a different model.';
        } else if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
            type = 'network';
            message = 'Network error';
            suggestion = 'Please check your internet connection and try again.';
        }

        return { message, suggestion, type };
    }

    static formatErrorForDisplay(errorInfo) {
        return {
            title: errorInfo.message,
            description: errorInfo.suggestion,
            type: errorInfo.type,
            canRetry: ['timeout', 'network', 'rate_limit', 'overloaded'].includes(errorInfo.type)
        };
    }
}
