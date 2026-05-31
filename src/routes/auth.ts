import { Router } from 'express';
import type { Request, Response } from 'express';
import type { PeerCertificate } from 'node:tls';
import { signCSR, renewCertificate, getCACertPem, generateCRL, verifyClientCert } from '../ca.js';
import type { CertDB } from '../db-certs.js';

function getPeerCertificate(req: Request): PeerCertificate | null {
  const socket = req.socket as unknown as { getPeerCertificate?: () => PeerCertificate };
  const cert = socket.getPeerCertificate?.();
  return cert && Object.keys(cert).length > 0 ? cert : null;
}

export function createAuthRouter(certDB: CertDB, adminToken: string): Router {
  const router = Router();

  // Whitelist routes — no client certificate required
  // These are accessible even without mTLS (rejectUnauthorized: false)

  /**
   * GET /api/auth/ca-cert — Get CA certificate for trust store
   * Public: no auth required
   */
  router.get('/ca-cert', (_req: Request, res: Response) => {
    try {
      const caCertPem = getCACertPem();
      res.json({ caCert: caCertPem });
    } catch (err) {
      res.status(500).json({ error: 'CA not initialized' });
    }
  });

  /**
   * POST /api/auth/certificate — Sign a CSR and issue client certificate
   *
   * Body: { csr: string, identity: string, deviceId?: string }
   * Response: { cert: string, caCert: string, serial: string, expiresAt: string }
   *
   * In public mode (AUTH_MODE=oauth): requires a valid JWT in Authorization header
   * In enterprise mode (AUTH_MODE=device): no JWT needed, network isolation = auth
   * For now (Phase 0A): no JWT verification yet, any request can get a cert
   */
  router.post('/certificate', (req: Request, res: Response) => {
    try {
      const { csr, identity, deviceId } = req.body as {
        csr?: string;
        identity?: string;
        deviceId?: string;
      };

      if (!csr || typeof csr !== 'string') {
        res.status(400).json({ error: 'Missing or invalid CSR (csr field required as PEM string)' });
        return;
      }

      if (!identity || typeof identity !== 'string') {
        res.status(400).json({ error: 'Missing identity field' });
      }

      if (!/^[\w.@\-]+$/.test(identity!)) {
        res.status(400).json({ error: 'Invalid identity format (alphanumeric, dots, @, hyphens only)' });
        return;
      }

      if (identity!.length > 128) {
        res.status(400).json({ error: 'Identity too long (max 128 chars)' });
        return;
      }

      // Validate CSR format
      if (!csr.includes('-----BEGIN CERTIFICATE REQUEST-----')) {
        res.status(400).json({ error: 'Invalid CSR format (expected PEM with BEGIN CERTIFICATE REQUEST)' });
        return;
      }

      const certInfo = signCSR(csr, identity!, deviceId);

      // Store in database
      certDB.upsertCert({
        serial: certInfo.serial,
        cn: identity!,
        identity: identity!,
        deviceId: deviceId ?? null,
        pem: certInfo.certPem,
        expiresAt: certInfo.expiresAt,
      });

      res.json({
        cert: certInfo.certPem,
        caCert: getCACertPem(),
        serial: certInfo.serial,
        expiresAt: certInfo.expiresAt,
      });
    } catch (err) {
      console.error('[Auth] Certificate signing failed:', err);
      res.status(500).json({ error: 'Certificate signing failed' });
    }
  });

  /**
   * POST /api/auth/certificate/renew — Renew an existing certificate
   *
   * Requires valid existing client certificate (mTLS) OR Authorization header with valid cert info
   * Body: { csr: string, identity: string }
   */
  router.post('/certificate/renew', (req: Request, res: Response) => {
    try {
      const peerCert = getPeerCertificate(req);

      if (!peerCert) {
        // No mTLS cert — check if there's cert info in the body for legacy renewal
        res.status(403).json({ error: 'Client certificate required for renewal' });
        return;
      }

      const { csr, identity, oldCertPem } = req.body as {
        csr?: string;
        identity?: string;
        oldCertPem?: string;
      };

      if (!csr || !identity) {
        res.status(400).json({ error: 'Missing csr or identity' });
        return;
      }

      if (!oldCertPem) {
        // Use peer certificate from mTLS
        res.status(400).json({ error: 'Missing oldCertPem' });
        return;
      }

      const certInfo = renewCertificate(oldCertPem, csr, identity);

      certDB.upsertCert({
        serial: certInfo.serial,
        cn: identity,
        identity,
        deviceId: null,
        pem: certInfo.certPem,
        expiresAt: certInfo.expiresAt,
      });

      res.json({
        cert: certInfo.certPem,
        caCert: getCACertPem(),
        serial: certInfo.serial,
        expiresAt: certInfo.expiresAt,
      });
    } catch (err) {
      console.error('[Auth] Certificate renewal failed:', err);
      res.status(500).json({ error: 'Certificate renewal failed' });
    }
  });

  /**
   * GET /api/auth/crl — Get Certificate Revocation List
   */
  router.get('/crl', (_req: Request, res: Response) => {
    try {
      const revokedSerials = certDB.getRevokedSerials();
      const crlPem = generateCRL(revokedSerials);
      res.set('Content-Type', 'application/x-pem-file');
      res.send(crlPem || '');
    } catch (err) {
      console.error('[Auth] CRL generation failed:', err);
      res.status(500).json({ error: 'CRL generation failed' });
    }
  });

  return router;
}

/**
 * Admin routes for certificate management.
 * All require Bearer token matching ADMIN_TOKEN.
 */
export function createAdminCertRouter(certDB: CertDB, adminToken: string): Router {
  const router = Router();

  function verifyAdmin(req: Request, res: Response): boolean {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${adminToken}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return false;
    }
    return true;
  }

  /** POST /admin/certificates/revoke — Revoke a certificate */
  router.post('/certificates/revoke', (req: Request, res: Response) => {
    if (!verifyAdmin(req, res)) return;

    const { serial, reason } = req.body as { serial?: string; reason?: string };
    if (!serial) {
      res.status(400).json({ error: 'Missing serial' });
      return;
    }

    const cert = certDB.getCert(serial);
    if (!cert) {
      res.status(404).json({ error: 'Certificate not found' });
      return;
    }

    const revoked = certDB.revokeCert(serial, reason);
    if (!revoked) {
      res.status(400).json({ error: 'Certificate already revoked or not active' });
      return;
    }

    res.json({ ok: true, serial, status: 'revoked' });
  });

  /** GET /admin/certificates — List all certificates */
  router.get('/certificates', (req: Request, res: Response) => {
    if (!verifyAdmin(req, res)) return;

    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    const offset = parseInt(req.query.offset as string) || 0;
    const certs = certDB.getAllCerts(limit, offset);
    const counts = certDB.getCertCountByStatus();

    res.json({
      certificates: certs,
      counts,
      limit,
      offset,
    });
  });

  /** GET /admin/certificates/stats — Certificate statistics */
  router.get('/certificates/stats', (req: Request, res: Response) => {
    if (!verifyAdmin(req, res)) return;

    res.json(certDB.getCertCountByStatus());
  });

  return router;
}
