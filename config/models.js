// Model configurations and pricing information
export const MODEL_CONFIGS = {
  // OpenAI Models
  'gpt-4-turbo': {
    provider: 'openai',
    name: 'GPT-4 Turbo',
    displayName: 'GPT-4 Turbo',
    contextWindow: 128000,
    pricing: {
      input: 0.01 / 1000,  // $0.01 per 1K input tokens
      output: 0.03 / 1000  // $0.03 per 1K output tokens
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },
  'gpt-4': {
    provider: 'openai',
    name: 'GPT-4',
    displayName: 'GPT-4',
    contextWindow: 8192,
    pricing: {
      input: 0.03 / 1000,
      output: 0.06 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },
  'gpt-3.5-turbo': {
    provider: 'openai',
    name: 'GPT-3.5 Turbo',
    displayName: 'GPT-3.5 Turbo',
    contextWindow: 16385,
    pricing: {
      input: 0.0005 / 1000,
      output: 0.0015 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },

  // Anthropic Models
  'claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    name: 'claude-3-5-sonnet-20241022',
    displayName: 'Claude 3.5 Sonnet',
    contextWindow: 200000,
    pricing: {
      input: 0.003 / 1000,
      output: 0.015 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },
  'claude-3-opus-20240229': {
    provider: 'anthropic',
    name: 'claude-3-opus-20240229',
    displayName: 'Claude 3 Opus',
    contextWindow: 200000,
    pricing: {
      input: 0.015 / 1000,
      output: 0.075 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },
  'claude-3-haiku-20240307': {
    provider: 'anthropic',
    name: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    contextWindow: 200000,
    pricing: {
      input: 0.00025 / 1000,
      output: 0.00125 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      max_tokens: 2048
    }
  },

  // Google Models
  'gemini-1.5-pro': {
    provider: 'google',
    name: 'gemini-1.5-pro',
    displayName: 'Gemini 1.5 Pro',
    contextWindow: 2000000,
    pricing: {
      input: 0.00125 / 1000,
      output: 0.005 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  },
  'gemini-1.5-flash': {
    provider: 'google',
    name: 'gemini-1.5-flash',
    displayName: 'Gemini 1.5 Flash',
    contextWindow: 1000000,
    pricing: {
      input: 0.000075 / 1000,
      output: 0.0003 / 1000
    },
    defaultParams: {
      temperature: 0.7,
      maxOutputTokens: 2048
    }
  }
};

// API endpoint configurations
export const API_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  google: 'https://generativelanguage.googleapis.com/v1beta/models'
};

// Default enabled models
export const DEFAULT_MODELS = [
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-5-sonnet-20241022',
  'claude-3-haiku-20240307',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
];
