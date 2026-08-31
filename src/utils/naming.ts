import { randomUUID } from 'node:crypto';
import { config } from '../config/env';

export const RUN_ID = process.env.TEST_RUN_ID ?? 'local';

export function runPrefix(): string {
  return `${config.resourcePrefix}-${RUN_ID}`;
}

export function uniqueName(kind: string): string {
  return `${runPrefix()}-${kind}-${randomUUID().slice(0, 8)}`;
}