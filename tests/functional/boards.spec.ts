import { test, expect } from '../../src/fixtures/trello.fixtures';
import { uniqueName } from '../../src/utils/naming';
import * as allure from 'allure-js-commons';

import type { TrelloBoard } from '../../src/types/trello.types';

test.describe('Boards endpoint', () => {
    test.beforeEach(async () => {
        await allure.epic('Trello API');
        await allure.feature('Boards');
        await allure.tag('functional');
    });
    test.describe('POST /boards', () => {
        test('creates a board with only the required name', async ({ createBoard }) => {
            const name = uniqueName('board');
            const response = await createBoard({ name });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
            expect(response.body.closed).toBe(false);
            expect(response.body.id).toMatch(/^[0-9a-f]{24}$/);
            expect(response.body.url).toContain('trello.com');
        });

        test('honours the optional description and defaultLists flag', async ({ createBoard, trello, }) => {
            const response = await createBoard({ desc: 'A described board', defaultLists: false });

            expect(response.status).toBe(200);
            expect(response.body.desc).toBe('A described board');

            const lists = await trello.get<unknown[]>(`/boards/${response.body.id}/lists`);
            expect(lists.body).toHaveLength(0);
        });

        test('creates the three default lists when defaultLists is true', async ({
            createBoard,
            trello,
        }) => {
            const response = await createBoard({ defaultLists: true });
            expect(response.status).toBe(200);

            const lists = await trello.get<{ name: string }[]>(`/boards/${response.body.id}/lists`);
            expect(lists.body).toHaveLength(3);
            expect(lists.body.map((l) => l.name)).toEqual(['To Do', 'Doing', 'Done']);
        });

        test('accepts non-Latin characters in the board name', async ({ createBoard }) => {
            const name = `${uniqueName('board')}-لوحة-اختبار`;
            const response = await createBoard({ name });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
        });

        test('rejects a request with no name', async ({ trello }) => {
            const response = await trello.post('/boards/', {});
            expect(response.status).toBe(400);
        });

        test('rejects an empty name', async ({ trello }) => {
            const response = await trello.post('/boards/', { name: '' });
            expect(response.status).toBe(400);
        });

        test('rejects an unauthenticated request', async ({ trello }) => {
            const response = await trello.post('/boards/', {
                name: uniqueName('board'),
                token: 'invalid-token',
            });
            expect(response.status).toBe(401);
        });
    });

    test.describe('GET /boards/{id}', () => {
        test('returns the board that was created', async ({ trello, board }) => {
            const response = await trello.get<TrelloBoard>(`/boards/${board.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(board.id);
            expect(response.body.name).toBe(board.name);
        });

        test('returns 404 for a well-formed but unknown id', async ({ trello }) => {
            const response = await trello.get('/boards/000000000000000000000000');
            expect(response.status).toBe(404);
        });

        test('rejects a malformed id', async ({ trello }) => {
            const response = await trello.get('/boards/not-a-valid-id');
            expect([400, 404]).toContain(response.status);
        });
    });

    test.describe('PUT /boards/{id}', () => {
        test('updates the name and description', async ({ trello, board }) => {
            const newName = `${board.name}-renamed`;
            const response = await trello.put<TrelloBoard>(`/boards/${board.id}`, {
                name: newName,
                desc: 'Updated description',
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(newName);

            const readBack = await trello.get<TrelloBoard>(`/boards/${board.id}`);
            expect(readBack.body.name).toBe(newName);
            expect(readBack.body.desc).toBe('Updated description');
        });

        test('archives the board when closed is set', async ({ createBoard, trello }) => {
            const created = await createBoard();
            const response = await trello.put<TrelloBoard>(`/boards/${created.body.id}`, {
                closed: true,
            });

            expect(response.status).toBe(200);
            expect(response.body.closed).toBe(true);
        });

        test('returns 404 when updating an unknown board', async ({ trello }) => {
            const response = await trello.put('/boards/000000000000000000000000', { name: 'x' });
            expect(response.status).toBe(404);
        });
    });

    test.describe('DELETE /boards/{id}', () => {
        test('deletes a board and makes it unreachable', async ({ createBoard, trello }) => {
            const created = await createBoard();

            const response = await trello.delete(`/boards/${created.body.id}`);
            expect(response.status).toBe(200);

            const lookup = await trello.get(`/boards/${created.body.id}`);
            expect(lookup.status).toBe(404);
        });

        test('returns 404 when deleting an unknown board', async ({ trello }) => {
            const response = await trello.delete('/boards/000000000000000000000000');
            expect(response.status).toBe(404);
        });
    });
});