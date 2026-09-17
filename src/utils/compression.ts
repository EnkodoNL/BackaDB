import path from 'path';
import { createReadStream, createWriteStream, openAsBlob } from 'fs';
import { stat } from 'fs/promises';
import { Readable, Writable } from 'stream';
import { BlobReader, ZipReader, ZipWriter, configure } from '@zip.js/zip.js';
import logger from './logger';

// Run codecs in-process; web workers add nothing for a single-file backup job
configure({ useWebWorkers: false });

/**
 * Create a zip file, optionally password-protected (AES-256)
 * @param inputPath Path to the file to compress
 * @param outputPath Path to save the compressed file
 * @param password Optional password for encryption
 */
export async function compressFile(
  inputPath: string,
  outputPath: string,
  password?: string,
): Promise<void> {
  if (password) {
    logger.info(
      `Creating password-protected zip: ${inputPath} -> ${outputPath}`,
    );
  } else {
    logger.info(`Creating zip: ${inputPath} -> ${outputPath}`);
  }

  try {
    const zipWriter = new ZipWriter(
      Writable.toWeb(createWriteStream(outputPath)),
      {
        level: 9,
        ...(password ? { password, encryptionStrength: 3 as const } : {}),
      },
    );

    await zipWriter.add(
      path.basename(inputPath),
      Readable.toWeb(createReadStream(inputPath)) as ReadableStream<Uint8Array>,
    );
    await zipWriter.close();

    const bytes = (await stat(outputPath)).size;
    logger.info(
      `${password ? 'Password-protected zip' : 'Zip'} created successfully: ${outputPath}`,
    );
    logger.info(
      `Total: ${(bytes / (1024 * 1024)).toFixed(1)}MB (${(bytes / 1024).toFixed(0)}KB)`,
    );
  } catch (error) {
    logger.error(`Error creating zip: ${error}`);
    throw error;
  }
}

/**
 * Extract the first file from a zip archive
 * @param inputPath Path to the zip file
 * @param outputPath Path to write the extracted file to
 * @param password Optional password for encrypted archives
 */
export async function decompressFile(
  inputPath: string,
  outputPath: string,
  password?: string,
): Promise<void> {
  const zipReader = new ZipReader(new BlobReader(await openAsBlob(inputPath)));

  try {
    const entry = (await zipReader.getEntries()).find(
      (candidate) => !candidate.directory,
    );
    if (!entry || entry.directory) {
      throw new Error(`No file found in zip: ${inputPath}`);
    }

    await entry.getData(Writable.toWeb(createWriteStream(outputPath)), {
      password,
    });
    logger.info(`Extracted ${entry.filename} -> ${outputPath}`);
  } finally {
    await zipReader.close();
  }
}
