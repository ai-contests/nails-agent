import { expect, test } from 'bun:test';
import { runInSqliteTransaction } from './tools.ts';

test('commits a sqlite transaction after successful work', async () => {
  const statements: string[] = [];
  const sqlite = {
    exec(statement: string) {
      statements.push(statement);
    },
  };

  const result = await runInSqliteTransaction(sqlite, async () => {
    statements.push('WORK');
    return 'done';
  });

  expect(result).toBe('done');
  expect(statements).toEqual(['BEGIN IMMEDIATE', 'WORK', 'COMMIT']);
});

test('rolls back a sqlite transaction when work fails', async () => {
  const statements: string[] = [];
  const sqlite = {
    exec(statement: string) {
      statements.push(statement);
    },
  };

  await expect(runInSqliteTransaction(sqlite, async () => {
    statements.push('WORK');
    throw new Error('boom');
  })).rejects.toThrow('boom');

  expect(statements).toEqual(['BEGIN IMMEDIATE', 'WORK', 'ROLLBACK']);
});
