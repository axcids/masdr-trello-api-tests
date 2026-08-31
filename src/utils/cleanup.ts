import { request } from '@playwright/test';
import { TrelloClient } from '../clients/trello.client';
import type { TrelloBoard } from '../types/trello.types';

type BoardSummary = Pick<TrelloBoard, 'id' | 'name'> & {
    dateLastActivity: string | null;
};

export async function sweepBoards(options: {
    prefix: string;
    olderThanMs?: number;
}): Promise<number> {
    const context = await request.newContext();

    try {
        const trello = new TrelloClient(context);
        const listed = await trello.get<BoardSummary[]>('/members/me/boards', {
            filter: 'open',
            fields: 'id,name,dateLastActivity',
        });

        if (listed.status !== 200 || !Array.isArray(listed.body)) {
            console.warn(`[cleanup] could not list boards (HTTP ${listed.status}); skipping sweep`);
            return 0;
        }

        const cutoff = options.olderThanMs ? Date.now() - options.olderThanMs : null;

        const targets = listed.body.filter((board) => {
            if (!board.name?.startsWith(options.prefix)) return false;
            if (cutoff === null) return true;
            const lastActivity = board.dateLastActivity ? Date.parse(board.dateLastActivity) : 0;
            return lastActivity < cutoff;
        });

        let deleted = 0;
        for (const board of targets) {
            const result = await trello.delete(`/boards/${board.id}`);
            if (result.status === 200) {
                deleted += 1;
            } else {
                console.warn(`[cleanup] failed to delete "${board.name}" (HTTP ${result.status})`);
            }
        }

        if (deleted > 0) {
            console.log(`[cleanup] removed ${deleted} board(s) matching "${options.prefix}"`);
        }
        return deleted;
    } finally {
        await context.dispose();
    }
}