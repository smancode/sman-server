import { Router } from 'express';
import type { Request, Response } from 'express';
import type { HubDB } from '../db.js';
import { decrypt } from '../crypto.js';
import type { ReportPayload, EncryptedRequest } from '../types.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

// IP-based rate limiter for feedback endpoint
const feedbackRateLimit = new Map<string, number>();
const FEEDBACK_RATE_LIMIT_MS = 30_000;
// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, ts] of feedbackRateLimit) {
    if (now - ts > FEEDBACK_RATE_LIMIT_MS * 2) feedbackRateLimit.delete(ip);
  }
}, 5 * 60 * 1000);

export function createReportRouter(db: HubDB, psk: string, getSkillCommands?: (clientId: string) => string[]): Router {
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
        username: data.username || data.clientId.split('@')[0],
        hostname: data.hostname,
        ip: data.ip,
        activeSessions: data.activeSessions,
      });

      db.insertReport({
        clientId: data.clientId,
        reportTime: data.reportTime,
        activeSessions: data.activeSessions,
      });

      // Store workspaces
      if (data.workspaces && Array.isArray(data.workspaces)) {
        db.replaceWorkspaces(data.clientId, data.workspaces);
      }

      // Check if server has skill-auto-updater commands for this client
      const commands = getSkillCommands ? getSkillCommands(data.clientId) : [];

      res.json({ ok: true, serverTime: new Date().toISOString(), commands });
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

  router.post('/feedback', (req: Request, res: Response) => {
    // IP rate limit: same IP can only submit once per 30 seconds
    const ip = req.ip || req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 'unknown';
    const now = Date.now();
    const lastTime = feedbackRateLimit.get(ip);
    if (lastTime && now - lastTime < FEEDBACK_RATE_LIMIT_MS) {
      res.status(429).json({ error: 'Too many requests, please try again later' });
      return;
    }
    feedbackRateLimit.set(ip, now);

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

      if (!data.message || typeof data.message !== 'string' || data.message.trim().length === 0) {
        res.status(400).json({ error: 'message is required' });
        return;
      }

      db.insertFeedback({
        clientId: data.clientId as string | undefined,
        message: (data.message as string).trim(),
        workspace: data.workspace as string | undefined,
        llmModel: data.llmModel as string | undefined,
        llmBaseUrl: data.llmBaseUrl as string | undefined,
        osInfo: data.osInfo as string | undefined,
      });

      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Achievement leaderboard: upload score
  router.post('/achievement-report', (req: Request, res: Response) => {
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

      if (!data.agentId || !data.agentName || typeof data.totalPoints !== 'number') {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      db.upsertAchievementEntry({
        agentId: data.agentId as string,
        agentName: data.agentName as string,
        totalPoints: data.totalPoints as number,
        totalUnlocked: (data.totalUnlocked as number) || 0,
        level: (data.level as string) || 'bronze',
        tierCounts: (data.tierCounts as string) || '{}',
        dimensionScores: (data.dimensionScores as string) || '{}',
      });

      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Achievement leaderboard: get rankings (public, no auth needed)
  router.get('/achievement-leaderboard', (req: Request, res: Response) => {
    try {
      const dimension = req.query.dimension as string | undefined;
      let entries;
      if (dimension && dimension !== 'total') {
        entries = db.getLeaderboardByDimension(dimension, 100);
      } else {
        entries = db.getLeaderboard(100);
      }
      res.json({ entries, dimension: dimension || 'total' });
    } catch {
      res.status(500).json({ error: 'Failed to load leaderboard' });
    }
  });

  return router;
}
