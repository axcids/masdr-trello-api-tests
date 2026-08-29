import { test, expect } from '@playwright/test';
import { TrelloClient } from '../../src/clients/trello.client';
import type { TrelloError } from '../../src/types/trello.types';

test.describe('API connectivity and authentication', () => {
    test('returns the authenticated member for valid credentials', async ({ request }) => {
        const trello = new TrelloClient(request);
        const response = await trello.get<{ id: string; username: string }>(
            '/members/me',
            { fields: 'id,username' },
        );
        expect(response.status).toBe(200);
        expect(response.body.id).toBeTruthy();
        expect(response.body.username).toBeTruthy();
        expect(response.attempts).toBe(1);
    });

    test('rejects a request carrying an invalid token', async ({ request }) => {
        const trello = new TrelloClient(request);
        const response = await trello.get<TrelloError | string>(
            '/members/me',
            { token: 'not-a-valid-token' },
        );
        expect(response.status).toBe(401);
    });

    test('rejects a request carrying an invalid key', async ({ request }) => {
        const trello = new TrelloClient(request);
        const response = await trello.get<TrelloError | string>(
            '/members/me',
            { key: 'not-a-valid-key' },
        );
        expect(response.status).toBe(401);
    });
});