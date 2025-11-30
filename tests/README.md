# Testing

## Running Tests

```bash
# Run unit tests
node tests/run-tests.js
```

## Test Coverage

### Empty Response Detection

- ✅ Detects empty responses (0 tokens)
- ✅ Detects very short responses (≤5 tokens, <10 chars)
- ✅ Does NOT flag normal responses as empty
- ✅ Detects null stop_reason as streaming timeout

### Cost Calculation

- ✅ Formats costs in dollars correctly
- ✅ Does NOT include per-mille symbol (‰)
- ✅ Handles zero costs
- ✅ Handles very small costs with precision

### Streaming Preference

- ✅ Defaults to streaming enabled
- ✅ Persists user preference
- ✅ App respects preference when making requests

## Manual Testing Checklist

### Empty Response Scenarios

- [ ] Test with simple prompt ("hello") that triggers empty responses
- [ ] Verify orange warning box appears
- [ ] Check "Show Raw Response" displays full JSON
- [ ] Verify stop_reason is captured correctly
- [ ] Test with different Claude models

### Streaming Toggle

- [ ] Disable streaming in settings
- [ ] Verify responses arrive all at once (not streamed)
- [ ] Re-enable streaming
- [ ] Verify responses stream in real-time

### Timeout Handling

- [ ] Test with slow network connection
- [ ] Verify timeout errors are detected
- [ ] Check diagnostic message for null stop_reason

### Cost Display

- [ ] Verify costs show in dollars ($)
- [ ] No per-mille symbol (‰)
- [ ] Correct precision for small amounts

## Automated Test Results

Run `node tests/run-tests.js` to see current test status.
