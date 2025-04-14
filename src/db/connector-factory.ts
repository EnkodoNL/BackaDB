import { DatabaseConfig } from '../config';
import { DatabaseConnector, DatabaseConnectorFactory } from './connector';
import { MariaDBConnector } from './implementations/mariadb';
import logger from '../utils/logger';

/**
 * Database connector factory implementation
 * This class creates database connectors based on the database type
 */
export class DefaultDatabaseConnectorFactory
  implements DatabaseConnectorFactory
{
  /**
   * Create a database connector
   * @param config Database configuration
   * @returns Database connector instance
   */
  createConnector(config: DatabaseConfig): DatabaseConnector {
    logger.info(`Creating database connector for type: ${config.type}`);

    switch (config.type.toLowerCase()) {
      case 'mariadb':
      case 'mysql':
        return new MariaDBConnector(config);
      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}

// Export a singleton instance of the factory
export const databaseConnectorFactory = new DefaultDatabaseConnectorFactory();
