/**
 * Backup status
 */
export enum BackupStatus {
  SUCCESS = 'success',
  FAILURE = 'failure',
}

/**
 * Backup result
 */
export interface BackupResult {
  database: string;
  timestamp: Date;
  status: BackupStatus;
  message: string;
  filePath?: string;
  fileSize?: number;
  duration: number;
}

/**
 * Notifier interface
 * This interface defines the methods that all notifiers must implement
 */
export interface Notifier {
  /**
   * Initialize the notifier
   */
  initialize(): Promise<void>;

  /**
   * Send a notification
   * @param result Backup result
   */
  notify(result: BackupResult): Promise<void>;

  /**
   * Check the health of the notifier
   * @returns True if the notifier is healthy, false otherwise
   */
  checkHealth(): Promise<boolean>;
}

/**
 * Notifier factory interface
 * This interface defines the methods that all notifier factories must implement
 */
export interface NotifierFactory {
  /**
   * Create a notifier
   * @param config Notifier configuration
   * @returns Notifier instance
   */
  createNotifier(config: any): Notifier;
}
