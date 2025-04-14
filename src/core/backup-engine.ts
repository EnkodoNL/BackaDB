import path from 'path';
import fs from 'fs';
import os from 'os';
import { promisify } from 'util';
import { DatabaseConnector } from '../db/connector';
import { StorageProvider } from '../storage/provider';
import { Notifier, BackupResult, BackupStatus } from '../notification/notifier';
import { RetentionManager } from './retention-manager';
import { AppConfig } from '../config';
import { compressFile } from '../utils/compression';
import logger from '../utils/logger';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

/**
 * Backup engine
 * This class is responsible for orchestrating the backup process
 */
export class BackupEngine {
  private config: AppConfig;
  private dbConnector: DatabaseConnector;
  private storageProvider: StorageProvider;
  private notifier: Notifier;
  private retentionManager: RetentionManager;

  /**
   * Constructor
   * @param config Application configuration
   * @param dbConnector Database connector
   * @param storageProvider Storage provider
   * @param notifier Notifier
   * @param retentionManager Retention manager
   */
  constructor(
    config: AppConfig,
    dbConnector: DatabaseConnector,
    storageProvider: StorageProvider,
    notifier: Notifier,
    retentionManager: RetentionManager,
  ) {
    this.config = config;
    this.dbConnector = dbConnector;
    this.storageProvider = storageProvider;
    this.notifier = notifier;
    this.retentionManager = retentionManager;
  }

  /**
   * Initialize the backup engine
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing backup engine');

      // Initialize components
      await this.dbConnector.connect();
      await this.storageProvider.initialize();
      await this.notifier.initialize();

      logger.info('Backup engine initialized');
    } catch (error) {
      logger.error(`Error initializing backup engine: ${error}`);
      throw error;
    }
  }

  /**
   * Run backup for all databases
   */
  async runBackup(): Promise<void> {
    try {
      logger.info('Running backup for all databases');

      // Get databases to backup
      const databases = await this.getDatabases();

      logger.info(`Found ${databases.length} databases to backup`);

      // Backup each database
      for (const database of databases) {
        try {
          await this.backupDatabase(database);
        } catch (error) {
          logger.error(`Error backing up database ${database}: ${error}`);
        }
      }

      logger.info('Backup completed for all databases');
    } catch (error) {
      logger.error(`Error running backup: ${error}`);
      throw error;
    }
  }

  /**
   * Get databases to backup
   * @returns Array of database names
   */
  private async getDatabases(): Promise<string[]> {
    try {
      logger.info('Getting databases to backup');

      // If specific databases are configured, use them
      if (this.config.database.databases[0] !== 'all') {
        return this.config.database.databases;
      }

      // Otherwise, get all databases
      const allDatabases = await this.dbConnector.listDatabases();

      logger.info(`Found ${allDatabases.length} databases`);

      return allDatabases;
    } catch (error) {
      logger.error(`Error getting databases: ${error}`);
      throw error;
    }
  }

  /**
   * Backup a database
   * @param database Database name
   */
  private async backupDatabase(database: string): Promise<void> {
    const startTime = Date.now();
    let backupResult: BackupResult = {
      database,
      timestamp: new Date(),
      status: BackupStatus.FAILURE,
      message: '',
      duration: 0,
    };

    let tempDir: string | null = null;
    let backupFile: string | null = null;
    let finalFile: string | null = null;

    try {
      logger.defaultMeta = { database };
      logger.info(`Backing up database: ${database}`);

      // Create a temporary directory
      tempDir = await this.createTempDir();

      // Generate backup file name
      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '');
      const backupFileName = `${database}_${timestamp}.sql`;
      backupFile = path.join(tempDir, backupFileName);

      // Backup the database
      await this.dbConnector.backupDatabase(database, backupFile);

      // Get file size
      const stats = fs.statSync(backupFile);
      const fileSize = stats.size;

      // Process the backup file
      let currentFile = backupFile;

      // Create a zip file, optionally password-protected
      const zipFile = `${backupFile}.zip`;

      // Use the password if encryption is enabled
      const password = this.config.backup.encrypt
        ? this.config.backup.encryptPassword
        : undefined;

      // Compress the file
      await compressFile(backupFile, zipFile, password);
      currentFile = zipFile;

      // Store the file
      const remotePath = path.join(database, path.basename(currentFile));

      finalFile = await this.storageProvider.storeFile(currentFile, remotePath);

      // Apply retention policy only if explicitly enabled
      if (this.config.retention.enabled) {
        logger.info(`Applying retention policy for database: ${database}`);
        await this.retentionManager.applyRetentionPolicy(database, database);
      } else {
        logger.info(
          `Retention policy not enabled, skipping for database: ${database}`,
        );
      }

      // Update backup result
      backupResult = {
        database,
        timestamp: new Date(),
        status: BackupStatus.SUCCESS,
        message: `Backup completed successfully: ${finalFile}`,
        filePath: finalFile,
        fileSize,
        duration: Date.now() - startTime,
      };

      logger.info(`Backup completed for database: ${database}`);
    } catch (error) {
      logger.error(`Error backing up database ${database}: ${error}`);

      // Update backup result
      backupResult = {
        database,
        timestamp: new Date(),
        status: BackupStatus.FAILURE,
        message: `Backup failed: ${error}`,
        duration: Date.now() - startTime,
      };
    } finally {
      // Clean up temporary files
      try {
        // Delete the original SQL backup file
        if (backupFile && fs.existsSync(backupFile)) {
          await unlink(backupFile);
        }

        // Delete the zip file if it exists
        const zipFile = `${backupFile}.zip`;
        if (zipFile && fs.existsSync(zipFile)) {
          await unlink(zipFile);
        }

        // Delete the temporary directory
        if (tempDir && fs.existsSync(tempDir)) {
          fs.rmdirSync(tempDir);
        }
      } catch (error) {
        logger.warn(`Error cleaning up temporary files: ${error}`);
      }

      // Send notification
      try {
        await this.notifier.notify(backupResult);
      } catch (error) {
        logger.error(`Error sending notification: ${error}`);
      }
    }
  }

  /**
   * Create a temporary directory
   * @returns Path to the temporary directory
   */
  private async createTempDir(): Promise<string> {
    try {
      const tempDir = path.join(os.tmpdir(), `backadb-${Date.now()}`);
      await mkdir(tempDir, { recursive: true });
      return tempDir;
    } catch (error) {
      logger.error(`Error creating temporary directory: ${error}`);
      throw error;
    }
  }
}
