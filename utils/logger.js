// Centralized logging utility
export class Logger {
    static DEBUG = process.env.DEBUG === 'true' || false;

    static log(level, category, message, data = {}) {
        const timestamp = new Date().toISOString();

        // Structured logging object
        const logEntry = {
            timestamp,
            level,
            category,
            message,
            ...data
        };

        // In production/cloud environments, log as a JSON string
        // This prevents the "empty logs" issue where cloud providers swallow object arguments
        if (process.env.NODE_ENV === 'production' || !this.DEBUG) {
            console.log(JSON.stringify(logEntry));
        } else {
            // Development mode - separate arguments for readability
            const prefix = `[${timestamp}] [${level}] [${category}]`;
            console.log(prefix, message);
            if (Object.keys(data).length > 0) {
                console.log(JSON.stringify(data, null, 2));
            }
        }
    }

    static error(category, message, error, data = {}) {
        const errorData = {
            ...data,
            error: {
                message: error.message,
                stack: error.stack,
                type: error.name
            }
        };
        this.log('ERROR', category, message, errorData);
    }

    static info(category, message, data = {}) {
        this.log('INFO', category, message, data);
    }

    static debug(category, message, data = {}) {
        if (this.DEBUG) {
            this.log('DEBUG', category, message, data);
        }
    }

    static warn(category, message, data = {}) {
        this.log('WARN', category, message, data);
    }
}
