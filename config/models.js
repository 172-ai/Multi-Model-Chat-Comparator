// Dynamic model configuration system
// Models are now discovered from APIs, this file provides fallback pricing and configuration

// API endpoint configurations - using backend proxy to avoid CORS issues
export const API_ENDPOINTS = {
  openai: '/api/proxy/openai',
  anthropic: '/api/proxy/anthropic',
  google: '/api/proxy/google'
};

// Pricing fallbacks for known models (per 1K tokens)
// These are used when model pricing isn't available from API
export const PRICING_FALLBACKS = {
  // OpenAI
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4-turbo-preview': { input: 0.01, output: 0.03 },
  'gpt-4-0125-preview': { input: 0.01, output: 0.03 },
  'gpt-4-1106-preview': { input: 0.01, output: 0.03 },
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-0613': { input: 0.03, output: 0.06 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-0125': { input: 0.0005, output: 0.0015 },
  'gpt-3.5-turbo-1106': { input: 0.001, output: 0.002 },

  // Anthropic
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-5-sonnet-20240620': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },

  // Google
  'gemini-2.5-pro': { input: 0.00125, output: 0.005 },
  'gemini-2.5-flash': { input: 0.000075, output: 0.0003 },
  'gemini-2.0-flash': { input: 0.0001, output: 0.0001 }, // Approximate / Free tier often applies
  'gemini-flash-latest': { input: 0.000075, output: 0.0003 },
  'gemini-pro-latest': { input: 0.0005, output: 0.0015 }
};

// Import the pricing service for dynamic pricing
import { pricingService } from '../api/pricing-service.js';

// Get pricing information for a model (async version with OpenRouter API)
// Returns pricing from OpenRouter API with fallback to hardcoded values
export async function getModelPricingAsync(modelId) {
  // Try to get pricing from OpenRouter API first
  const dynamicPricing = await pricingService.getPricing(modelId);
  if (dynamicPricing) {
    return dynamicPricing;
  }

  // Fall back to hardcoded pricing
  return getModelPricing(modelId);
}

// Get pricing information for a model (sync version - uses fallbacks only)
// Returns null if pricing not available (graceful handling for new/unknown models)
export function getModelPricing(modelId) {
  // Check exact match first
  if (PRICING_FALLBACKS[modelId]) {
    return PRICING_FALLBACKS[modelId];
  }

  // Check for partial matches (e.g., "gpt-4-turbo-2024-04-09" matches "gpt-4-turbo")
  for (const [key, pricing] of Object.entries(PRICING_FALLBACKS)) {
    if (modelId.startsWith(key)) {
      return pricing;
    }
  }

  return null;
}

// Streaming configuration
export const STREAMING_CONFIG = {
  enabled: true, // Can be toggled by user
  chunkDelay: 0, // No artificial delay
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000 // 60 seconds timeout for streaming connections
};

// Timeout settings (in milliseconds)
export const TIMEOUT_CONFIG = {
  streaming: 60000,      // 60 seconds for streaming requests
  nonStreaming: 30000,   // 30 seconds for non-streaming requests
  connection: 10000      // 10 seconds for initial connection
};

// Model capability detection
export function isModelChatCapable(modelId, capabilities = []) {
  // OpenAI models
  if (modelId.includes('gpt-4') || modelId.includes('gpt-3.5')) {
    return true;
  }

  // Anthropic models (all Claude models support chat)
  if (modelId.includes('claude')) {
    return true;
  }

  // Google models - check for generateContent capability
  if (capabilities.includes('generateContent')) {
    return true;
  }

  // Gemini models
  if (modelId.includes('gemini')) {
    return true;
  }

  return false;
}

// Extract display name from model ID
export function getDisplayName(modelId) {
  // Remove version suffixes and format nicely
  const name = modelId
    .replace(/-\d{8}$/, '') // Remove date suffixes like -20240229
    .replace(/-\d{4}-\d{2}-\d{2}$/, '') // Remove date suffixes like -2024-04-09
    .replace(/-latest$/, '') // Remove -latest suffix
    .replace(/-preview$/, '') // Remove -preview suffix
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return name;
}

// Provider detection from model ID
export function getProviderFromModelId(modelId) {
  if (modelId.startsWith('gpt-')) return 'openai';
  if (modelId.startsWith('claude-')) return 'anthropic';
  if (modelId.startsWith('gemini-')) return 'google';
  return 'unknown';
}

// Default parameters for requests
export const DEFAULT_PARAMS = {
  temperature: 0.7,
  max_tokens: 2048,
  stream: true
};

