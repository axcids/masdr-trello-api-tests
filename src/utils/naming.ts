import { randomUUID } from 'node:crypto';
import { config } from '../config/env';



export function uniqueName(kind: string): string {
  return `${config.resourcePrefix}-${kind}-${randomUUID().slice(0, 8)}`;
}