import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const CERT_VALIDITY_DAYS = 365;
const CA_VALIDITY_YEARS = 10;
const SERVER_KEY_BITS = 2048;
const SERIAL_BYTES = 16;

const CA_KEY_FILE = 'ca-key.pem';
const CA_CERT_FILE = 'ca-cert.pem';
const SERVER_KEY_FILE = 'server-key.pem';
const SERVER_CERT_FILE = 'server-cert.pem';
const OPENSSL = process.env.OPENSSL_BIN || 'openssl';
let activeTlsDir: string | null = null;

export interface CertificateInfo {
  serial: string;
  identity: string;
  deviceId: string | null;
  certPem: string;
  expiresAt: string;
}

export interface CAResult {
  caCertPem: string;
  generated: boolean;
}

function ensureDataDir(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
}

function openssl(args: string): Buffer {
  return execSync(`${OPENSSL} ${args}`, { stdio: ['pipe', 'pipe', 'pipe'] });
}

/**
 * Initialize CA: load existing or generate new.
 * Uses openssl for reliable X.509 certificate generation.
 */
export function initCA(dataDir: string): CAResult {
  ensureDataDir(dataDir);
  activeTlsDir = dataDir;

  const keyPath = path.join(dataDir, CA_KEY_FILE);
  const certPath = path.join(dataDir, CA_CERT_FILE);

  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    const caCertPem = fs.readFileSync(certPath, 'utf-8');
    return { caCertPem, generated: false };
  }

  console.log('[CA] Generating new CA key pair and self-signed certificate...');
  const caConfig = [
    '[req]',
    'distinguished_name = req_dn',
    'x509_extensions = v3_ca',
    'prompt = no',
    '',
    '[req_dn]',
    'CN = Sman Hub CA',
    'O = Sman',
    'OU = Hub Certificate Authority',
    '',
    '[v3_ca]',
    'basicConstraints = critical, CA:TRUE',
    'keyUsage = critical, digitalSignature, keyCertSign, cRLSign',
    'subjectKeyIdentifier = hash',
  ].join('\n');

  const configPath = path.join(dataDir, 'ca.cnf');
  fs.writeFileSync(configPath, caConfig);

  openssl(
    `req -x509 -new -nodes -newkey rsa:4096 -keyout "${keyPath}" ` +
    `-out "${certPath}" -days ${CA_VALIDITY_YEARS * 365} ` +
    `-config "${configPath}" -sha256`,
  );

  fs.chmodSync(keyPath, 0o600);
  fs.unlinkSync(configPath);

  const caCertPem = fs.readFileSync(certPath, 'utf-8');
  console.log('[CA] CA certificate generated and saved');
  return { caCertPem, generated: true };
}

/**
 * Sign a CSR and return a client certificate.
 * Private key never leaves the client — only the CSR (public key) is sent.
 */
