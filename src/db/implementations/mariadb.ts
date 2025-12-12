import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';
import { DatabaseConnector } from '../connector';
import { DatabaseConfig } from '../../config';
import logger from '../../utils/logger';
import mysql from 'mysql2/promise';

// Promisify exec
const execAsync = promisify(exec);

/**
 * MariaDB connector implementation
 */
export class MariaDBConnector implements DatabaseConnector {
  private config: DatabaseConfig;
  private connection: mysql.Connection | null = null;

  /**
   * Constructor
   * @param config Database configuration
   */
  constructor(config: DatabaseConfig) {
    this.config = config;
  }

  /**
   * Connect to the database
   */
  async connect(): Promise<void> {
    try {
      logger.info(
        `Connecting to MariaDB at ${this.config.host}:${this.config.port}`,
      );

      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
      });

      logger.info('Connected to MariaDB');
    } catch (error) {
      logger.error(`Error connecting to MariaDB: ${error}`);
      throw error;
    }
  }

  /**
   * Disconnect from the database
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      try {
        logger.info('Disconnecting from MariaDB');
        await this.connection.end();
        this.connection = null;
        logger.info('Disconnected from MariaDB');
      } catch (error) {
        logger.error(`Error disconnecting from MariaDB: ${error}`);
        throw error;
      }
    }
  }

  /**
   * List all databases
   * @returns Array of database names
   */
  async listDatabases(): Promise<string[]> {
    try {
      logger.info('Listing databases');

      if (!this.connection) {
        await this.connect();
      }

      const [rows] = this.connection
        ? await this.connection.query('SHOW DATABASES')
        : [[], []];

      type SHOW_DB_ROWS = { Database: string };

      // Filter out system databases
      const databases = (rows as SHOW_DB_ROWS[])
        .map((row) => row.Database)
        .filter(
          (name) =>
            ![
              'information_schema',
              'mysql',
              'performance_schema',
              'sys',
            ].includes(name),
        );

      logger.info(`Found ${databases.length} databases`);

      return databases;
    } catch (error) {
      logger.error(`Error listing databases: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a database exists
   * @param database Database name
   * @returns True if the database exists, false otherwise
   */
  async databaseExists(database: string): Promise<boolean> {
    try {
      logger.info(`Checking if database exists: ${database}`);

      if (!this.connection) {
        await this.connect();
      }

      const [rows] = this.connection
        ? await this.connection.query('SHOW DATABASES LIKE ?', [database])
        : [[], []];

      return (rows as any[]).length > 0;
    } catch (error) {
      logger.error(`Error checking if database exists: ${error}`);
      throw error;
    }
  }

  /**
   * Backup a database
   * @param database Database name
   * @param outputPath Path to save the backup
   * @returns Path to the backup file
   */
  async backupDatabase(database: string, outputPath: string): Promise<string> {
    try {
      logger.info(`Backing up database: ${database} to ${outputPath}`);

      // Ensure the database exists
      const exists = await this.databaseExists(database);

      if (!exists) {
        throw new Error(`Database does not exist: ${database}`);
      }

      // Use the backup script to perform the backup
      const scriptPath = join(process.cwd(), 'scripts', 'backup.sh');

      const command = `${scriptPath} mariadb ${this.config.host} ${this.config.port} ${this.config.user} ${this.config.password} ${database} ${outputPath} "${this.config.params}"`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        logger.warn(`Backup stderr: ${stderr}`);
      }

      logger.info(`Backup stdout: ${stdout}`);
      logger.info(`Database backup completed: ${outputPath}`);

      return outputPath;
    } catch (error) {
      logger.error(`Error backing up database: ${error}`);
      throw error;
    }
  }

  /**
   * Restore a database from a backup
   * @param database Database name
   * @param inputPath Path to the backup file
   */
  async restoreDatabase(database: string, inputPath: string): Promise<void> {
    try {
      logger.info(`Restoring database: ${database} from ${inputPath}`);

      // Create the database if it doesn't exist
      if (!this.connection) {
        await this.connect();
      }

      const exists = await this.databaseExists(database);

      if (!exists) {
        logger.info(`Creating database: ${database}`);
        if (this.connection) {
          await this.connection.query(
            `CREATE DATABASE IF NOT EXISTS \`${database}\``,
          );
        }
      }

      // Use the mysql command to restore the database
      const command = `mysql --host=${this.config.host} --port=${this.config.port} --user=${this.config.user} --password=${this.config.password} ${database} < ${inputPath}`;

      const { stdout, stderr } = await execAsync(command);

      if (stderr) {
        logger.warn(`Restore stderr: ${stderr}`);
      }

      logger.info(`Restore stdout: ${stdout}`);
      logger.info(`Database restore completed: ${database}`);
    } catch (error) {
      logger.error(`Error restoring database: ${error}`);
      throw error;
    }
  }
}
