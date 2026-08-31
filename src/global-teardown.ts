import { config } from './config/env';
import { sweepBoards } from './utils/cleanup';

export default async function globalTeardown(): Promise<void> {
    const runId = process.env.TEST_RUN_ID;
    if (!runId) return;

    // No age gate: anything still here from THIS run is a genuine leak.
    await sweepBoards({ prefix: `${config.resourcePrefix}-${runId}-` });
}