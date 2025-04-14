import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import axios from 'axios';
import { StorageProvider } from './provider';
import { StorageConfig, NextCloudConfig } from '../config';
import logger from '../utils/logger';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);

/**
 * NextCloud storage provider implementation
 */
export class NextCloudStorageProvider implements StorageProvider {
  private storageConfig: StorageConfig;
  private nextCloudConfig: NextCloudConfig;
  private baseUrl: string;
  private webdavUrl: string;

  /**
   * Constructor
   * @param storageConfig Storage configuration
   * @param nextCloudConfig NextCloud configuration
   */
  constructor(storageConfig: StorageConfig, nextCloudConfig: NextCloudConfig) {
    this.storageConfig = storageConfig;
    this.nextCloudConfig = nextCloudConfig;

    // Ensure the NextCloud URL doesn't end with a slash
    this.baseUrl = nextCloudConfig.url.endsWith('/')
      ? nextCloudConfig.url.slice(0, -1)
      : nextCloudConfig.url;

    // WebDAV URL
    this.webdavUrl = `${this.baseUrl}/remote.php/dav/files/${encodeURIComponent(
      nextCloudConfig.username,
    )}`;
  }

  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    try {
      logger.info(`Initializing NextCloud storage provider: ${this.baseUrl}`);

      // Check if we can connect to the NextCloud server
      await this.makeRequest('GET', '/status.php');

      // Create the base folder if it doesn't exist
      if (this.nextCloudConfig.folder) {
        await this.createFolder(this.nextCloudConfig.folder);
      }

      logger.info('NextCloud storage provider initialized');
    } catch (error) {
      logger.error(`Error initializing NextCloud storage provider: ${error}`);
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
      logger.info(`Storing file to NextCloud: ${localPath} -> ${remotePath}`);

      // Read the file
      const fileContent = await readFile(localPath);

      // Ensure the parent directory exists
      const remoteDir = path.dirname(remotePath);
      if (remoteDir !== '.') {
        await this.createFolder(remoteDir);
      }

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // Upload the file
      await axios({
        method: 'PUT',
        url: fullRemotePath,
        data: fileContent,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info(`File stored successfully in NextCloud: ${remotePath}`);

      return remotePath;
    } catch (error) {
      logger.error(`Error storing file to NextCloud: ${error}`);
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
      logger.info(`Storing stream to NextCloud: ${remotePath}`);

      // Ensure the parent directory exists
      const remoteDir = path.dirname(remotePath);
      if (remoteDir !== '.') {
        await this.createFolder(remoteDir);
      }

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // Upload the stream
      await axios({
        method: 'PUT',
        url: fullRemotePath,
        data: stream,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      });

      logger.info(`Stream stored successfully in NextCloud: ${remotePath}`);

      return remotePath;
    } catch (error) {
      logger.error(`Error storing stream to NextCloud: ${error}`);
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
      logger.info(
        `Retrieving file from NextCloud: ${remotePath} -> ${localPath}`,
      );

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(localPath);
      await mkdir(destDir, { recursive: true });

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // Download the file
      const response = await axios({
        method: 'GET',
        url: fullRemotePath,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        responseType: 'stream',
      });

      // Write the file to disk
      const writer = fs.createWriteStream(localPath);

      await new Promise<void>((resolve, reject) => {
        response.data.pipe(writer);
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      logger.info(`File retrieved successfully from NextCloud: ${localPath}`);

      return localPath;
    } catch (error) {
      logger.error(`Error retrieving file from NextCloud: ${error}`);
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
      logger.info(`Getting file stream from NextCloud: ${remotePath}`);

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // Get the file as a stream
      const response = await axios({
        method: 'GET',
        url: fullRemotePath,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        responseType: 'stream',
      });

      return response.data;
    } catch (error) {
      logger.error(`Error getting file stream from NextCloud: ${error}`);
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
      logger.info(`Listing files in NextCloud: ${remotePath}`);

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // PROPFIND request to list files
      const response = await axios({
        method: 'PROPFIND',
        url: fullRemotePath,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        headers: {
          Depth: '1',
          'Content-Type': 'application/xml',
        },
        data: `<?xml version="1.0"?>
               <d:propfind xmlns:d="DAV:">
                 <d:prop>
                   <d:resourcetype/>
                 </d:prop>
               </d:propfind>`,
      });

      // Parse the response XML
      const responseText = response.data;
      const files: string[] = [];

      // Simple XML parsing (in a real implementation, use a proper XML parser)
      const matches = responseText.match(/<d:href>([^<]+)<\/d:href>/g);

      if (matches) {
        const basePath = `${this.webdavUrl}/${
          this.nextCloudConfig.folder ? this.nextCloudConfig.folder + '/' : ''
        }`;

        for (const match of matches) {
          const href = match.replace(/<\/?d:href>/g, '');

          // Skip the directory itself
          if (href === fullRemotePath) {
            continue;
          }

          // Convert the full URL to a relative path
          let relativePath = decodeURIComponent(href.replace(basePath, ''));

          // Remove trailing slash for directories
          if (relativePath.endsWith('/')) {
            relativePath = relativePath.slice(0, -1);
          }

          // Add the path to the list
          if (relativePath) {
            files.push(path.join(remotePath, path.basename(relativePath)));
          }
        }
      }

      logger.info(`Found ${files.length} files in NextCloud`);

      return files;
    } catch (error) {
      logger.error(`Error listing files in NextCloud: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file
   * @param remotePath Path to the file in the remote storage
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      logger.info(`Deleting file from NextCloud: ${remotePath}`);

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      // Delete the file
      await axios({
        method: 'DELETE',
        url: fullRemotePath,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
      });

      logger.info(`File deleted successfully from NextCloud: ${remotePath}`);
    } catch (error) {
      logger.error(`Error deleting file from NextCloud: ${error}`);
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
      logger.info(`Checking if file exists in NextCloud: ${remotePath}`);

      // Construct the full remote path
      const fullRemotePath = this.getFullRemotePath(remotePath);

      try {
        // HEAD request to check if the file exists
        await axios({
          method: 'HEAD',
          url: fullRemotePath,
          auth: {
            username: this.nextCloudConfig.username,
            password: this.nextCloudConfig.password,
          },
        });

        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      logger.error(`Error checking if file exists in NextCloud: ${error}`);
      throw error;
    }
  }

  /**
   * Create a folder in NextCloud
   * @param folderPath Path to the folder
   */
  private async createFolder(folderPath: string): Promise<void> {
    try {
      // Split the path into segments
      const segments = folderPath.split('/').filter(Boolean);
      let currentPath = '';

      // Create each segment of the path
      for (const segment of segments) {
        currentPath = currentPath ? `${currentPath}/${segment}` : segment;

        // Check if the folder exists
        const exists = await this.fileExists(currentPath);

        if (!exists) {
          // Create the folder
          const fullPath = this.getFullRemotePath(currentPath);

          try {
            await axios({
              method: 'MKCOL',
              url: fullPath,
              auth: {
                username: this.nextCloudConfig.username,
                password: this.nextCloudConfig.password,
              },
            });
            logger.info(`Created folder in NextCloud: ${currentPath}`);
          } catch (error: any) {
            // If the error is a 409 Conflict, the folder might already exist
            if (error.response && error.response.status === 409) {
              logger.info(`Folder already exists in NextCloud: ${currentPath}`);
            } else {
              // For other errors, rethrow
              throw error;
            }
          }
        }
      }
    } catch (error) {
      logger.error(`Error creating folder in NextCloud: ${error}`);
      throw error;
    }
  }

  /**
   * Get the full remote path for a file or folder
   * @param remotePath Relative path
   * @returns Full remote path
   */
  private getFullRemotePath(remotePath: string): string {
    // Combine the base folder with the remote path
    let fullPath = remotePath;

    if (this.nextCloudConfig.folder) {
      fullPath = path.join(this.nextCloudConfig.folder, remotePath);
    }

    // Ensure the path starts with a slash
    if (!fullPath.startsWith('/')) {
      fullPath = '/' + fullPath;
    }

    // Return the full WebDAV URL
    return `${this.webdavUrl}${fullPath}`;
  }

  /**
   * Make a request to the NextCloud API
   * @param method HTTP method
   * @param endpoint API endpoint
   * @param data Request data
   * @returns Response data
   */
  private async makeRequest(
    method: string,
    endpoint: string,
    data?: any,
  ): Promise<any> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        auth: {
          username: this.nextCloudConfig.username,
          password: this.nextCloudConfig.password,
        },
        data,
      });

      return response.data;
    } catch (error) {
      logger.error(`Error making request to NextCloud: ${error}`);
      throw error;
    }
  }
}
