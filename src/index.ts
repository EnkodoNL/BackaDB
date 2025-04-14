import { databaseConnectorFactory } from './db/connector-factory';
import { storageProviderFactory } from './storage/provider-factory';
import { notifierFactory } from './notification/notifier-factory';
import { BackupEngine } from './core/backup-engine';
import { Scheduler } from './core/scheduler';
import { RetentionManager } from './core/retention-manager';
import config from './config';
import logger from './utils/logger';

/**
 * Main application
 */
async function main() {
  try {
    logger.info('Starting BackaDB application');

    // Create components
    const dbConnector = databaseConnectorFactory.createConnector(
      config.database,
    );

    const storageProvider = storageProviderFactory.createProvider(
      config.storage,
      {
        s3: config.s3,
        googleDrive: config.googleDrive,
        nextCloud: config.nextCloud,
      },
    );

    const notifier = notifierFactory.createNotifier(config.notification);

    const retentionManager = new RetentionManager(
      storageProvider,
      config.retention,
    );

    const backupEngine = new BackupEngine(
      config,
      dbConnector,
      storageProvider,
      notifier,
      retentionManager,
    );

    const scheduler = new Scheduler(backupEngine, config.backup);

    // Initialize the backup engine
    await backupEngine.initialize();

    // Check if we should run a backup immediately
    const args = process.argv.slice(2);
    if (args.includes('--run-backup')) {
      logger.info('Running backup immediately');
      await backupEngine.runBackup();
    }

    // Start the scheduler
    await scheduler.start();

    // Handle process termination
    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down');
      await scheduler.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down');
      await scheduler.stop();
      process.exit(0);
    });

    logger.info('BackaDB application started');
  } catch (error) {
    logger.error(`Error starting application: ${error}`);
    process.exit(1);
  }
}

// Run the application
main();
