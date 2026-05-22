import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedPsk: string | null = null;

function readKeyFile(filePath: string): string | null {
  try {
    const key = fs.readFileSync(filePath, 'utf-8').trim();
    if (key.length === KEY_LENGTH) return key;
  } catch {}
  return null;
}

function generateRandomKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('base64').slice(0, KEY_LENGTH);
}

export function loadPsk(): string {
  if (cachedPsk) return cachedPsk;

  // Priority: SMAN_PSK env > hub.key file
  if (process.env.SMAN_PSK && process.env.SMAN_PSK.length === KEY_LENGTH) {
    cachedPsk = process.env.SMAN_PSK;
    return cachedPsk;
  }

  const dataDir = process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data');
  const keyPath = path.join(dataDir, 'hub.key');
  const existing = readKeyFile(keyPath);
  if (existing) { cachedPsk = existing; return existing; }

  console.error(`ERROR: PSK not found. Set SMAN_PSK env (${KEY_LENGTH} chars) or create ${keyPath}`);
  process.exit(1);
}

export function encrypt(data: unknown, psk?: string): string {
  const key = Buffer.from(psk || loadPsk(), 'utf-8');
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const plaintext = JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf-8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, authTag]).toString('base64');
}

export function decrypt(encoded: string, psk?: string): unknown {
  const key = Buffer.from(psk || loadPsk(), 'utf-8');
  const buf = Buffer.from(encoded, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf-8'));
}
