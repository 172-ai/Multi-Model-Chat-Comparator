// Export functionality for JSON download
export class Exporter {
    static exportToJSON(data) {
        const exportData = {
            exportedAt: new Date().toISOString(),
            prompt: data.prompt,
            responses: data.responses.map(response => ({
                model: response.model,
                provider: response.provider,
                response: response.text,
                metrics: {
                    latency: response.latency,
                    inputTokens: response.inputTokens,
                    outputTokens: response.outputTokens,
                    totalTokens: response.totalTokens,
                    estimatedCost: response.estimatedCost
                },
                metadata: {
                    contextWindow: response.contextWindow,
                    timestamp: response.timestamp
                },
                error: response.error || null
            })),
            summary: {
                totalModels: data.responses.length,
                successfulResponses: data.responses.filter(r => !r.error).length,
                failedResponses: data.responses.filter(r => r.error).length,
                totalCost: data.responses.reduce((sum, r) => sum + (r.estimatedCost || 0), 0),
                averageLatency: this.calculateAverageLatency(data.responses)
            }
        };

        return exportData;
    }

    static calculateAverageLatency(responses) {
        const validLatencies = responses
            .filter(r => !r.error && r.latency)
            .map(r => r.latency);

        if (validLatencies.length === 0) return 0;

        const sum = validLatencies.reduce((a, b) => a + b, 0);
        return sum / validLatencies.length;
    }

    static downloadJSON(data, filename = 'llm-comparison') {
        const exportData = this.exportToJSON(data);
        const jsonString = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const fullFilename = `${filename}-${timestamp}.json`;

        const link = document.createElement('a');
        link.href = url;
        link.download = fullFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}
