// Centralized logging utility
export class Logger {
    static DEBUG = process.env.DEBUG === 'true' || false;

    static log(level, category, message, data = {}) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level}] [${category}]`;

        console.log(prefix, message);
        if (Object.keys(data).length > 0) {
            console.log(JSON.stringify(data, null, 2));
        }
    }

    static error(category, message, error, data = {}) {
        this.log('ERROR', category, message, {
            ...data,
            error: {
                message: error.message,
                stack: error.stack
            }
        });
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
