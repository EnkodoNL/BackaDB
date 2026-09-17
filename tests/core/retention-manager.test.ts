import { RetentionManager } from '../../src/core/retention-manager';
import { RetentionConfig, RetentionStrategy } from '../../src/config';
import { StorageProvider } from '../../src/storage/provider';

jest.mock('../../src/utils/logger');

const DAY = 24 * 60 * 60 * 1000;

// Thursday; one backup per day at 01:00 UTC for the last 120 days
const now = new Date('2026-09-17T12:00:00Z');

function backupName(database: string, date: Date): string {
  const timestamp = date.toISOString().replace(/:/g, '-').replace(/\..+/, '');
  return `${database}/${database}_${timestamp}.sql.zip`;
}

function dailyBackups(database: string, days: number): string[] {
  const first = new Date('2026-09-17T01:00:00Z').getTime();
  return Array.from({ length: days }, (_, i) =>
    backupName(database, new Date(first - i * DAY)),
  );
}

function createStorage(files: string[]) {
  const deleted: string[] = [];
  const storage = {
    listFiles: jest.fn(async () => files),
    deleteFile: jest.fn(async (file: string) => {
      deleted.push(file);
    }),
  } as unknown as StorageProvider;
  return { storage, deleted };
}

function createConfig(
  strategy: RetentionStrategy,
  overrides: Partial<RetentionConfig> = {},
): RetentionConfig {
  return {
    enabled: true,
    strategy,
    count: 7,
    days: 30,
    daily: 7,
    weekly: 4,
    monthly: 3,
    ...overrides,
  };
}

async function run(config: RetentionConfig, files: string[], database = 'app') {
  const { storage, deleted } = createStorage(files);
  await new RetentionManager(storage, config).applyRetentionPolicy(
    database,
    database,
    now,
  );
  return files.filter((file) => !deleted.includes(file));
}

describe('RetentionManager', () => {
  const files = dailyBackups('app', 120);

  it('count: keeps the newest N backups', async () => {
    const kept = await run(createConfig('count'), files);

    expect(kept).toEqual(files.slice(0, 7));
  });

  it('time: keeps backups from the last 30 days', async () => {
    const kept = await run(createConfig('time'), files);

    expect(kept).toHaveLength(30);
    expect(kept).toContain('app/app_2026-08-19T01-00-00.sql.zip');
    expect(kept).not.toContain('app/app_2026-08-18T01-00-00.sql.zip');
  });

  it('first: applies the count limit when it is reached first', async () => {
    const kept = await run(
      createConfig('first', { count: 7, days: 30 }),
      files,
    );

    expect(kept).toEqual(files.slice(0, 7));
  });

  it('first: applies the time limit when it is reached first', async () => {
    const kept = await run(createConfig('first', { count: 7, days: 3 }), files);

    // 01:00 on Sep 17, 16 and 15; Sep 14 01:00 is older than 3 days at 12:00
    expect(kept).toEqual(files.slice(0, 3));
  });

  it('gfs: keeps 7 daily, 4 weekly and 3 monthly backups', async () => {
    const kept = await run(createConfig('gfs'), files);

    expect(kept).toHaveLength(14);
    expect(kept).toContain('app/app_2026-07-01T01-00-00.sql.zip');
    expect(kept).toContain('app/app_2026-08-23T01-00-00.sql.zip');
    expect(kept).not.toContain('app/app_2026-06-01T01-00-00.sql.zip');
  });

  it('never deletes files with an unrecognized name or from another database', async () => {
    const foreign = [
      'app/app_manual-export.sql',
      'app/notes.txt',
      'app/app_logs_2020-01-02T01-00-00.sql.zip',
    ];
    const kept = await run(createConfig('first'), [...files, ...foreign]);

    expect(kept).toEqual(expect.arrayContaining(foreign));
  });

  it('handles database names containing underscores', async () => {
    const kept = await run(
      createConfig('time'),
      dailyBackups('my_app', 40),
      'my_app',
    );

    expect(kept).toHaveLength(30);
  });
});
