import { randomUUID } from 'node:crypto';
import { config } from './config/env';
import { sweepBoards } from './utils/cleanup';

/** Boards untouched for this long are treated as orphans from a dead run. */
const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000;

export default async function globalSetup(): Promise<void> {
    process.env.TEST_RUN_ID = randomUUID().slice(0, 8);
    console.log(`[setup] test run id: ${process.env.TEST_RUN_ID}`);

    // Clear leftovers from earlier runs that died before teardown.
    // Age-gated, so a concurrent run's live boards are never touched.
    await sweepBoards({
        prefix: `${config.resourcePrefix}-`,
        olderThanMs: ORPHAN_AGE_MS,
    });
}