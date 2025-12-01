# Anthropic Model Error: "model: {modelId}"

## Problem

Some Anthropic models return an error with the exact format: `"model: claude-3-5-sonnet-20241022"`

## Root Cause

This is the **actual error message returned by Anthropic's API**, not a bug in our code.

## Failing Models

- claude-3-5-sonnet-20241022
- claude-3-5-sonnet-20240620  
- claude-3-sonnet-20240229

## Working Models

- claude-3-opus-20240229 ✅
- claude-3-haiku-20240307 ✅

## Likely Causes

### 1. Model Not Available on API Key's Tier

Some Claude models require specific API access tiers. The error "model: {modelId}" typically indicates:

- Model doesn't exist
- Model not available for your API tier
- Model has been deprecated/renamed

### 2. Model Name Changed

Anthropic occasionally renames or deprecates models. The failing models might have been:

- Renamed (e.g., "claude-3-5-sonnet-20241022" → "claude-3-5-sonnet-latest")
- Deprecated entirely
- Moved to a different tier

## Solutions

### Immediate Fix

**Remove deprecated models from config:**

```javascript
// config/models.js - Remove or update these models
{
  id: 'claude-3-5-sonnet-20241022', // ← REMOVE
  id: 'claude-3-5-sonnet-20240620',  // ← REMOVE  
  id: 'claude-3-sonnet-20240229',   // ← REMOVE
}
```

### Long-term Fix

1. **Use Anthropic's Models API** (if available) to dynamically fetch available models
2. **Validate models** against user's API key tier
3. **Show clear error** explaining model unavailability

## Recommended Action

Check Anthropic's documentation for:

1. Current model naming conventions
2. Which models are available
3. API tier requirements

## Error Message Improvement

Instead of showing `"model: claude-3-5-sonnet-20241022"`, show:

```
Model Not Available: claude-3-5-sonnet-20241022

This model is not available with your Anthropic API key.

Possible reasons:
• Model has been deprecated or renamed
• Your API tier doesn't include this model
• Model ID is incorrect

Please check Anthropic's documentation for available models.
```
