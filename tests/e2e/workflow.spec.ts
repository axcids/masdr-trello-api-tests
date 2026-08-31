import { test, expect } from '../../src/fixtures/trello.fixtures';
import { uniqueName } from '../../src/utils/naming';
import * as allure from 'allure-js-commons';

import type { TrelloBoard, TrelloList, TrelloCard } from '../../src/types/trello.types';

test.describe('Trello end-to-end workflow', () => {
    test.beforeEach(async () => {
        await allure.epic('Trello API');
        await allure.feature('End-to-end workflow');
        await allure.severity(allure.Severity.CRITICAL);
        await allure.tag('e2e');
    });
    test('creates a board, list and card, updates the card, then removes everything', async ({trello, }) => {
        // Resources are created and destroyed by the test itself, because
        // teardown is part of the workflow under test. The run-scoped orphan
        // sweep is the safety net if an assertion fails before cleanup.
        let board!: TrelloBoard;
        let list!: TrelloList;
        let card!: TrelloCard;

        await test.step('create a board', async () => {
            const name = uniqueName('board');
            const response = await trello.post<TrelloBoard>('/boards/', {
                name,
                desc: 'Board created by the end-to-end workflow test.',
                defaultLists: false,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
            expect(response.body.closed).toBe(false);
            expect(response.body.id).toMatch(/^[0-9a-f]{24}$/);

            board = response.body;
        });

        await test.step('board starts with no lists', async () => {
            const response = await trello.get<TrelloList[]>(`/boards/${board.id}/lists`);
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveLength(0);
        });

        await test.step('create a list on the board', async () => {
            const name = uniqueName('list');
            const response = await trello.post<TrelloList>('/lists', {
                name,
                idBoard: board.id,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
            expect(response.body.idBoard).toBe(board.id);
            expect(response.body.closed).toBe(false);

            list = response.body;
        });

        await test.step('create a card in the list', async () => {
            const name = uniqueName('card');
            const response = await trello.post<TrelloCard>('/cards', {
                name,
                desc: 'Task created by the end-to-end workflow test.',
                idList: list.id,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(name);
            expect(response.body.idList).toBe(list.id);
            expect(response.body.idBoard).toBe(board.id);

            card = response.body;
        });

        await test.step('update the card', async () => {
            const due = new Date(Date.now() + 86_400_000).toISOString();
            const response = await trello.put<TrelloCard>(`/cards/${card.id}`, {
                name: `${card.name}-updated`,
                desc: 'Task updated by the end-to-end workflow test.',
                due,
            });

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(`${card.name}-updated`);
            expect(response.body.desc).toBe('Task updated by the end-to-end workflow test.');
            expect(response.body.due).not.toBeNull();
        });

        await test.step('the update is persisted', async () => {
            const response = await trello.get<TrelloCard>(`/cards/${card.id}`);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe(`${card.name}-updated`);
            expect(response.body.desc).toBe('Task updated by the end-to-end workflow test.');
        });

        await test.step('delete the card', async () => {
            const response = await trello.delete(`/cards/${card.id}`);
            expect(response.status).toBe(200);

            const lookup = await trello.get(`/cards/${card.id}`);
            expect(lookup.status).toBe(404);
        });

        await test.step('archive the list', async () => {
            // Trello exposes no DELETE for lists; archiving is the only removal.
            const response = await trello.put<TrelloList>(`/lists/${list.id}/closed`, {
                value: true,
            });

            expect(response.status).toBe(200);
            expect(response.body.closed).toBe(true);
        });

        await test.step('delete the board', async () => {
            const response = await trello.delete(`/boards/${board.id}`);
            expect(response.status).toBe(200);

            const lookup = await trello.get(`/boards/${board.id}`);
            expect(lookup.status).toBe(404);
        });
    });
});