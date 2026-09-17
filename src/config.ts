import dotenv from 'dotenv';

// Load environment variables from .env file if present
dotenv.config();

/**
 * Database configuration
 */
export interface DatabaseConfig {
  type: string;
  host: string;
  port: number;
  user: string;
  password: string;
  databases: string[];
  params: string;
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  schedule: string;
  format: string;
  encrypt: boolean;
  encryptPassword?: string;
  onStartup: boolean;
}

/**
 * Storage configuration
 */
export interface StorageConfig {
  type: string;
  path: string;
}

/**
 * S3 configuration
 */
export interface S3Config {
  bucket: string;
  region: string;
  endpoint?: string;
  accessKey: string;
  secretKey: string;
  subdirectory?: string;
}

/**
 * Google Drive configuration
 */
export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId: string;
}

/**
 * NextCloud configuration
 */
export interface NextCloudConfig {
  url: string;
  username: string;
  password: string;
  folder: string;
}

/**
 * Retention strategy
 * - count: keep the newest N backups
 * - time: keep backups younger than a number of days
 * - first: delete a backup as soon as either the count or the time limit is reached
 * - gfs: keep a number of daily, weekly and monthly backups
 */
export const RETENTION_STRATEGIES = ['count', 'time', 'first', 'gfs'] as const;
export type RetentionStrategy = (typeof RETENTION_STRATEGIES)[number];

/**
 * Retention configuration
 */
export interface RetentionConfig {
  enabled: boolean;
  strategy: RetentionStrategy;
  count: number;
  days: number;
  daily: number;
  weekly: number;
  monthly: number;
}

/**
 * Notification configuration
 */
export interface NotificationConfig {
  http: boolean;
  httpPort: number;
  httpPath: string;
  httpToken: string;
}

/**
 * Application configuration
 */
export interface AppConfig {
  database: DatabaseConfig;
  backup: BackupConfig;
  storage: StorageConfig;
  s3?: S3Config;
  googleDrive?: GoogleDriveConfig;
  nextCloud?: NextCloudConfig;
  retention: RetentionConfig;
  notification: NotificationConfig;
}

/**
 * Get database configuration from environment variables
 */
function getDatabaseConfig(): DatabaseConfig {
  const databases = process.env.DB_DATABASES || 'all';

  return {
    type: process.env.DB_TYPE || 'mariadb',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    databases: databases === 'all' ? ['all'] : databases.split(','),
    params: process.env.DB_PARAMS || '',
  };
}

/**
 * Get backup configuration from environment variables
 */
function getBackupConfig(): BackupConfig {
  return {
    schedule: process.env.BACKUP_SCHEDULE || '0 1 * * *',
    format: process.env.BACKUP_FORMAT || 'sql',
    encrypt: process.env.BACKUP_ENCRYPT === 'true',
    encryptPassword: process.env.BACKUP_ENCRYPT_PASSWORD,
    onStartup: process.env.BACKUP_ON_STARTUP === 'true',
  };
}

/**
 * Get storage configuration from environment variables
 */
function getStorageConfig(): StorageConfig {
  return {
    type: process.env.STORAGE_TYPE || 'local',
    path: process.env.STORAGE_PATH || '/backups',
  };
}

/**
 * Get S3 configuration from environment variables
 */
function getS3Config(): S3Config | undefined {
  if (process.env.STORAGE_TYPE !== 's3') {
    return undefined;
  }

  return {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || '',
    endpoint: process.env.S3_ENDPOINT,
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    subdirectory: process.env.S3_SUBDIRECTORY || '',
  };
}

/**
 * Get Google Drive configuration from environment variables
 */
function getGoogleDriveConfig(): GoogleDriveConfig | undefined {
  if (process.env.STORAGE_TYPE !== 'gdrive') {
    return undefined;
  }

  return {
    clientId: process.env.GDRIVE_CLIENT_ID || '',
    clientSecret: process.env.GDRIVE_CLIENT_SECRET || '',
    refreshToken: process.env.GDRIVE_REFRESH_TOKEN || '',
    folderId: process.env.GDRIVE_FOLDER_ID || '',
  };
}

/**
 * Get NextCloud configuration from environment variables
 */
function getNextCloudConfig(): NextCloudConfig | undefined {
  if (process.env.STORAGE_TYPE !== 'nextcloud') {
    return undefined;
  }

  return {
    url: process.env.NEXTCLOUD_URL || '',
    username: process.env.NEXTCLOUD_USERNAME || '',
    password: process.env.NEXTCLOUD_PASSWORD || '',
    folder: process.env.NEXTCLOUD_FOLDER || '',
  };
}

/**
 * Get retention configuration from environment variables
 */
function getRetentionConfig(): RetentionConfig {
  const strategy = process.env.RETENTION_STRATEGY || 'count';
  if (!(RETENTION_STRATEGIES as readonly string[]).includes(strategy)) {
    throw new Error(
      `Invalid RETENTION_STRATEGY "${strategy}", expected one of: ${RETENTION_STRATEGIES.join(', ')}`,
    );
  }

  return {
    enabled: process.env.RETENTION_ENABLED === 'true',
    strategy: strategy as RetentionStrategy,
    count: getPositiveInt('RETENTION_COUNT', 7),
    days: getPositiveInt('RETENTION_DAYS', 30),
    daily: getPositiveInt('RETENTION_DAILY', 7),
    weekly: getPositiveInt('RETENTION_WEEKLY', 4),
    monthly: getPositiveInt('RETENTION_MONTHLY', 3),
  };
}

/**
 * Read a positive integer from the environment
 * Retention deletes everything beyond these limits, so invalid values must fail loudly.
 */
function getPositiveInt(name: string, defaultValue: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return defaultValue;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${name} "${raw}", expected a positive integer`);
  }
  return value;
}

/**
 * Get notification configuration from environment variables
 */
function getNotificationConfig(): NotificationConfig {
  return {
    http: process.env.NOTIFICATION_HTTP === 'true',
    httpPort: parseInt(process.env.NOTIFICATION_HTTP_PORT || '8080', 10),
    httpPath: process.env.NOTIFICATION_HTTP_PATH || '/health',
    httpToken: process.env.NOTIFICATION_HTTP_TOKEN || '',
  };
}

/**
 * Get application configuration
 */
export function getConfig(): AppConfig {
  return {
    database: getDatabaseConfig(),
    backup: getBackupConfig(),
    storage: getStorageConfig(),
    s3: getS3Config(),
    googleDrive: getGoogleDriveConfig(),
    nextCloud: getNextCloudConfig(),
    retention: getRetentionConfig(),
    notification: getNotificationConfig(),
  };
}

// Export default configuration
export default getConfig();
