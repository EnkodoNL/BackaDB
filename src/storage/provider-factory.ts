import {
  StorageConfig,
  S3Config,
  GoogleDriveConfig,
  NextCloudConfig,
} from '../config';
import { StorageProvider, StorageProviderFactory } from './provider';
import { LocalStorageProvider } from './local';
import { S3StorageProvider } from './s3';
import { GoogleDriveStorageProvider } from './gdrive';
import { NextCloudStorageProvider } from './nextcloud';
import logger from '../utils/logger';

/**
 * Storage provider factory implementation
 * This class creates storage providers based on the storage type
 */
export class DefaultStorageProviderFactory implements StorageProviderFactory {
  /**
   * Create a storage provider
   * @param config Storage configuration
   * @param additionalConfig Additional configuration for specific storage types
   * @returns Storage provider instance
   */
  createProvider(
    config: StorageConfig,
    additionalConfig?: {
      s3?: S3Config;
      googleDrive?: GoogleDriveConfig;
      nextCloud?: NextCloudConfig;
    },
  ): StorageProvider {
    logger.info(`Creating storage provider for type: ${config.type}`);

    switch (config.type.toLowerCase()) {
      case 'local':
        return new LocalStorageProvider(config);
      case 's3':
        if (!additionalConfig?.s3) {
          throw new Error(
            'S3 configuration is required for S3 storage provider',
          );
        }
        return new S3StorageProvider(config, additionalConfig.s3);
      case 'gdrive':
        if (!additionalConfig?.googleDrive) {
          throw new Error(
            'Google Drive configuration is required for Google Drive storage provider',
          );
        }
        return new GoogleDriveStorageProvider(
          config,
          additionalConfig.googleDrive,
        );
      case 'nextcloud':
        if (!additionalConfig?.nextCloud) {
          throw new Error(
            'NextCloud configuration is required for NextCloud storage provider',
          );
        }
        return new NextCloudStorageProvider(config, additionalConfig.nextCloud);
      default:
        throw new Error(`Unsupported storage type: ${config.type}`);
    }
  }
}

// Export a singleton instance of the factory
export const storageProviderFactory = new DefaultStorageProviderFactory();
