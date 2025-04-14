import fs from "fs";
import path from "path";
import os from "os";
import { encryptFile, decryptFile } from "../../src/utils/encryption";

describe("Encryption Utils", () => {
  let tempDir: string;
  let testFile: string;
  let encryptedFile: string;
  let decryptedFile: string;
  const testContent = "This is a test file content for encryption testing.";
  const password = "test-password-123";

  beforeAll(async () => {
    // Create temporary directory for test files
    tempDir = path.join(os.tmpdir(), `encryption-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    // Create test file
    testFile = path.join(tempDir, "test-file.txt");
    fs.writeFileSync(testFile, testContent);

    // Define paths for encrypted and decrypted files
    encryptedFile = path.join(tempDir, "encrypted-file.enc");
    decryptedFile = path.join(tempDir, "decrypted-file.txt");
  });

  afterAll(() => {
    // Clean up temporary files
    if (fs.existsSync(testFile)) fs.unlinkSync(testFile);
    if (fs.existsSync(encryptedFile)) fs.unlinkSync(encryptedFile);
    if (fs.existsSync(decryptedFile)) fs.unlinkSync(decryptedFile);

    // Remove temporary directory
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  });

  it("should encrypt and decrypt a file correctly", async () => {
    // Encrypt the file
    await encryptFile(testFile, encryptedFile, password);

    // Verify encrypted file exists and is different from original
    expect(fs.existsSync(encryptedFile)).toBe(true);
    const encryptedContent = fs.readFileSync(encryptedFile);
    expect(encryptedContent.toString()).not.toEqual(testContent);

    // Decrypt the file
    await decryptFile(encryptedFile, decryptedFile, password);

    // Verify decrypted content matches original
    const decryptedContent = fs.readFileSync(decryptedFile, "utf8");
    expect(decryptedContent).toEqual(testContent);
  });

  it("should throw an error when decrypting with wrong password", async () => {
    // Encrypt the file
    await encryptFile(testFile, encryptedFile, password);

    // Attempt to decrypt with wrong password
    await expect(
      decryptFile(encryptedFile, decryptedFile, "wrong-password")
    ).rejects.toThrow();
  });
});
