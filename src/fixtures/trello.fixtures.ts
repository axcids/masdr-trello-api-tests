import { test as base } from '@playwright/test';
import { TrelloClient } from '../clients/trello.client';
import { uniqueName } from '../utils/naming';

import type { TrelloBoard, TrelloList } from '../types/trello.types';
import type { QueryParams, TimedResponse } from '../clients/trello.client';

export interface TrelloFixtures {
    trello: TrelloClient;
    board: TrelloBoard;
    list: TrelloList;
    createBoard: CreateBoard;
}


// Creates a board and registers it for automatic deletion.
export type CreateBoard = (
  overrides?: QueryParams,
) => Promise<TimedResponse<TrelloBoard>>;


export const test = base.extend<TrelloFixtures>({
    trello: async ({ request }, use) => {
        await use(new TrelloClient(request));
    },

    board: async ({ trello }, use) => {
        const created = await trello.post<TrelloBoard>('/boards/', {
            name: uniqueName('board'),
            desc: 'Created by the Masdr automated API suite.',
            defaultLists: false,
        });

        if (created.status !== 200) {
            throw new Error(
                `Fixture setup failed: could not create board ` +
                `(HTTP ${created.status}): ${JSON.stringify(created.body)}`,
            );
        }

        await use(created.body);

        // Teardown: runs on pass, fail, timeout or throw.
        // Deleting the board cascades to its lists and cards.
        await trello.delete(`/boards/${created.body.id}`);
    },

    list: async ({ trello, board }, use) => {
        const created = await trello.post<TrelloList>('/lists', {
            name: uniqueName('list'),
            idBoard: board.id,
        });

        if (created.status !== 200) {
            throw new Error(
                `Fixture setup failed: could not create list ` +
                `(HTTP ${created.status}): ${JSON.stringify(created.body)}`,
            );
        }

        await use(created.body);

        // No teardown: Trello has no DELETE /lists/{id} endpoint. The list is
        // removed when the parent board is deleted by the `board` fixture.
    },
    createBoard: async ({ trello }, use) => {          // ← new fixture starts here
        const createdIds: string[] = [];

        await use(async (overrides = {}) => {
            const response = await trello.post<TrelloBoard>('/boards/', {
                name: uniqueName('board'),
                defaultLists: false,
                ...overrides,
            });

            // Register even partial successes, so nothing can leak.
            if (response.body?.id) createdIds.push(response.body.id);
            return response;
        });

        for (const id of createdIds) {
            await trello.delete(`/boards/${id}`);
        }
    },

});

export { expect } from '@playwright/test';