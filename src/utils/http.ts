import type { APIResponse } from '@playwright/test';

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Trello returns JSON on success, but plain text for several error cases
 * (e.g. "invalid token", "The requested resource was not found.").
 * Parsing blindly as JSON throws and masks the real failure, so we fall
 * back to raw text and let the test assert on whichever it gets.
 */

export async function parseBody<T>(response: APIResponse): Promise<T> {
    const text = await response.text();
    if (!text) return undefined as T;
    try {
        return JSON.parse(text) as T;
    } catch {
        return text as unknown as T;
    }
}