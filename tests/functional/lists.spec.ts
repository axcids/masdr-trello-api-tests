import { test, expect } from '../../src/fixtures/trello.fixtures';
import { uniqueName } from '../../src/utils/naming';
import type { TrelloList } from '../../src/types/trello.types';

test.describe('Lists endpoint', () => {
  test.describe('POST /lists', () => {
    test('creates a list on the given board', async ({ trello, board }) => {
      const name = uniqueName('list');
      const response = await trello.post<TrelloList>('/lists', {
        name,
        idBoard: board.id,
      });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(name);
      expect(response.body.idBoard).toBe(board.id);
      expect(response.body.closed).toBe(false);
      expect(response.body.id).toMatch(/^[0-9a-f]{24}$/);
    });

    test('places a list at the top when pos is top', async ({ trello, board }) => {
      const first = await trello.post<TrelloList>('/lists', {
        name: uniqueName('list'),
        idBoard: board.id,
      });
      const second = await trello.post<TrelloList>('/lists', {
        name: uniqueName('list'),
        idBoard: board.id,
        pos: 'top',
      });

      expect(second.status).toBe(200);
      expect(second.body.pos).toBeLessThan(first.body.pos);
    });

    test('rejects a request with no idBoard', async ({ trello }) => {
      const response = await trello.post('/lists', { name: uniqueName('list') });
      expect(response.status).toBe(400);
    });

    test('rejects a request with no name', async ({ trello, board }) => {
      const response = await trello.post('/lists', { idBoard: board.id });
      expect(response.status).toBe(400);
    });

    test('rejects an unknown idBoard', async ({ trello }) => {
      const response = await trello.post('/lists', {
        name: uniqueName('list'),
        idBoard: '000000000000000000000000',
      });
      expect(response.status).toBe(401);
    });

    test('rejects an unauthenticated request', async ({ trello, board }) => {
      const response = await trello.post('/lists', {
        name: uniqueName('list'),
        idBoard: board.id,
        token: 'invalid-token',
      });
      expect(response.status).toBe(401);
    });
  });

  test.describe('GET /lists/{id}', () => {
    test('returns at least the documented default fields', async ({ trello, list }) => {
      const response = await trello.get<Record<string, unknown>>(`/lists/${list.id}`);

      expect(response.status).toBe(200);

      // FINDING: Trello documents the default field set as name,closed,idBoard,pos.
      // In practice it also returns color, datasource and type. Asserted as a
      // subset so the suite records the documented contract without breaking
      // when Trello adds further undocumented fields.
      expect(Object.keys(response.body)).toEqual(
        expect.arrayContaining(['id', 'name', 'closed', 'idBoard', 'pos']),
      );
    });

    test('returns additional fields when fields=all is requested', async ({ trello, list }) => {
      const response = await trello.get<Record<string, unknown>>(`/lists/${list.id}`, {
        fields: 'all',
      });

      expect(response.status).toBe(200);
      expect(Object.keys(response.body).length).toBeGreaterThan(5);
    });

    test('returns 404 for an unknown list', async ({ trello }) => {
      const response = await trello.get('/lists/000000000000000000000000');
      expect(response.status).toBe(404);
    });
  });

  test.describe('PUT /lists/{id}', () => {
    test('renames a list', async ({ trello, list }) => {
      const newName = `${list.name}-renamed`;
      const response = await trello.put<TrelloList>(`/lists/${list.id}`, { name: newName });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe(newName);

      const readBack = await trello.get<TrelloList>(`/lists/${list.id}`);
      expect(readBack.body.name).toBe(newName);
    });

    test('archives a list via the closed field', async ({ trello, list }) => {
      const response = await trello.put<TrelloList>(`/lists/${list.id}`, { closed: true });

      expect(response.status).toBe(200);
      expect(response.body.closed).toBe(true);
    });
  });

  test.describe('PUT /lists/{id}/closed', () => {
    test('archives and then restores a list', async ({ trello, list }) => {
      const archived = await trello.put<TrelloList>(`/lists/${list.id}/closed`, { value: true });
      expect(archived.status).toBe(200);
      expect(archived.body.closed).toBe(true);

      const restored = await trello.put<TrelloList>(`/lists/${list.id}/closed`, { value: false });
      expect(restored.status).toBe(200);
      expect(restored.body.closed).toBe(false);
    });
  });

  test.describe('DELETE /lists/{id}', () => {
    test('is not supported by the Trello API', async ({ trello, list }) => {
      // FINDING: Trello exposes no deletion for lists - archiving via
      // PUT /lists/{id}/closed is the only removal mechanism. The API answers
      // 400, not the 404 its status-code guide implies for an unregistered
      // route. The follow-up GET settles the semantics: the list is untouched,
      // so this is "unsupported operation", not "resource not found".
      const response = await trello.delete(`/lists/${list.id}`);
      expect(response.status).toBe(400);

      const stillThere = await trello.get<TrelloList>(`/lists/${list.id}`);
      expect(stillThere.status).toBe(200);
      expect(stillThere.body.id).toBe(list.id);
    });
  });

  test.describe('GET /boards/{id}/lists', () => {
    test('excludes archived lists when filtering by open', async ({ trello, board }) => {
      const keep = await trello.post<TrelloList>('/lists', {
        name: uniqueName('list'),
        idBoard: board.id,
      });
      const archive = await trello.post<TrelloList>('/lists', {
        name: uniqueName('list'),
        idBoard: board.id,
      });
      await trello.put(`/lists/${archive.body.id}/closed`, { value: true });

      const response = await trello.get<TrelloList[]>(`/boards/${board.id}/lists`, {
        filter: 'open',
      });

      expect(response.status).toBe(200);
      const ids = response.body.map((l) => l.id);
      expect(ids).toContain(keep.body.id);
      expect(ids).not.toContain(archive.body.id);
    });
  });
});