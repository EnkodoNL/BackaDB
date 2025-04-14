import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';
import logger from './logger';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

// Algorithm and key derivation parameters
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const SALT_LENGTH = 16;
const ITERATIONS = 100000;
const DIGEST = 'sha256';

/**
 * Derive a key from a password
 * @param password The password to derive the key from
 * @param salt The salt to use for key derivation
 * @returns The derived key and IV
 */
function deriveKey(
  password: string,
  salt: Buffer,
): { key: Buffer; iv: Buffer } {
  const key = crypto.pbkdf2Sync(
    password,
    salt,
    ITERATIONS,
    KEY_LENGTH + IV_LENGTH,
    DIGEST,
  );

  return {
    key: key.slice(0, KEY_LENGTH),
    iv: key.slice(KEY_LENGTH, KEY_LENGTH + IV_LENGTH),
  };
}

/**
 * Encrypt a file
 * @param inputPath Path to the file to encrypt
 * @param outputPath Path to save the encrypted file
 * @param password Password to use for encryption
 */
export async function encryptFile(
  inputPath: string,
  outputPath: string,
  password: string,
): Promise<void> {
  try {
    logger.info(`Encrypting file: ${inputPath} -> ${outputPath}`);

    // Read the input file
    const data = await readFile(inputPath);

    // Generate a random salt
    const salt = crypto.randomBytes(SALT_LENGTH);

    // Derive key and IV from password and salt
    const { key, iv } = deriveKey(password, salt);

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt the data
    const encryptedData = Buffer.concat([cipher.update(data), cipher.final()]);

    // Combine salt and encrypted data
    const result = Buffer.concat([salt, encryptedData]);

    // Write the encrypted data to the output file
    await writeFile(outputPath, result);

    logger.info(`File encrypted successfully: ${outputPath}`);
  } catch (error) {
    logger.error(`Error encrypting file: ${error}`);
    throw error;
  }
}

/**
 * Decrypt a file
 * @param inputPath Path to the encrypted file
 * @param outputPath Path to save the decrypted file
 * @param password Password to use for decryption
 */
export async function decryptFile(
  inputPath: string,
  outputPath: string,
  password: string,
): Promise<void> {
  try {
    logger.info(`Decrypting file: ${inputPath} -> ${outputPath}`);

    // Read the encrypted file
    const data = await readFile(inputPath);

    // Extract the salt
    const salt = data.slice(0, SALT_LENGTH);

    // Extract the encrypted data
    const encryptedData = data.slice(SALT_LENGTH);

    // Derive key and IV from password and salt
    const { key, iv } = deriveKey(password, salt);

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

    // Decrypt the data
    const decryptedData = Buffer.concat([
      decipher.update(encryptedData),
      decipher.final(),
    ]);

    // Write the decrypted data to the output file
    await writeFile(outputPath, decryptedData);

    logger.info(`File decrypted successfully: ${outputPath}`);
  } catch (error) {
    logger.error(`Error decrypting file: ${error}`);
    throw error;
  }
}