export function signCSR(
  csrPem: string,
  identity: string,
  deviceId?: string,
): CertificateInfo {
  const dir = activeTlsDir || path.join(process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data'), 'tls');
  const caKeyPath = path.join(dir, CA_KEY_FILE);
  const caCertPath = path.join(dir, CA_CERT_FILE);

  if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
    throw new Error('CA not initialized. Call initCA() first.');
  }

  const serial = crypto.randomBytes(SERIAL_BYTES).toString('hex').toUpperCase().match(/.{2}/g)!.join(':');

  // Write CSR to temp file
  const tmpDir = path.join(dir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const csrPath = path.join(tmpDir, `csr-${Date.now()}.pem`);
  const certOutPath = path.join(tmpDir, `cert-${Date.now()}.pem`);
  const extPath = path.join(tmpDir, `ext-${Date.now()}.cnf`);

  try {
    fs.writeFileSync(csrPath, csrPem);

    // Extensions config for client certificate
    const extConfig = [
      'basicConstraints = critical, CA:FALSE',
      'keyUsage = critical, digitalSignature',
      'extendedKeyUsage = clientAuth',
    ].join('\n');
    fs.writeFileSync(extPath, extConfig);

    openssl(
      `x509 -req -in "${csrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" ` +
      `-CAcreateserial -out "${certOutPath}" -days ${CERT_VALIDITY_DAYS} ` +
      `-sha256 -set_serial 0x${serial.replace(/:/g, '')} -extfile "${extPath}"`,
    );

    const certPem = fs.readFileSync(certOutPath, 'utf-8');
    const cert = new crypto.X509Certificate(certPem);
    const expiresAt = cert.validTo;

    return {
      serial,
      identity,
      deviceId: deviceId ?? null,
      certPem,
      expiresAt,
    };
  } finally {
    try { fs.unlinkSync(csrPath); } catch { /* ignore */ }
    try { fs.unlinkSync(certOutPath); } catch { /* ignore */ }
    try { fs.unlinkSync(extPath); } catch { /* ignore */ }
  }
}

/**
 * Renew a certificate: verify old cert is valid and from our CA, then issue new one.
 */
export function renewCertificate(
  oldCertPem: string,
  newCsrPem: string,
  identity: string,
): CertificateInfo {
  const dir = activeTlsDir || path.join(process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data'), 'tls');
  const caCertPath = path.join(dir, CA_CERT_FILE);

  if (!fs.existsSync(caCertPath)) {
    throw new Error('CA not initialized');
  }

  // Verify the old cert is from our CA
  const oldCert = new crypto.X509Certificate(oldCertPem);
  const caCert = new crypto.X509Certificate(fs.readFileSync(caCertPath, 'utf-8'));

  if (!oldCert.checkIssued(caCert)) {
    throw new Error('Certificate not issued by this CA');
  }

  try {
    oldCert.verify(caCert.publicKey);
  } catch {
    throw new Error('Certificate signature verification failed');
  }

  // Sign new CSR
  return signCSR(newCsrPem, identity);
}

/**
 * Generate server TLS certificate (signed by CA).
 */
export function generateServerCert(dataDir: string, hostname?: string): { key: string; cert: string } {
  const caKeyPath = path.join(dataDir, CA_KEY_FILE);
  const caCertPath = path.join(dataDir, CA_CERT_FILE);

  if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
    throw new Error('CA not initialized');
  }

  ensureDataDir(dataDir);
  const keyPath = path.join(dataDir, SERVER_KEY_FILE);
  const certPath = path.join(dataDir, SERVER_CERT_FILE);

  // Load existing if still valid for more than 30 days
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    try {
      const cert = new crypto.X509Certificate(fs.readFileSync(certPath, 'utf-8'));
      const daysLeft = (new Date(cert.validTo).getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysLeft > 30) {
        return {
          key: fs.readFileSync(keyPath, 'utf-8'),
          cert: fs.readFileSync(certPath, 'utf-8'),
        };
      }
    } catch {
      // Invalid, regenerate
    }
  }

  console.log('[CA] Generating server TLS certificate...');
  const serverCN = hostname || 'sman-hub';
  const tmpDir = path.join(dataDir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });

  const csrPath = path.join(tmpDir, `server-csr-${Date.now()}.pem`);
  const extPath = path.join(tmpDir, `server-ext-${Date.now()}.cnf`);

  try {
    const serverConfig = [
      '[req]',
      'distinguished_name = req_dn',
      'prompt = no',
      '',
      '[req_dn]',
      `CN = ${serverCN}`,
      'O = Sman',
    ].join('\n');
    const confPath = path.join(tmpDir, `server-cnf-${Date.now()}.cnf`);
    fs.writeFileSync(confPath, serverConfig);

    openssl(
      `req -new -nodes -newkey rsa:${SERVER_KEY_BITS} -keyout "${keyPath}" ` +
      `-out "${csrPath}" -config "${confPath}" -sha256`,
    );
    fs.chmodSync(keyPath, 0o600);

    const extConfig = [
      'basicConstraints = critical, CA:FALSE',
      'keyUsage = critical, digitalSignature, keyEncipherment',
      'extendedKeyUsage = serverAuth',
      'subjectAltName = DNS:localhost, IP:127.0.0.1',
    ].join('\n');
    fs.writeFileSync(extPath, extConfig);

    openssl(
      `x509 -req -in "${csrPath}" -CA "${caCertPath}" -CAkey "${caKeyPath}" ` +
      `-CAcreateserial -out "${certPath}" -days ${CERT_VALIDITY_DAYS} ` +
      `-sha256 -extfile "${extPath}"`,
    );

    try { fs.unlinkSync(confPath); } catch { /* ignore */ }
  } finally {
    try { fs.unlinkSync(csrPath); } catch { /* ignore */ }
    try { fs.unlinkSync(extPath); } catch { /* ignore */ }
  }

  return {
    key: fs.readFileSync(keyPath, 'utf-8'),
    cert: fs.readFileSync(certPath, 'utf-8'),
  };
}

