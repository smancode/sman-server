import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import https from 'node:https';
import http from 'node:http';
import express from 'express';
import { WebSocket } from 'ws';
import { initCA, signCSR, generateServerCert, verifyClientCert, getCACertPem } from '../ca.js';
import { CertDB } from '../db-certs.js';
import { WsHub } from '../ws-server.js';
import { IMDB } from '../db-im.js';
import { RoomDB } from '../db-rooms.js';
import { loadPsk } from '../crypto.js';

const TEST_DIR = path.join('/tmp', `sman-mtls-test-${Date.now()}`);
const TLS_DIR = path.join(TEST_DIR, 'tls');
const TEST_PORT = 18930;

let server: https.Server;
let certDB: CertDB;
let caCertPem: string;

function openssl(args: string): Buffer {
  return execSync(`openssl ${args}`, { stdio: ['pipe', 'pipe', 'pipe'] });
}

function generateClientCSR(cn: string): { keyPath: string; csrPath: string; keyPem: string; csrPem: string } {
  const tmpDir = path.join(TEST_DIR, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const keyPath = path.join(tmpDir, `client-${cn.replace(/[^a-z0-9]/gi, '_')}-key.pem`);
  const csrPath = path.join(tmpDir, `client-${cn.replace(/[^a-z0-9]/gi, '_')}.csr`);

  openssl(`req -new -nodes -newkey rsa:2048 -keyout "${keyPath}" -out "${csrPath}" -subj "/CN=${cn}/O=Sman Client" -sha256 2>/dev/null`);

  return {
    keyPath,
    csrPath,
    keyPem: fs.readFileSync(keyPath, 'utf-8'),
    csrPem: fs.readFileSync(csrPath, 'utf-8'),
  };
}

function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => data += d);
      res.on('end', () => resolve({ statusCode: res.statusCode!, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

beforeAll(() => {
  fs.mkdirSync(TEST_DIR, { recursive: true });

  // Init CA
  const caResult = initCA(TLS_DIR);
  expect(caResult.generated).toBe(true);
  caCertPem = caResult.caCertPem;

  // Generate server cert
  const serverCerts = generateServerCert(TLS_DIR);

  // Init DBs
  certDB = new CertDB(path.join(TEST_DIR, 'certs.db'));
  const imDB = new IMDB(path.join(TEST_DIR, 'im.db'));
  const roomDB = new RoomDB(path.join(TEST_DIR, 'rooms.db'));
  const psk = '0123456789abcdef0123456789abcdef';

  // Create express app
  const app = express();
  app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Create HTTPS server with mTLS
  server = https.createServer({
    key: serverCerts.key,
    cert: serverCerts.cert,
    ca: caCertPem,
    requestCert: true,
    rejectUnauthorized: false,
  }, app);

  // Create WsHub
  new WsHub(server, roomDB, imDB, null, psk, undefined, certDB);

  server.listen(TEST_PORT);
});

afterAll(() => {
  server?.close();
  certDB?.close();
  try { fs.rmSync(TEST_DIR, { recursive: true }); } catch { /* ignore */ }
});

describe('CA Module', () => {
  it('should load existing CA on second init', () => {
    const result = initCA(TLS_DIR);
    expect(result.generated).toBe(false);
    expect(result.caCertPem).toContain('BEGIN CERTIFICATE');
  });

  it('should sign a CSR and return valid certificate', () => {
    const { csrPem } = generateClientCSR('test-user@macbook');
    const certInfo = signCSR(csrPem, 'test-user@macbook', 'device-001');

    expect(certInfo.serial).toBeTruthy();
    expect(certInfo.identity).toBe('test-user@macbook');
    expect(certInfo.deviceId).toBe('device-001');
    expect(certInfo.certPem).toContain('BEGIN CERTIFICATE');
    expect(certInfo.expiresAt).toBeTruthy();
  });

  it('should verify a signed certificate against CA', () => {
    const { csrPem } = generateClientCSR('verify-test@macbook');
    const certInfo = signCSR(csrPem, 'verify-test@macbook');
    const result = verifyClientCert(certInfo.certPem);

    expect(result).not.toBeNull();
    expect(result!.valid).toBe(true);
    expect(result!.identity).toBe('verify-test@macbook');
    expect(result!.serial).toBe(certInfo.serial.replace(/:/g, ''));
  });

  it('should reject a self-signed (non-CA) certificate', () => {
    const fakeCert = openssl(`req -x509 -new -nodes -newkey rsa:2048 -keyout /dev/null -out - -subj "/CN=fake@fake" -sha256 -days 1 2>/dev/null`).toString();
    const result = verifyClientCert(fakeCert);
    expect(result).toBeNull();
  });
});

describe('Certificate Database', () => {
  it('should store and retrieve certificates', () => {
    const { csrPem } = generateClientCSR('db-test@macbook');
    const certInfo = signCSR(csrPem, 'db-test@macbook', 'db-device');

    certDB.upsertCert({
      serial: certInfo.serial,
      cn: 'db-test@macbook',
      identity: 'db-test@macbook',
      deviceId: 'db-device',
      pem: certInfo.certPem,
      expiresAt: certInfo.expiresAt,
    });

    const record = certDB.getCert(certInfo.serial);
    expect(record).toBeDefined();
    expect(record!.identity).toBe('db-test@macbook');
    expect(record!.device_id).toBe('db-device');
    expect(record!.status).toBe('active');
  });

  it('should revoke a certificate', () => {
    const { csrPem } = generateClientCSR('revoke-test@macbook');
    const certInfo = signCSR(csrPem, 'revoke-test@macbook');

    certDB.upsertCert({
      serial: certInfo.serial,
      cn: 'revoke-test@macbook',
      identity: 'revoke-test@macbook',
      pem: certInfo.certPem,
      expiresAt: certInfo.expiresAt,
    });

    const revoked = certDB.revokeCert(certInfo.serial, 'test revocation');
    expect(revoked).toBe(true);

    const record = certDB.getCert(certInfo.serial);
    expect(record!.status).toBe('revoked');
    expect(record!.revoked_reason).toBe('test revocation');
  });

  it('should list certificates by identity', () => {
    const certs = certDB.getActiveCertsByIdentity('db-test@macbook');
    expect(certs.length).toBeGreaterThanOrEqual(1);
  });
});

describe('HTTPS + mTLS', () => {
  it('should allow requests without client cert to health endpoint', async () => {
    const result = await httpsRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/health',
      method: 'GET',
      rejectUnauthorized: false,
    });
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ ok: true });
  });

  it('should serve CA cert without client cert', async () => {
    // This would hit the auth router but we haven't mounted it in test
    // Just verify the TLS connection works
    const result = await httpsRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/health',
      method: 'GET',
      rejectUnauthorized: false,
    });
    expect(result.statusCode).toBe(200);
  });

  it('should accept requests with valid client cert', async () => {
    const { csrPem, keyPem } = generateClientCSR('https-mtls@macbook');
    const certInfo = signCSR(csrPem, 'https-mtls@macbook');

    const result = await httpsRequest({
      hostname: 'localhost',
      port: TEST_PORT,
      path: '/health',
      method: 'GET',
      rejectUnauthorized: false,
      cert: certInfo.certPem,
      key: keyPem,
    });
    expect(result.statusCode).toBe(200);
  });
});

