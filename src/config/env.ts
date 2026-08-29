import 'dotenv/config';

function required(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}\n` +
            `Copy .env.example to .env and fill in your Trello credentials.\n` +
            `Generate them at https://trello.com/apps/admin`
        );
    }
    return value;
}

export const config = {
    apiKey: required('TRELLO_API_KEY'),
    token: required('TRELLO_TOKEN'),
    baseUrl: process.env.TRELLO_BASE_URL?.trim() || 'https://api.trello.com/1',

    // Every resource this suite creates carries this prefix, so orphaned
    // test data is identifiable and safe to clean up automatically.
    resourcePrefix: process.env.TRELLO_RESOURCE_PREFIX?.trim() || 'masdr-test-',

    // Response-time budgets in ms, asserted by the performance suite.
    sla: {
        read: Number(process.env.SLA_READ_MS ?? 1000),
        write: Number(process.env.SLA_WRITE_MS ?? 1500),
    },
} as const;

// Auth query parameters required on every Trello API call.
export const authParams = {
    key: config.apiKey,
    token: config.token,
} as const;