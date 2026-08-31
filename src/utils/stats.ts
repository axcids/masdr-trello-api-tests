export interface LatencyStats {
    samples: number;
    min: number;
    mean: number;
    p50: number;
    p90: number;
    p95: number;
    max: number;
}

export function percentile(sortedAscending: number[], p: number): number {
    if (sortedAscending.length === 0) return NaN;
    const rank = Math.ceil((p / 100) * sortedAscending.length);
    return sortedAscending[Math.min(rank, sortedAscending.length) - 1];
}

export function summarise(durations: number[]): LatencyStats {
    const sorted = [...durations].sort((a, b) => a - b);
    const round = (n: number) => Math.round(n * 100) / 100;

    return {
        samples: sorted.length,
        min: round(sorted[0] ?? NaN),
        mean: round(sorted.reduce((sum, n) => sum + n, 0) / sorted.length),
        p50: round(percentile(sorted, 50)),
        p90: round(percentile(sorted, 90)),
        p95: round(percentile(sorted, 95)),
        max: round(sorted[sorted.length - 1] ?? NaN),
    };
}