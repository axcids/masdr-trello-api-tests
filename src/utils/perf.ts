import type { TimedResponse } from '../clients/trello.client';
import { summarise, type LatencyStats } from './stats';

export interface MeasurementResult {
    stats: LatencyStats;
    rateLimited: number;
    warmup: number;
}


export async function measureLatency<T>(
    operation: () => Promise<TimedResponse<T>>,
    options: { iterations: number; warmupIterations?: number },
): Promise<MeasurementResult> {
    const warmup = options.warmupIterations ?? 2;
    const durations: number[] = [];
    let rateLimited = 0;

    for (let i = 0; i < warmup + options.iterations; i += 1) {
        const response = await operation();

        if (i < warmup) continue;

        if (response.attempts > 1) {
            rateLimited += 1;
            continue;
        }

        durations.push(response.durationMs);
    }

    return { stats: summarise(durations), rateLimited, warmup };
}