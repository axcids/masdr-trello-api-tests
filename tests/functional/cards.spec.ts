import { test, expect } from '../../src/fixtures/trello.fixtures';
import { uniqueName } from '../../src/utils/naming';
import * as allure from 'allure-js-commons';

import type { TrelloCard, TrelloList } from '../../src/types/trello.types';

test.describe('Cards endpoint', () => {
    test.beforeEach(async () => {
        await allure.epic('Trello API');
        await allure.feature('Cards');
        await allure.tag('functional');
    });
    test.describe('POST /cards', () => {
        test('creates a card with idList as the only required parameter', async ({
            trello,
            list,
        }) => {
            // Trello's spec marks only idList as required - name is optional.
            const response = await trello.post<TrelloCard>('/cards', { idList: list.id });

            expect(response.status).toBe(200);
            expect(response.body.idList).toBe(list.id);
            expect(response.body.id).toMatch(/^[0-9a-f]{24}$/);
            expect(response.body.name).toBe('');
        });

        test('creates a card with name, description and due date', async ({ trello, list }) => {
            const name = uniqueName('card');
            const due = new Date(Date.now() + 86_400_000).toISOString();

            const response = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name,
                desc: 'A described task',
                due,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
            expect(response.body.desc).toBe('A described task');
            expect(response.body.due).not.toBeNull();
            expect(response.body.dueComplete).toBe(false);
        });

        test('places a card at the top when pos is top', async ({ trello, list }) => {
            const first = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
            });
            const second = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
                pos: 'top',
            });

            expect(second.status).toBe(200);
            expect(Number(second.body.pos)).toBeLessThan(Number(first.body.pos));
        });

        test('rejects a request with no idList', async ({ trello }) => {
            const response = await trello.post('/cards', { name: uniqueName('card') });
            expect(response.status).toBe(400);
        });

        test('rejects an unknown idList', async ({ trello }) => {
            // Predicted 401 by analogy with POST /lists and an unknown idBoard:
            // Trello cannot distinguish "absent" from "not permitted".
            const response = await trello.post('/cards', {
                idList: '000000000000000000000000',
                name: uniqueName('card'),
            });
            expect(response.status).toBe(404);
        });

        test('rejects an unauthenticated request', async ({ trello, list }) => {
            const response = await trello.post('/cards', {
                idList: list.id,
                name: uniqueName('card'),
                token: 'invalid-token',
            });
            expect(response.status).toBe(401);
        });
    });

    test.describe('GET /cards/{id}', () => {
        test('returns the card that was created', async ({ trello, list }) => {
            const name = uniqueName('card');
            const created = await trello.post<TrelloCard>('/cards', { idList: list.id, name });

            const response = await trello.get<TrelloCard>(`/cards/${created.body.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(created.body.id);
            expect(response.body.name).toBe(name);
            expect(response.body.idList).toBe(list.id);
        });

        test('returns 404 for an unknown card', async ({ trello }) => {
            const response = await trello.get('/cards/000000000000000000000000');
            expect(response.status).toBe(404);
        });
    });

    test.describe('PUT /cards/{id}', () => {
        test('updates the name and description', async ({ trello, list }) => {
            const created = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
            });

            const response = await trello.put<TrelloCard>(`/cards/${created.body.id}`, {
                name: 'renamed task',
                desc: 'updated description',
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('renamed task');

            const readBack = await trello.get<TrelloCard>(`/cards/${created.body.id}`);
            expect(readBack.body.name).toBe('renamed task');
            expect(readBack.body.desc).toBe('updated description');
        });

        test('marks a card as complete', async ({ trello, list }) => {
            const due = new Date(Date.now() + 86_400_000).toISOString();
            const created = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
                due,
            });

            const response = await trello.put<TrelloCard>(`/cards/${created.body.id}`, {
                dueComplete: true,
            });

            expect(response.status).toBe(200);
            expect(response.body.dueComplete).toBe(true);
        });

        test('moves a card to a different list on the same board', async ({
            trello,
            board,
            list,
        }) => {
            const target = await trello.post<TrelloList>('/lists', {
                name: uniqueName('list'),
                idBoard: board.id,
            });
            const created = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
            });

            const response = await trello.put<TrelloCard>(`/cards/${created.body.id}`, {
                idList: target.body.id,
            });

            expect(response.status).toBe(200);
            expect(response.body.idList).toBe(target.body.id);

            const inTarget = await trello.get<TrelloCard[]>(`/lists/${target.body.id}/cards`);
            expect(inTarget.body.map((c) => c.id)).toContain(created.body.id);
        });

        test('returns 404 when updating an unknown card', async ({ trello }) => {
            const response = await trello.put('/cards/000000000000000000000000', { name: 'x' });
            expect(response.status).toBe(404);
        });
    });

    test.describe('DELETE /cards/{id}', () => {
        test('deletes a card and makes it unreachable', async ({ trello, list }) => {
            const created = await trello.post<TrelloCard>('/cards', {
                idList: list.id,
                name: uniqueName('card'),
            });

            const response = await trello.delete(`/cards/${created.body.id}`);
            expect(response.status).toBe(200);

            const lookup = await trello.get(`/cards/${created.body.id}`);
            expect(lookup.status).toBe(404);
        });

        test('returns 404 when deleting an unknown card', async ({ trello }) => {
            const response = await trello.delete('/cards/000000000000000000000000');
            expect(response.status).toBe(404);
        });
    });
});