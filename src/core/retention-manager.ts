import path from 'path';
import { StorageProvider } from '../storage/provider';
import { RetentionConfig } from '../config';
import logger from '../utils/logger';

/**
 * Backup file information
 */
interface BackupFile {
  path: string;
  timestamp: Date;
  type: 'daily' | 'weekly' | 'monthly';
}

// Matches the part after `${database}_` as written by the backup engine:
// YYYY-MM-DDTHH-MM-SS.sql[.zip] (UTC, from Date.toISOString)
const BACKUP_TIMESTAMP_PATTERN =
  /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})\.sql(\.[a-z0-9]+)*$/i;

/**
 * Retention manager
 * This class is responsible for managing backup retention policies
 */
export class RetentionManager {
  private storageProvider: StorageProvider;
  private config: RetentionConfig;

  /**
   * Constructor
   * @param storageProvider Storage provider
   * @param config Retention configuration
   */
  constructor(storageProvider: StorageProvider, config: RetentionConfig) {
    this.storageProvider = storageProvider;
    this.config = config;
  }

  /**
   * Apply retention policy
   * @param database Database name
   * @param backupDir Directory containing backups
   * @param now Reference time for age calculations
   */
  async applyRetentionPolicy(
    database: string,
    backupDir: string,
    now: Date = new Date(),
  ): Promise<void> {
    try {
      logger.info(
        `Applying ${this.config.strategy} retention policy for database: ${database}`,
      );

      const files = await this.storageProvider.listFiles(backupDir);
      const backupFiles = this.parseBackupFiles(files, database);

      // Newest first
      backupFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      let selected: string[];
      switch (this.config.strategy) {
        case 'count':
          selected = this.selectByCount(backupFiles);
          break;
        case 'time':
          selected = this.selectByTime(backupFiles, now);
          break;
        case 'first':
          selected = [
            ...this.selectByCount(backupFiles),
            ...this.selectByTime(backupFiles, now),
          ];
          break;
        case 'gfs':
          selected = this.selectByGfs(backupFiles);
          break;
      }
      const expired = new Set(selected);

      for (const file of backupFiles) {
        if (expired.has(file.path)) {
          logger.info(`Deleting backup file: ${file.path}`);
          await this.storageProvider.deleteFile(file.path);
        }
      }

      logger.info(
        `Retention policy applied for database: ${database} (${expired.size} of ${backupFiles.length} deleted)`,
      );
    } catch (error) {
      logger.error(`Error applying retention policy: ${error}`);
      throw error;
    }
  }

  /**
   * Parse backup files for a database
   * Files that do not match the expected name format are skipped and never deleted.
   * @param files Array of file paths
   * @param database Database name
   * @returns Array of backup file information
   */
  private parseBackupFiles(files: string[], database: string): BackupFile[] {
    const prefix = `${database}_`;
    const backupFiles: BackupFile[] = [];

    for (const file of files) {
      const fileName = path.basename(file);
      if (!fileName.startsWith(prefix)) {
        continue;
      }

      const match = BACKUP_TIMESTAMP_PATTERN.exec(
        fileName.slice(prefix.length),
      );
      const timestamp = match
        ? new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`)
        : null;

      if (!timestamp || Number.isNaN(timestamp.getTime())) {
        logger.warn(`Skipping file with unrecognized name: ${file}`);
        continue;
      }

      let type: BackupFile['type'];
      if (timestamp.getUTCDate() === 1) {
        type = 'monthly';
      } else if (timestamp.getUTCDay() === 0) {
        type = 'weekly';
      } else {
        type = 'daily';
      }

      backupFiles.push({ path: file, timestamp, type });
    }

    return backupFiles;
  }

  /**
   * Select all files except the newest N
   * @param backupFiles Backup files sorted newest first
   * @returns Paths of files to delete
   */
  private selectByCount(backupFiles: BackupFile[]): string[] {
    return backupFiles.slice(this.config.count).map((file) => file.path);
  }

  /**
   * Select files that exceed the daily, weekly and monthly counts
   * @param backupFiles Backup files sorted newest first
   * @returns Paths of files to delete
   */
  private selectByGfs(backupFiles: BackupFile[]): string[] {
    const limits: Record<BackupFile['type'], number> = {
      daily: this.config.daily,
      weekly: this.config.weekly,
      monthly: this.config.monthly,
    };

    return (Object.keys(limits) as BackupFile['type'][]).flatMap((type) =>
      backupFiles
        .filter((file) => file.type === type)
        .slice(limits[type])
        .map((file) => file.path),
    );
  }

  /**
   * Select files older than the configured number of days
   * @param backupFiles Backup files
   * @param now Reference time
   * @returns Paths of files to delete
   */
  private selectByTime(backupFiles: BackupFile[], now: Date): string[] {
    const cutoffDate = new Date(
      now.getTime() - this.config.days * 24 * 60 * 60 * 1000,
    );

    return backupFiles
      .filter((file) => file.timestamp < cutoffDate)
      .map((file) => file.path);
  }
}
