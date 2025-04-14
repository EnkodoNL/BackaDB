import { NotificationConfig } from '../config';
import { Notifier, NotifierFactory } from './notifier';
import { HttpNotifier } from './http';
import logger from '../utils/logger';

/**
 * Notifier factory implementation
 * This class creates notifiers based on the notification configuration
 */
export class DefaultNotifierFactory implements NotifierFactory {
  /**
   * Create a notifier
   * @param config Notification configuration
   * @returns Notifier instance
   */
  createNotifier(config: NotificationConfig): Notifier {
    logger.info('Creating notifier');

    if (config.http) {
      logger.info('Creating HTTP notifier');
      return new HttpNotifier(config);
    }

    // Default to HTTP notifier
    logger.info('No notifier configured, using HTTP notifier by default');
    return new HttpNotifier({
      http: true,
      httpPort: 8080,
      httpPath: '/health',
      httpToken: '',
    });
  }
}

// Export a singleton instance of the factory
export const notifierFactory = new DefaultNotifierFactory();
