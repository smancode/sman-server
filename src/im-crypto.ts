import crypto from 'node:crypto';
import { decrypt, encrypt } from './crypto.js';

const IM_ENCRYPTED_PREFIX = 'enc:';

/** Encrypt a string value for IM transmission */
export function encryptField(plaintext: string, psk: string): string {
  return IM_ENCRYPTED_PREFIX + encrypt(plaintext, psk);
}

/** Decrypt an IM encrypted field, returns original if not encrypted */
export function decryptField(ciphertext: string, psk: string): string {
  if (!ciphertext.startsWith(IM_ENCRYPTED_PREFIX)) return ciphertext;
  try {
    return decrypt(ciphertext.slice(IM_ENCRYPTED_PREFIX.length), psk) as string;
  } catch {
    return ciphertext;
  }
}

/** Encrypt IM message content fields for transmission */
export function encryptIMMessage(msg: Record<string, unknown>, psk: string): Record<string, unknown> {
  const result = { ...msg };
  if (typeof result.content === 'string' && result.content) {
    result.content = encryptField(result.content, psk);
  }
  if (typeof result.attachments === 'string' && result.attachments) {
    result.attachments = encryptField(result.attachments, psk);
  }
  return result;
}

/** Decrypt IM message content fields from transmission */
export function decryptIMMessage(msg: Record<string, unknown>, psk: string): Record<string, unknown> {
  const result = { ...msg };
  if (typeof result.content === 'string' && result.content) {
    result.content = decryptField(result.content, psk);
  }
  if (typeof result.attachments === 'string' && result.attachments) {
    result.attachments = decryptField(result.attachments, psk);
  }
  return result;
}
