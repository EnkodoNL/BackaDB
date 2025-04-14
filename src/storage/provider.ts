import { Readable } from 'stream';

/**
 * Storage provider interface
 * This interface defines the methods that all storage providers must implement
 */
export interface StorageProvider {
  /**
   * Initialize the storage provider
   */
  initialize(): Promise<void>;

  /**
   * Store a file
   * @param localPath Path to the local file
   * @param remotePath Path to store the file in the remote storage
   * @returns Remote path or identifier of the stored file
   */
  storeFile(localPath: string, remotePath: string): Promise<string>;

  /**
   * Store data from a stream
   * @param stream Readable stream containing the data
   * @param remotePath Path to store the file in the remote storage
   * @returns Remote path or identifier of the stored file
   */
  storeStream(stream: Readable, remotePath: string): Promise<string>;

  /**
   * Retrieve a file
   * @param remotePath Path to the file in the remote storage
   * @param localPath Path to save the file locally
   * @returns Local path of the retrieved file
   */
  retrieveFile(remotePath: string, localPath: string): Promise<string>;

  /**
   * Get a readable stream for a file
   * @param remotePath Path to the file in the remote storage
   * @returns Readable stream for the file
   */
  getFileStream(remotePath: string): Promise<Readable>;

  /**
   * List files in a directory
   * @param remotePath Path to the directory in the remote storage
   * @returns Array of file paths
   */
  listFiles(remotePath: string): Promise<string[]>;

  /**
   * Delete a file
   * @param remotePath Path to the file in the remote storage
   */
  deleteFile(remotePath: string): Promise<void>;

  /**
   * Check if a file exists
   * @param remotePath Path to the file in the remote storage
   * @returns True if the file exists, false otherwise
   */
  fileExists(remotePath: string): Promise<boolean>;
}

/**
 * Storage provider factory interface
 * This interface defines the methods that all storage provider factories must implement
 */
export interface StorageProviderFactory {
  /**
   * Create a storage provider
   * @param config Storage configuration
   * @returns Storage provider instance
   */
  createProvider(config: any): StorageProvider;
}
