import 'archiver';

declare module 'archiver' {
  export type Format = 'zip' | 'zip-encrypted';
  interface CoreOptions {
    encryptionMethod?: 'aes256' | 'zip20' | undefined;
    password?: string | undefined;
  }
}
