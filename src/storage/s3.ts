import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { Readable } from 'stream';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './provider';
import { StorageConfig, S3Config } from '../config';
import logger from '../utils/logger';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

/**
 * S3 storage provider implementation
 */
export class S3StorageProvider implements StorageProvider {
  private storageConfig: StorageConfig;
  private s3Config: S3Config;
  private client: S3Client;

  /**
   * Constructor
   * @param storageConfig Storage configuration
   * @param s3Config S3 configuration
   */
  constructor(storageConfig: StorageConfig, s3Config: S3Config) {
    this.storageConfig = storageConfig;
    this.s3Config = s3Config;

    // Create S3 client
    const clientConfig: any = {
      region: this.s3Config.region,
      credentials: {
        accessKeyId: this.s3Config.accessKey,
        secretAccessKey: this.s3Config.secretKey,
      },
    };

    // Add custom endpoint for Minio
    if (this.s3Config.endpoint) {
      clientConfig.endpoint = this.s3Config.endpoint;
      clientConfig.forcePathStyle = true; // Required for Minio
    }

    this.client = new S3Client(clientConfig);
  }

  /**
   * Get the full S3 key by prepending the subdirectory if configured
   * @param remotePath The original remote path
   * @returns The full S3 key with subdirectory if configured
   */
  private getFullS3Key(remotePath: string): string {
    if (!this.s3Config.subdirectory) {
      return remotePath;
    }

    // Normalize subdirectory to ensure it doesn't have leading/trailing slashes
    const normalizedSubdir = this.s3Config.subdirectory
      .trim()
      .replace(/^\/+/, '')
      .replace(/\/+$/, '');

    if (!normalizedSubdir) {
      return remotePath;
    }

    return `${normalizedSubdir}/${remotePath}`;
  }

  /**
   * Initialize the storage provider
   */
  async initialize(): Promise<void> {
    try {
      if (this.s3Config.subdirectory) {
        logger.info(
          `Initializing S3 storage with bucket: ${this.s3Config.bucket}, subdirectory: ${this.s3Config.subdirectory}`,
        );
      } else {
        logger.info(
          `Initializing S3 storage with bucket: ${this.s3Config.bucket}`,
        );
      }

      // Check if the bucket exists by listing objects
      await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.s3Config.bucket,
          MaxKeys: 1,
        }),
      );

      logger.info('S3 storage initialized');
    } catch (error) {
      logger.error(`Error initializing S3 storage: ${error}`);
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
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Storing file to S3: ${localPath} -> ${fullS3Key}`);

      // Read the file
      const fileContent = fs.readFileSync(localPath);

      // Upload the file to S3
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: fullS3Key,
          Body: fileContent,
        }),
      );

      logger.info(`File stored successfully in S3: ${fullS3Key}`);

      return remotePath; // Return the original remotePath for consistency
    } catch (error) {
      logger.error(`Error storing file to S3: ${error}`);
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
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Storing stream to S3: ${fullS3Key}`);

      // Convert stream to buffer
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      // Upload the buffer to S3
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: fullS3Key,
          Body: buffer,
        }),
      );

      logger.info(`Stream stored successfully in S3: ${fullS3Key}`);

      return remotePath; // Return the original remotePath for consistency
    } catch (error) {
      logger.error(`Error storing stream to S3: ${error}`);
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
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Retrieving file from S3: ${fullS3Key} -> ${localPath}`);

      // Create the destination directory if it doesn't exist
      const destDir = path.dirname(localPath);
      await mkdir(destDir, { recursive: true });

      // Get the file from S3
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: fullS3Key,
        }),
      );

      // Convert the stream to a buffer
      const chunks: Buffer[] = [];

      for await (const chunk of response.Body as Readable) {
        chunks.push(Buffer.from(chunk));
      }

      const buffer = Buffer.concat(chunks);

      // Write the buffer to the local file
      await writeFile(localPath, buffer);

      logger.info(`File retrieved successfully from S3: ${localPath}`);

      return localPath;
    } catch (error) {
      logger.error(`Error retrieving file from S3: ${error}`);
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
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Getting file stream from S3: ${fullS3Key}`);

      // Get the file from S3
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: fullS3Key,
        }),
      );

      // Return the stream
      return response.Body as Readable;
    } catch (error) {
      logger.error(`Error getting file stream from S3: ${error}`);
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
      // If we have a subdirectory configured, we need to prepend it to the remotePath
      let effectiveRemotePath = remotePath;

      if (this.s3Config.subdirectory) {
        const normalizedSubdir = this.s3Config.subdirectory
          .trim()
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');

        if (normalizedSubdir) {
          effectiveRemotePath = remotePath
            ? `${normalizedSubdir}/${remotePath}`
            : normalizedSubdir;
        }
      }

      logger.info(`Listing files in S3: ${effectiveRemotePath}`);

      // Ensure the remotePath ends with a slash if it's not empty
      const prefix = effectiveRemotePath
        ? effectiveRemotePath.endsWith('/')
          ? effectiveRemotePath
          : `${effectiveRemotePath}/`
        : '';

      // List objects in the bucket with the given prefix
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.s3Config.bucket,
          Prefix: prefix,
        }),
      );

      // Extract the file paths and remove the subdirectory prefix if it exists
      let files =
        response.Contents?.map((object) => object.Key as string) || [];

      // If we have a subdirectory, strip it from the returned paths
      if (this.s3Config.subdirectory && files.length > 0) {
        const normalizedSubdir = this.s3Config.subdirectory
          .trim()
          .replace(/^\/+/, '')
          .replace(/\/+$/, '');

        if (normalizedSubdir) {
          const prefixToStrip = `${normalizedSubdir}/`;
          files = files.map((file) =>
            file.startsWith(prefixToStrip)
              ? file.substring(prefixToStrip.length)
              : file,
          );
        }
      }

      logger.info(`Found ${files.length} files in S3`);

      return files;
    } catch (error) {
      logger.error(`Error listing files in S3: ${error}`);
      throw error;
    }
  }

  /**
   * Delete a file
   * @param remotePath Path to the file in the remote storage
   */
  async deleteFile(remotePath: string): Promise<void> {
    try {
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Deleting file from S3: ${fullS3Key}`);

      // Delete the object from S3
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.s3Config.bucket,
          Key: fullS3Key,
        }),
      );

      logger.info(`File deleted successfully from S3: ${fullS3Key}`);
    } catch (error) {
      logger.error(`Error deleting file from S3: ${error}`);
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
      const fullS3Key = this.getFullS3Key(remotePath);
      logger.info(`Checking if file exists in S3: ${fullS3Key}`);

      try {
        // Check if the object exists
        await this.client.send(
          new HeadObjectCommand({
            Bucket: this.s3Config.bucket,
            Key: fullS3Key,
          }),
        );

        return true;
      } catch (error: any) {
        if (error.name === 'NotFound') {
          return false;
        }
        throw error;
      }
    } catch (error) {
      logger.error(`Error checking if file exists in S3: ${error}`);
      throw error;
    }
  }
}
