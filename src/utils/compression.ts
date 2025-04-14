import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';
import logger from './logger';

// Flag to track if encryption is available
let encryptionAvailable = false;

// Try to register the encrypted zip format
try {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/no-var-requires
  const ArchiverZipEncrypted = require('archiver-zip-encrypted');
  archiver.registerFormat(
    'zip-encrypted' as archiver.Format,
    ArchiverZipEncrypted,
  );
  encryptionAvailable = true;
  logger.info('Password-protected zip compression is available');
} catch (error) {
  logger.warn('Password-protected zip compression is not available: ' + error);
  encryptionAvailable = false;
}

/**
 * Create a zip file, optionally password-protected
 * @param inputPath Path to the file to compress
 * @param outputPath Path to save the compressed file
 * @param password Optional password for encryption
 */
export async function compressFile(
  inputPath: string,
  outputPath: string,
  password?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      if (password) {
        logger.info(
          `Creating password-protected zip: ${inputPath} -> ${outputPath}`,
        );
      } else {
        logger.info(`Creating zip: ${inputPath} -> ${outputPath}`);
      }

      // Create a file to stream archive data to
      const output = createWriteStream(outputPath);

      // Create the appropriate archiver instance
      let archive;

      // Use password protection if available and requested
      if (password && encryptionAvailable) {
        try {
          archive = archiver('zip-encrypted' as archiver.Format, {
            zlib: { level: 9 }, // Sets the compression level
            encryptionMethod: 'aes256', // Use AES-256 encryption
            password, // Set password for the zip file
          });
          logger.info('Using password-protected zip format');
        } catch (error) {
          logger.warn(
            `Error creating encrypted archive, falling back to regular zip: ${error}`,
          );
          archive = archiver('zip', {
            zlib: { level: 9 }, // Sets the compression level
          });
        }
      } else {
        // Use regular zip if no password or encryption not available
        if (password && !encryptionAvailable) {
          logger.warn(
            'Password protection requested but not available, using regular zip',
          );
        }

        archive = archiver('zip', {
          zlib: { level: 9 }, // Sets the compression level
        });
      }

      // Listen for all archive data to be written
      output.on('close', () => {
        if (password) {
          logger.info(
            `Password-protected zip created successfully: ${outputPath}`,
          );
        } else {
          logger.info(`Zip created successfully: ${outputPath}`);
        }
        const bytes = archive.pointer();
        const kilobytes = bytes / 1024;
        const megabytes = bytes / (1024 * 1024);
        logger.info(
          `Total: ${megabytes.toFixed(1)}MB (${kilobytes.toFixed(0)}KB)`,
        );

        resolve();
      });

      // Good practice to catch warnings (ie stat failures and other non-blocking errors)
      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          // Log warning
          logger.warn(`Warning while creating zip: ${err}`);
        } else {
          // Reject on other errors
          reject(err);
        }
      });

      // Catch errors
      archive.on('error', (err) => {
        logger.error(`Error creating zip: ${err}`);
        reject(err);
      });

      // Pipe archive data to the file
      archive.pipe(output);

      // Add the file to the archive
      const fileName = path.basename(inputPath);
      archive.file(inputPath, { name: fileName });

      // Finalize the archive (ie we are done appending files but streams have to finish yet)
      archive.finalize();
    } catch (error) {
      logger.error(`Error creating zip: ${error}`);
      reject(error);
    }
  });
}

/**
 * Decompress a file
 * Note: This is a placeholder function. For extraction, you would need to use
 * a library that supports extracting zip files, potentially with password protection.
 */
export async function decompressFile(
  _inputPath: string,
  _outputPath: string,
  _password?: string,
): Promise<void> {
  // This is a placeholder. In a real implementation, you would use a library
  // that supports extracting zip files, potentially with password protection.
  logger.warn('Decompression is not implemented');
  throw new Error('Decompression is not implemented');
}
