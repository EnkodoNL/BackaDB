import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import { google, drive_v3 } from 'googleapis';
import { StorageProvider } from './provider';
import { StorageConfig, GoogleDriveConfig } from '../config';
import logger from '../utils/logger';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const readFile = promisify(fs.readFile);

/**
 * Google Drive storage provider implementation
 */
export class GoogleDriveStorageProvider implements StorageProvider {
  private storageConfig: StorageConfig;
  private gdriveConfig: GoogleDriveConfig;
  private drive: drive_v3.Drive;

  /**
   * Constructor
   * @param storageConfig Storage configuration
   * @param gdriveConfig Google Drive configuration
   */
  constructor(storageConfig: StorageConfig, gdriveConfig: GoogleDriveConfig) {
    this.storageConfig = storageConfig;
    this.gdriveConfig = gdriveConfig;

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      this.gdriveConfig.clientId,
      this.gdriveConfig.clientSecret,
    );

    // Set credentials
    oauth2Client.setCredentials({
      refresh_token: this.gdriveConfig.refreshToken,
    });

    // Create Drive client
    this.drive = google.drive({
      version: 'v3',
      auth: oauth2Client,
    });
  }

  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Google Drive storage provider');

      // Check if the folder exists
      if (this.gdriveConfig.folderId) {
        try {
          await this.drive.files.get({
            fileId: this.gdriveConfig.folderId,
            fields: 'id, name',
          });

          logger.info(
            `Using existing Google Drive folder: ${this.gdriveConfig.folderId}`,
          );
        } catch (error) {
          logger.error(`Error accessing Google Drive folder: ${error}`);
          throw new Error('Invalid Google Drive folder ID');
        }
      } else {
        logger.info(
          'No folder ID provided, files will be stored in the root of Google Drive',
        );
      }

      logger.info('Google Drive storage provider initialized');
    } catch (error) {
      logger.error(
        `Error initializing Google Drive storage provider: ${error}`,
      );
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
      logger.info(
        `Storing file to Google Drive: ${localPath} -> ${remotePath}`,
      );

      // Read the file
      const fileContent = await readFile(localPath);

      // Create file metadata
      const fileName = path.basename(remotePath);
      const fileMetadata: drive_v3.Schema$File = {
        name: fileName,
        mimeType: 'application/octet-stream',
      };

      // Set parent folder if provided
      if (this.gdriveConfig.folderId) {
        fileMetadata.parents = [this.gdriveConfig.folderId];
      }

      // Upload the file
      const response = await this.drive.files.create({
        requestBody: fileMetadata,
        media: {
          mimeType: 'application/octet-stream',
          body: fileContent,
        },
        fields: 'id',
      });

      const fileId = response.data.id;

      if (!fileId) {
        throw new Error('Failed to upload file to Google Drive');
      }

      logger.info(`File stored successfully in Google Drive: ${fileId}`);

      // Store the file ID in the remote path
      return `${remotePath}:${fileId}`;
    } catch (error) {
      logger.error(`Error storing file to Google Drive: ${error}`);
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
      logger.info(`Storing stream to Google Drive: ${remotePath}`);

      // Create a temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      await mkdir(tempDir, { recursive: true });
      const tempFile = path.join(tempDir, path.basename(remotePath));

      // Write the stream to a temporary file
      const writeStream = fs.createWriteStream(tempFile);

      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(writeStream)
          .on('finish', () => resolve())
          .on('error', (error) => reject(error));
      });

      // Store the temporary file
      const result = await this.storeFile(tempFile, remotePath);

      // Clean up the temporary file
      fs.unlinkSync(tempFile);

      return result;
    } catch (error) {
      logger.error(`Error storing stream to Google Drive: ${error}`);
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
        `Retrieving file from Google Drive: ${remotePath} -> ${localPath}`,
      );

      // Extract the file ID from the remote path
      const fileId = this.getFileIdFromPath(remotePath);

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(localPath);
      await mkdir(destDir, { recursive: true });

      // Download the file
      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' },
      );

      // Write the file to disk
      const dest = fs.createWriteStream(localPath);

      await new Promise<void>((resolve, reject) => {
        response.data
          .pipe(dest)
          .on('finish', () => resolve())
          .on('error', (error) => reject(error));
      });

      logger.info(
        `File retrieved successfully from Google Drive: ${localPath}`,
      );

      return localPath;
    } catch (error) {
      logger.error(`Error retrieving file from Google Drive: ${error}`);
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
      logger.info(`Getting file stream from Google Drive: ${remotePath}`);

      // Extract the file ID from the remote path
      const fileId = this.getFileIdFromPath(remotePath);

      // Get the file as a stream
      const response = await this.drive.files.get(
        {
          fileId,
          alt: 'media',
        },
        { responseType: 'stream' },
      );

      return response.data as Readable;
    } catch (error) {
      logger.error(`Error getting file stream from Google Drive: ${error}`);
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
      logger.info(`Listing files in Google Drive: ${remotePath}`);

      // Determine the folder ID to list
      let folderId = this.gdriveConfig.folderId;

      // If remotePath is not empty, try to find the folder
      if (remotePath && remotePath !== '/') {
        const folderName = path.basename(remotePath);
        const response = await this.drive.files.list({
          q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
          fields: 'files(id, name)',
        });

        if (response.data.files && response.data.files.length > 0) {
          folderId = response.data.files[0].id || folderId;
        } else {
          // Folder not found, return empty array
          return [];
        }
      }

      // List files in the folder
      const query = folderId
        ? `'${folderId}' in parents and trashed = false`
        : 'trashed = false';

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      // Map the files to paths
      const files = response.data.files || [];
      const filePaths = files.map((file) => {
        const filePath = path.join(remotePath, file.name || '');
        return `${filePath}:${file.id}`;
      });

      logger.info(`Found ${filePaths.length} files in Google Drive`);

      return filePaths;
    } catch (error) {
      logger.error(`Error listing files in Google Drive: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file
   * @param remotePath Path to the file in the remote storage
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      logger.info(`Deleting file from Google Drive: ${remotePath}`);

      // Extract the file ID from the remote path
      const fileId = this.getFileIdFromPath(remotePath);

      // Delete the file
      await this.drive.files.delete({
        fileId,
      });

      logger.info(`File deleted successfully from Google Drive: ${remotePath}`);
    } catch (error) {
      logger.error(`Error deleting file from Google Drive: ${error}`);
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
      logger.info(`Checking if file exists in Google Drive: ${remotePath}`);

      // Extract the file ID from the remote path
      const fileId = this.getFileIdFromPath(remotePath);

      try {
        // Check if the file exists
        await this.drive.files.get({
          fileId,
          fields: 'id',
        });

        return true;
      } catch (error) {
        return false;
      }
    } catch (error) {
      logger.error(`Error checking if file exists in Google Drive: ${error}`);
      throw error;
    }
  }

  /**
   * Extract the file ID from the remote path
   * @param remotePath Remote path with file ID
   * @returns File ID
   */
  private getFileIdFromPath(remotePath: string): string {
    const parts = remotePath.split(':');

    if (parts.length < 2) {
      throw new Error(`Invalid Google Drive remote path: ${remotePath}`);
    }

    return parts[parts.length - 1];
  }
}
