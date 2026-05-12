import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HubDB } from '../db.js';
import { decrypt } from '../crypto.js';
import type { ReportPayload, EncryptedRequest } from '../types.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export function createReportRouter(db: HubDB, psk: string): Router {
  const router = Router();

  router.post('/report', (req: Request, res: Response) => {
    try {
      const { payload, timestamp, pskVersion } = req.body as EncryptedRequest;

      if (pskVersion !== 1) {
        res.status(400).json({ error: 'Unsupported PSK version' });
        return;
      }

      const now = Date.now();
      if (Math.abs(now - timestamp * 1000) > REPLAY_WINDOW_MS) {
        res.status(400).json({ error: 'Timestamp out of range' });
        return;
      }

      const data = decrypt(payload, psk) as ReportPayload;

      db.upsertClient({
        clientId: data.clientId,
        version: data.version,
        hostname: data.hostname,
        ip: data.ip,
        activeSessions: data.activeSessions,
      });

      db.insertReport({
        clientId: data.clientId,
        reportTime: data.reportTime,
        activeSessions: data.activeSessions,
      });

      res.json({ ok: true, serverTime: new Date().toISOString() });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  router.post('/error-report', (req: Request, res: Response) => {
    try {
      const { payload, timestamp, pskVersion } = req.body as EncryptedRequest;

      if (pskVersion !== 1) {
        res.status(400).json({ error: 'Unsupported PSK version' });
        return;
      }

      const now = Date.now();
      if (Math.abs(now - timestamp * 1000) > REPLAY_WINDOW_MS) {
        res.status(400).json({ error: 'Timestamp out of range' });
        return;
      }

      const data = decrypt(payload, psk) as Record<string, unknown>;

      db.insertErrorReport({
        clientId: data.clientId as string | undefined,
        sessionId: data.sessionId as string | undefined,
        errorCode: data.errorCode as string | undefined,
        errorMessage: data.errorMessage as string | undefined,
        rawError: data.rawError as string | undefined,
        workspace: data.workspace as string | undefined,
        lastUserMessage: data.lastUserMessage as string | undefined,
        llmModel: data.llmModel as string | undefined,
        llmBaseUrl: data.llmBaseUrl as string | undefined,
        osInfo: data.osInfo as string | undefined,
      });

      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  return router;
}
