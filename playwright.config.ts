import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
    // Directory where the tests are located.
    testDir: './tests',
    // Fail the build if a stray test.only was committed.
    forbidOnly: !!process.env.CI,
    // Timeout for api calls 
    timeout: 30_000, // 30 seconds
    expect: { timeout: 5_000 }, // Generous timeout hides latency problems.
    // Parallelize test files 
    fullyParallel: true,
    // Trello allows 100 requests per 10s per token. Concurrency is capped. so the suite never becomes the reason a test fails
    workers: process.env.CI ? 2 : 4,
    // Retries 
    retries: process.env.CI ? 2 : 0, //in CI only
    // Reporters 
    reporter: [
        ['list'],
        ['html', { open: 'never' }],
    ],
    // Shared settings for all the projects below.
    use: {
        baseURL: process.env.TRELLO_BASE_URL ?? 'https://api.trello.com/1',
        extraHTTPHeaders: { Accept: 'application/json' },
        trace: 'on-first-retry',
    },
    // Define projects 
    projects: [
        { name: 'e2e', testDir: './tests/e2e' },
        { name: 'functional', testDir: './tests/functional' },
        { name: 'performance', testDir: './tests/performance' },
    ],
});