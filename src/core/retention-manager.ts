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
  database: string;
  type: 'daily' | 'weekly' | 'monthly' | 'unknown';
}

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
   */
  async applyRetentionPolicy(
    database: string,
    backupDir: string,
  ): Promise<void> {
    try {
      logger.info(`Applying retention policy for database: ${database}`);

      // List all backup files
      const files = await this.storageProvider.listFiles(backupDir);

      // Parse backup files
      const backupFiles = this.parseBackupFiles(files, database);

      // Sort backup files by timestamp (newest first)
      backupFiles.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply retention policy based on strategy
      if (this.config.strategy === 'count') {
        await this.applyCountBasedRetention(backupFiles);
      } else {
        await this.applyTimeBasedRetention(backupFiles);
      }

      logger.info(`Retention policy applied for database: ${database}`);
    } catch (error) {
      logger.error(`Error applying retention policy: ${error}`);
      throw error;
    }
  }

  /**
   * Parse backup files
   * @param files Array of file paths
   * @param database Database name
   * @returns Array of backup file information
   */
  private parseBackupFiles(files: string[], database: string): BackupFile[] {
    // Filter files for the specified database
    const databaseFiles = files.filter((file) => {
      // Check if the file is in a directory with the database name
      // or if the file name starts with the database name
      const dirName = path.dirname(file);
      const fileName = path.basename(file);
      const dbDirName = path.basename(dirName);

      return (
        (dbDirName === database && fileName.startsWith(`${database}_`)) ||
        fileName.startsWith(`${database}_`)
      );
    });

    // Parse file information
    return databaseFiles.map((file) => {
      const fileName = path.basename(file);
      const parts = fileName.split('_');

      // Expected format: database_YYYY-MM-DD_HH-MM-SS.sql[.gz][.enc]
      if (parts.length >= 3) {
        const dateStr = parts[1];
        const timeStr = parts[2].split('.')[0]; // Remove extension

        const timestamp = new Date(`${dateStr}T${timeStr.replace(/-/g, ':')}`);

        // Determine backup type
        let type: 'daily' | 'weekly' | 'monthly' | 'unknown' = 'unknown';

        // Check if it's a monthly backup (1st day of the month)
        if (timestamp.getDate() === 1) {
          type = 'monthly';
        }
        // Check if it's a weekly backup (Sunday)
        else if (timestamp.getDay() === 0) {
          type = 'weekly';
        }
        // Otherwise it's a daily backup
        else {
          type = 'daily';
        }

        return {
          path: file,
          timestamp,
          database,
          type,
        };
      }

      // If the file name doesn't match the expected format, return with unknown type
      return {
        path: file,
        timestamp: new Date(0), // Epoch time
        database,
        type: 'unknown',
      };
    });
  }

  /**
   * Apply count-based retention policy
   * @param backupFiles Array of backup file information
   */
  private async applyCountBasedRetention(
    backupFiles: BackupFile[],
  ): Promise<void> {
    try {
      logger.info('Applying count-based retention policy');

      // Group backup files by type
      const daily = backupFiles.filter((file) => file.type === 'daily');
      const weekly = backupFiles.filter((file) => file.type === 'weekly');
      const monthly = backupFiles.filter((file) => file.type === 'monthly');

      // Keep the specified number of backups for each type
      const filesToKeep = new Set<string>();

      // Keep daily backups
      daily.slice(0, this.config.daily).forEach((file) => {
        filesToKeep.add(file.path);
      });

      // Keep weekly backups
      weekly.slice(0, this.config.weekly).forEach((file) => {
        filesToKeep.add(file.path);
      });

      // Keep monthly backups
      monthly.slice(0, this.config.monthly).forEach((file) => {
        filesToKeep.add(file.path);
      });

      // Delete files that are not in the keep set
      for (const file of backupFiles) {
        if (!filesToKeep.has(file.path)) {
          logger.info(`Deleting backup file: ${file.path}`);
          await this.storageProvider.deleteFile(file.path);
        }
      }

      logger.info('Count-based retention policy applied');
    } catch (error) {
      logger.error(`Error applying count-based retention policy: ${error}`);
      throw error;
    }
  }

  /**
   * Apply time-based retention policy
   * @param backupFiles Array of backup file information
   */
  private async applyTimeBasedRetention(
    backupFiles: BackupFile[],
  ): Promise<void> {
    try {
      logger.info('Applying time-based retention policy');

      const now = new Date();
      const cutoffDate = new Date(
        now.getTime() - this.config.days * 24 * 60 * 60 * 1000,
      );

      // Delete files older than the cutoff date
      for (const file of backupFiles) {
        if (file.timestamp < cutoffDate) {
          logger.info(`Deleting backup file: ${file.path}`);
          await this.storageProvider.deleteFile(file.path);
        }
      }

      logger.info('Time-based retention policy applied');
    } catch (error) {
      logger.error(`Error applying time-based retention policy: ${error}`);
      throw error;
    }
  }
}
