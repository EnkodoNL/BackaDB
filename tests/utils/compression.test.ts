import fs from 'fs';
import path from 'path';
import os from 'os';
import { compressFile, decompressFile } from '../../src/utils/compression';

describe('Compression Utils', () => {
  let tempDir: string;
  let testFile: string;
  let compressedFile: string;
  let decompressedFile: string;
  const testContent = 'This is a test file content for compression testing.';

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), `compression-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create test file
    testFile = path.join(tempDir, 'test-file.txt');
    fs.writeFileSync(testFile, testContent);

    // Define paths for compressed and decompressed files
    compressedFile = path.join(tempDir, 'compressed-file.gz');
    decompressedFile = path.join(tempDir, 'decompressed-file.txt');
  });

  afterAll(() => {
    // Clean up temporary files
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    if (fs.existsSync(compressedFile)) fs.unlinkSync(compressedFile);
    if (fs.existsSync(decompressedFile)) fs.unlinkSync(decompressedFile);

    // Remove temporary directory
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  });

  it('should compress and decompress a file correctly', async () => {
    // Compress the file
    await compressFile(testFile, compressedFile);

    // Verify compressed file exists and is smaller than original
    expect(fs.existsSync(compressedFile)).toBe(true);
    const originalSize = fs.statSync(testFile).size;
    const compressedSize = fs.statSync(compressedFile).size;
    expect(compressedSize).toBeLessThan(originalSize);

    // Decompress the file
    await decompressFile(compressedFile, decompressedFile);

    // Verify decompressed content matches original
    const decompressedContent = fs.readFileSync(decompressedFile, 'utf8');
    expect(decompressedContent).toEqual(testContent);
  });

  it('should throw an error when decompressing an invalid file', async () => {
    // Create an invalid compressed file
    const invalidFile = path.join(tempDir, 'invalid.gz');
    fs.writeFileSync(invalidFile, 'This is not a valid gzip file');

    // Attempt to decompress the invalid file
    await expect(
      decompressFile(invalidFile, decompressedFile),
    ).rejects.toThrow();

    // Clean up
    if (fs.existsSync(invalidFile)) fs.unlinkSync(invalidFile);
  });
});
