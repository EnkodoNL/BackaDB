import express from 'express';
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { Notifier, BackupResult, BackupStatus } from './notifier';
import { NotificationConfig } from '../config';
import logger from '../utils/logger';

/**
 * HTTP notifier implementation
 * This class provides an HTTP endpoint for monitoring backup status
 */
export class HttpNotifier implements Notifier {
  private config: NotificationConfig;
  private app: express.Application;
  private server: http.Server | null = null;
  private lastBackupResult: BackupResult | null = null;
  private lastBackupTime: Date | null = null;
  private token: string;

  /**
   * Constructor
   * @param config Notification configuration
   */
  constructor(config: NotificationConfig) {
    this.config = config;
    this.app = express();
    this.token = config.httpToken || uuidv4();
  }

  /**
   * Initialize the notifier
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing HTTP notifier on port ${this.config.httpPort}`);

      // Set up the Express app
      this.app.use(express.json());

      // Set up the health check endpoint
      this.app.get(this.config.httpPath, (req, res) => {
        // Check if the token is provided and valid
        const providedToken = req.query.token as string;

        if (this.token && providedToken !== this.token) {
          logger.warn(`Invalid token provided: ${providedToken}`);
          return res
            .status(401)
            .json({ status: 'error', message: 'Invalid token' });
        }

        // Check if a backup has been performed
        if (!this.lastBackupResult) {
          logger.info('Health check: No backup has been performed yet');
          return res.status(404).json({
            status: 'error',
            message: 'No backup has been performed yet',
          });
        }

        // Check if the last backup was successful
        if (this.lastBackupResult.status === BackupStatus.FAILURE) {
          logger.info('Health check: Last backup failed');
          return res.status(500).json({
            status: 'error',
            message: 'Last backup failed',
            lastBackup: this.lastBackupResult,
          });
        }

        // Check if the last backup is too old
        const now = new Date();
        const backupAge = now.getTime() - (this.lastBackupTime?.getTime() || 0);
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours

        if (backupAge > maxAge) {
          logger.info(
            `Health check: Last backup is too old (${
              backupAge / (60 * 60 * 1000)
            } hours)`,
          );
          return res.status(500).json({
            status: 'error',
            message: 'Last backup is too old',
            lastBackup: this.lastBackupResult,
            backupAge: backupAge / (60 * 60 * 1000),
          });
        }

        // All checks passed
        logger.info('Health check: OK');
        return res.status(200).json({
          status: 'ok',
          message: 'Backup system is healthy',
          lastBackup: this.lastBackupResult,
        });
      });

      // Start the server
      this.server = this.app.listen(this.config.httpPort, () => {
        logger.info(`HTTP notifier listening on port ${this.config.httpPort}`);
        logger.info(
          `Health check endpoint: http://localhost:${this.config.httpPort}${this.config.httpPath}?token=${this.token}`,
        );
      });

      logger.info('HTTP notifier initialized');
    } catch (error) {
      logger.error(`Error initializing HTTP notifier: ${error}`);
      throw error;
    }
  }

  /**
   * Send a notification
   * @param result Backup result
   */
  async notify(result: BackupResult): Promise<void> {
    try {
      logger.info(
        `Updating HTTP notifier with backup result: ${result.status}`,
      );

      // Update the last backup result
      this.lastBackupResult = result;
      this.lastBackupTime = new Date();

      logger.info('HTTP notifier updated');
    } catch (error) {
      logger.error(`Error updating HTTP notifier: ${error}`);
      throw error;
    }
  }

  /**
   * Check the health of the notifier
   * @returns True if the notifier is healthy, false otherwise
   */
  async checkHealth(): Promise<boolean> {
    try {
      logger.info('Checking HTTP notifier health');

      // Check if the server is running
      if (!this.server) {
        logger.warn('HTTP notifier server is not running');
        return false;
      }

      logger.info('HTTP notifier is healthy');
      return true;
    } catch (error) {
      logger.error(`Error checking HTTP notifier health: ${error}`);
      return false;
    }
  }
}
