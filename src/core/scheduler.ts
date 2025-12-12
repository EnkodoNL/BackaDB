import { CronJob } from 'cron';
import { BackupEngine } from './backup-engine';
import { BackupConfig } from '../config';
import logger from '../utils/logger';

/**
 * Scheduler
 * This class is responsible for scheduling backups
 */
export class Scheduler {
  private backupEngine: BackupEngine;
  private config: BackupConfig;
  private cronJob: CronJob | null = null;

  /**
   * Constructor
   * @param backupEngine Backup engine
   * @param config Backup configuration
   */
  constructor(backupEngine: BackupEngine, config: BackupConfig) {
    this.backupEngine = backupEngine;
    this.config = config;
  }

  /**
   * Start the scheduler
   */
  async start(): Promise<void> {
    try {
      logger.info(
        `Starting scheduler with cron schedule: ${this.config.schedule}`,
      );

      // Create a cron job
      this.cronJob = new CronJob(
        this.config.schedule,
        async () => {
          try {
            logger.info('Running scheduled backup');
            await this.backupEngine.runBackup();
            logger.info('Scheduled backup completed');
          } catch (error) {
            logger.error(`Error running scheduled backup: ${error}`);
          }
        },
        null, // onComplete
        true, // start
        process?.env?.TZ || 'UTC', // timezone
      );

      logger.info('Scheduler started');

      // Run backup on startup if configured
      if (this.config.onStartup) {
        logger.info('Running backup on startup');
        await this.backupEngine.runBackup();
        logger.info('Startup backup completed');
      }
    } catch (error) {
      logger.error(`Error starting scheduler: ${error}`);
      throw error;
    }
  }

  /**
   * Stop the scheduler
   */
  async stop(): Promise<void> {
    try {
      logger.info('Stopping scheduler');

      if (this.cronJob) {
        this.cronJob.stop();
        this.cronJob = null;
      }

      logger.info('Scheduler stopped');
    } catch (error) {
      logger.error(`Error stopping scheduler: ${error}`);
      throw error;
    }
  }
}
