import { DatabaseConfig } from '../config';

/**
 * Database connector interface
 * This interface defines the methods that all database connectors must implement
 */
export interface DatabaseConnector {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * List all databases
   * @returns Array of database names
   */
  listDatabases(): Promise<string[]>;

  /**
   * Backup a database
   * @param database Database name
   * @param outputPath Path to save the backup
   * @returns Path to the backup file
   */
  backupDatabase(database: string, outputPath: string): Promise<string>;

  /**
   * Restore a database from a backup
   * @param database Database name
   * @param inputPath Path to the backup file
   */
  restoreDatabase(database: string, inputPath: string): Promise<void>;

  /**
   * Check if a database exists
   * @param database Database name
   * @returns True if the database exists, false otherwise
   */
  databaseExists(database: string): Promise<boolean>;
}

/**
 * Database connector factory interface
 * This interface defines the methods that all database connector factories must implement
 */
export interface DatabaseConnectorFactory {
  /**
   * Create a database connector
   * @param config Database configuration
   * @returns Database connector instance
   */
  createConnector(config: DatabaseConfig): DatabaseConnector;
}