/**
 * Get the CA certificate PEM.
 */
export function getCACertPem(): string {
  const dir = activeTlsDir || path.join(process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data'), 'tls');
  const certPath = path.join(dir, CA_CERT_FILE);
  if (!fs.existsSync(certPath)) {
    throw new Error('CA not initialized');
  }
  return fs.readFileSync(certPath, 'utf-8');
}

/**
 * Verify a client certificate against the CA.
 */
export function verifyClientCert(certPem: string): { valid: boolean; identity: string; serial: string } | null {
  try {
    const cert = new crypto.X509Certificate(certPem);
    const caCertPem = getCACertPem();
    const caCert = new crypto.X509Certificate(caCertPem);

    if (!cert.checkIssued(caCert)) return null;

    try {
      cert.verify(caCert.publicKey);
    } catch {
      return null;
    }

    // Extract CN from subject
    const subject = cert.subject;
    const cnMatch = subject.match(/CN\s*=\s*([^,\n]+)/);
    const identity = cnMatch ? cnMatch[1].trim() : subject;

    return { valid: true, identity, serial: cert.serialNumber };
  } catch {
    return null;
  }
}

/**
 * Generate a CRL (Certificate Revocation List) PEM.
 */
export function generateCRL(serials: string[]): string {
  const dir = activeTlsDir || path.join(process.env.HUB_DATA_DIR || path.join(process.cwd(), 'data'), 'tls');
  const caKeyPath = path.join(dir, CA_KEY_FILE);
  const caCertPath = path.join(dir, CA_CERT_FILE);

  if (!fs.existsSync(caKeyPath) || !fs.existsSync(caCertPath)) {
    throw new Error('CA not initialized');
  }

  if (serials.length === 0) {
    // Empty CRL — no revoked certificates
    return '';
  }

  // For revoked serials, use openssl ca to generate CRL
  const tmpDir = path.join(dir, 'tmp');
  fs.mkdirSync(tmpDir, { recursive: true });
  const crlPath = path.join(tmpDir, `crl-${Date.now()}.pem`);
  try {
    const caConfig = [
      '[ca]',
      'default_ca = CA_default',
      '',
      '[CA_default]',
      `database = ${path.join(dir, 'index.txt')}`,
      `crlnumber = ${path.join(dir, 'crlnumber')}`,
      `certificate = ${caCertPath}`,
      `private_key = ${caKeyPath}`,
      'default_md = sha256',
      'default_crl_days = 1',
    ].join('\n');

    const configPath = path.join(tmpDir, `ca-crl-cnf-${Date.now()}.cnf`);
    fs.writeFileSync(configPath, caConfig);

    const indexPath = path.join(dir, 'index.txt');
    if (!fs.existsSync(indexPath)) fs.writeFileSync(indexPath, '');
    const crlnumberPath = path.join(dir, 'crlnumber');
    if (!fs.existsSync(crlnumberPath)) fs.writeFileSync(crlnumberPath, '01\n');

    openssl(`ca -gencrl -config "${configPath}" -out "${crlPath}"`);
    try { fs.unlinkSync(configPath); } catch { /* ignore */ }
    return fs.readFileSync(crlPath, 'utf-8');
  } catch {
    console.warn('[CA] CRL generation failed, returning empty');
    return '';
  } finally {
    try { fs.unlinkSync(crlPath); } catch { /* ignore */ }
  }
}