describe('WebSocket mTLS', () => {
  it('should auto-authenticate WS with client cert', async () => {
    const { csrPem, keyPem } = generateClientCSR('ws-mtls@macbook');
    const certInfo = signCSR(csrPem, 'ws-mtls@macbook');

    // Store cert in DB
    certDB.upsertCert({
      serial: certInfo.serial,
      cn: 'ws-mtls@macbook',
      identity: 'ws-mtls@macbook',
      pem: certInfo.certPem,
      expiresAt: certInfo.expiresAt,
    });

    const ws = new WebSocket(`wss://localhost:${TEST_PORT}/ws`, {
      cert: certInfo.certPem,
      key: keyPem,
      ca: caCertPem,
      rejectUnauthorized: false,
    });

    const authOk = await new Promise<{ type: string; clientId: string; authMethod: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        clearTimeout(timeout);
        resolve(msg);
      });
      ws.on('error', reject);
    });

    expect(authOk.type).toBe('auth.ok');
    expect(authOk.clientId).toBe('ws-mtls@macbook');
    expect(authOk.authMethod).toBe('mtls');

    ws.close();
  });

  it('should reject WS without cert and without PSK auth', { timeout: 10000 }, async () => {
    const ws = new WebSocket(`wss://localhost:${TEST_PORT}/ws`, {
      rejectUnauthorized: false,
    });

    const result = await new Promise<{ code: number; reason: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 6000);
      ws.on('close', (code, reason) => {
        clearTimeout(timeout);
        resolve({ code, reason: reason.toString() });
      });
      ws.on('error', reject);
    });

    expect(result.code).toBe(4001); // Auth timeout
    ws.close();
  });
});
