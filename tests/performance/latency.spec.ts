import { test, expect } from '../../src/fixtures/trello.fixtures';
import { config } from '../../src/config/env';
import { measureLatency } from '../../src/utils/perf';
import { uniqueName } from '../../src/utils/naming';
import * as allure from 'allure-js-commons';

import type { LatencyStats } from '../../src/utils/stats';
import type { TrelloCard } from '../../src/types/trello.types';

const ITERATIONS = Number(process.env.PERF_ITERATIONS ?? 20);


const MIN_SAMPLE_RATIO = 0.8;

async function report(name: string, stats: LatencyStats, rateLimited: number) {
    await test.info().attach(`${name}-latency`, {
        body: JSON.stringify({ ...stats, rateLimited }, null, 2),
        contentType: 'application/json',
    });
    console.log(
        `[perf] ${name}: n=${stats.samples} p50=${stats.p50}ms ` +
        `p90=${stats.p90}ms p95=${stats.p95}ms max=${stats.max}ms ` +
        `(rate-limited: ${rateLimited})`,
    );
}

test.describe('Endpoint response-time SLAs', () => {
    test.beforeEach(async () => {
        await allure.epic('Trello API');
        await allure.feature('Performance');
        await allure.tag('performance');
    });
    // Serial: concurrent tests would measure contention, not latency.
    test.describe.configure({ mode: 'serial' });

    test(`GET /members/me stays within the ${config.sla.read}ms read budget`, async ({
        trello,
    }) => {
        const { stats, rateLimited } = await measureLatency(
            () => trello.get('/members/me', { fields: 'id' }),
            { iterations: ITERATIONS },
        );

        await report('get-member', stats, rateLimited);

        expect(stats.samples).toBeGreaterThanOrEqual(ITERATIONS * MIN_SAMPLE_RATIO);
        expect(stats.p95).toBeLessThan(config.sla.read);
    });

    test(`GET /boards/{id} stays within the ${config.sla.read}ms read budget`, async ({
        trello,
        board,
    }) => {
        const { stats, rateLimited } = await measureLatency(
            () => trello.get(`/boards/${board.id}`),
            { iterations: ITERATIONS },
        );

        await report('get-board', stats, rateLimited);

        expect(stats.samples).toBeGreaterThanOrEqual(ITERATIONS * MIN_SAMPLE_RATIO);
        expect(stats.p95).toBeLessThan(config.sla.read);
    });

    test(`GET /boards/{id}/lists stays within the ${config.sla.read}ms read budget`, async ({
        trello,
        board,
    }) => {
        const { stats, rateLimited } = await measureLatency(
            () => trello.get(`/boards/${board.id}/lists`),
            { iterations: ITERATIONS },
        );

        await report('get-board-lists', stats, rateLimited);

        expect(stats.samples).toBeGreaterThanOrEqual(ITERATIONS * MIN_SAMPLE_RATIO);
        expect(stats.p95).toBeLessThan(config.sla.read);
    });

    test(`POST /cards stays within the ${config.sla.write}ms write budget`, async ({
        trello,
        list,
    }) => {
        const { stats, rateLimited } = await measureLatency(
            () => trello.post<TrelloCard>('/cards', { idList: list.id, name: uniqueName('card') }),
            { iterations: ITERATIONS },
        );

        await report('post-card', stats, rateLimited);

        expect(stats.samples).toBeGreaterThanOrEqual(ITERATIONS * MIN_SAMPLE_RATIO);
        expect(stats.p95).toBeLessThan(config.sla.write);
    });

    test(`PUT /cards/{id} stays within the ${config.sla.write}ms write budget`, async ({
        trello,
        list,
    }) => {
        const created = await trello.post<TrelloCard>('/cards', {
            idList: list.id,
            name: uniqueName('card'),
        });

        let counter = 0;
        const { stats, rateLimited } = await measureLatency(
            () =>
                trello.put<TrelloCard>(`/cards/${created.body.id}`, {
                    desc: `update ${(counter += 1)}`,
                }),
            { iterations: ITERATIONS },
        );

        await report('put-card', stats, rateLimited);

        expect(stats.samples).toBeGreaterThanOrEqual(ITERATIONS * MIN_SAMPLE_RATIO);
        expect(stats.p95).toBeLessThan(config.sla.write);
    });
});