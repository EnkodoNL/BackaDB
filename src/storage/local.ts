import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { StorageProvider } from './provider';
import { StorageConfig } from '../config';
import logger from '../utils/logger';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const access = promisify(fs.access);

/**
 * Local storage provider implementation
 */
export class LocalStorageProvider implements StorageProvider {
  private config: StorageConfig;

  /**
   * Constructor
   * @param config Storage configuration
   */
  constructor(config: StorageConfig) {
    this.config = config;
  }

  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing local storage at ${this.config.path}`);

      // Create the storage directory if it doesn't exist
      await mkdir(this.config.path, { recursive: true });

      logger.info('Local storage initialized');
    } catch (error) {
      logger.error(`Error initializing local storage: ${error}`);
      throw error;
    }
  }

  /**
   * Store a file
   * @param localPath Path to the local file
   * @param remotePath Path to store the file in the remote storage
   * @returns Remote path of the stored file
   */
  async storeFile(localPath: string, remotePath: string): Promise<string> {
    try {
      logger.info(`Storing file: ${localPath} -> ${remotePath}`);

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(path.join(this.config.path, remotePath));
      await mkdir(destDir, { recursive: true });

      // Copy the file
      const destPath = path.join(this.config.path, remotePath);
      await copyFile(localPath, destPath);

      logger.info(`File stored successfully: ${destPath}`);

      return remotePath;
    } catch (error) {
      logger.error(`Error storing file: ${error}`);
      throw error;
    }
  }

  /**
   * Store data from a stream
   * @param stream Readable stream containing the data
   * @param remotePath Path to store the file in the remote storage
   * @returns Remote path of the stored file
   */
  async storeStream(stream: Readable, remotePath: string): Promise<string> {
    try {
      logger.info(`Storing stream to: ${remotePath}`);

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(path.join(this.config.path, remotePath));
      await mkdir(destDir, { recursive: true });

      // Create a write stream
      const destPath = path.join(this.config.path, remotePath);
      const writeStream = fs.createWriteStream(destPath);

      // Pipe the stream to the file
      return new Promise<string>((resolve, reject) => {
        stream
          .pipe(writeStream)
          .on('finish', () => {
            logger.info(`Stream stored successfully: ${destPath}`);
            resolve(remotePath);
          })
          .on('error', (error) => {
            logger.error(`Error storing stream: ${error}`);
            reject(error);
          });
      });
    } catch (error) {
      logger.error(`Error storing stream: ${error}`);
      throw error;
    }
  }

  /**
   * Retrieve a file
   * @param remotePath Path to the file in the remote storage
   * @param localPath Path to save the file locally
   * @returns Local path of the retrieved file
   */
  async retrieveFile(remotePath: string, localPath: string): Promise<string> {
    try {
      logger.info(`Retrieving file: ${remotePath} -> ${localPath}`);

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(localPath);
      await mkdir(destDir, { recursive: true });

      // Copy the file
      const sourcePath = path.join(this.config.path, remotePath);
      await copyFile(sourcePath, localPath);

      logger.info(`File retrieved successfully: ${localPath}`);

      return localPath;
    } catch (error) {
      logger.error(`Error retrieving file: ${error}`);
      throw error;
    }
  }

  /**
   * Get a readable stream for a file
   * @param remotePath Path to the file in the remote storage
   * @returns Readable stream for the file
   */
  async getFileStream(remotePath: string): Promise<Readable> {
    try {
      logger.info(`Getting file stream for: ${remotePath}`);

      const filePath = path.join(this.config.path, remotePath);
      const stream = fs.createReadStream(filePath);

      return stream;
    } catch (error) {
      logger.error(`Error getting file stream: ${error}`);
      throw error;
    }
  }

  /**
   * List files in a directory
   * @param remotePath Path to the directory in the remote storage
   * @returns Array of file paths
   */
  async listFiles(remotePath: string): Promise<string[]> {
    try {
      logger.info(`Listing files in: ${remotePath}`);

      const dirPath = path.join(this.config.path, remotePath);

      // Create the directory if it doesn't exist
      await mkdir(dirPath, { recursive: true });

      // Read the directory
      const files = await readdir(dirPath);

      // Filter out directories
      const fileStats = await Promise.all(
        files.map(async (file) => {
          const filePath = path.join(dirPath, file);
          const fileStat = await stat(filePath);
          return {
            name: file,
            isDirectory: fileStat.isDirectory(),
          };
        }),
      );

      const fileNames = fileStats
        .filter((file) => !file.isDirectory)
        .map((file) => path.join(remotePath, file.name));

      logger.info(`Found ${fileNames.length} files`);

      return fileNames;
    } catch (error) {
      logger.error(`Error listing files: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file
   * @param remotePath Path to the file in the remote storage
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      logger.info(`Deleting file: ${remotePath}`);

      const filePath = path.join(this.config.path, remotePath);
      await unlink(filePath);

      logger.info(`File deleted successfully: ${filePath}`);
    } catch (error) {
      logger.error(`Error deleting file: ${error}`);
      throw error;
    }
  }

  /**
   * Check if a file exists
   * @param remotePath Path to the file in the remote storage
   * @returns True if the file exists, false otherwise
   */
  async fileExists(remotePath: string): Promise<boolean> {
    try {
      logger.info(`Checking if file exists: ${remotePath}`);

      const filePath = path.join(this.config.path, remotePath);

      try {
        await access(filePath, fs.constants.F_OK);
        return true;
      } catch {
        return false;
      }
    } catch (error) {
      logger.error(`Error checking if file exists: ${error}`);
      throw error;
    }
  }
}
