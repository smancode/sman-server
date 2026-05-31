import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AccountDB } from '../db-accounts.js';
import type { LedgerEngine } from '../ledger-engine.js';
import type { AccountEngine } from '../account-engine.js';

export function createAdminAccountRouter(
  accountDB: AccountDB,
  ledger: LedgerEngine,
  accountEngine: AccountEngine,
  adminToken: string,
): Router {
  const router = Router();

  // Bearer token auth
  router.use((req: Request, res: Response, next) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ') || auth.slice(7) !== adminToken) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    next();
  });

  // GET /admin/accounts
  router.get('/accounts', (_req: Request, res: Response) => {
    // List all accounts — simplified for admin
    const accounts = accountDB.transaction(() => {
      // Direct query would be better but this works for now
      return { message: 'Use /admin/accounts/:userId for specific accounts' };
    });
    res.json(accounts);
  });

  // GET /admin/accounts/:userId
  router.get('/accounts/:userId', (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const balance = ledger.getBalance(userId);
    res.json({
      ...balance,
      balance: balance.balance / 1000,
      availableBalance: balance.availableBalance / 1000,
    });
  });

  // GET /admin/accounts/:userId/logs
  router.get('/accounts/:userId/logs', (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const acc = accountDB.getAccountByUser(userId);
    const logs = accountDB.getAccountLogs(acc.id, 100);
    res.json(logs);
  });

  // PUT /admin/accounts/:userId/control
  router.put('/accounts/:userId/control', (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const { flags, reason } = req.body;
    if (!flags || !reason) {
      res.status(400).json({ error: 'Missing flags or reason' });
      return;
    }
    const acc = accountDB.getAccountByUser(userId);
    const updated = accountEngine.updateControlFlags(acc.id, flags, reason, 'admin');
    res.json({ accountId: updated.id, controlFlags: updated.control_flags });
  });

  // POST /admin/accounts/:userId/freeze
  router.post('/accounts/:userId/freeze', (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ error: 'Missing reason' });
      return;
    }
    const acc = accountDB.getAccountByUser(userId);
    const frozen = accountEngine.freeze(acc.id, reason, 'admin');
    res.json({ accountId: frozen.id, status: frozen.status });
  });

  // POST /admin/accounts/:userId/unfreeze
  router.post('/accounts/:userId/unfreeze', (req: Request, res: Response) => {
    const userId = req.params.userId as string;
    const { reason } = req.body;
    if (!reason) {
      res.status(400).json({ error: 'Missing reason' });
      return;
    }
    const acc = accountDB.getAccountByUser(userId);
    const unfrozen = accountEngine.unfreeze(acc.id, reason, 'admin');
    res.json({ accountId: unfrozen.id, status: unfrozen.status });
  });

  // POST /admin/accounts/grant
  router.post('/accounts/grant', (req: Request, res: Response) => {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || !reason) {
      res.status(400).json({ error: 'Missing userId, amount, or reason' });
      return;
    }
    const result = ledger.grant(userId, Math.round(amount * 1000), reason);
    res.json(result);
  });

  // ── Limit Management ──

  // GET /admin/limits
  router.get('/limits', (_req: Request, res: Response) => {
    res.json(accountDB.getAllLimits());
  });

  // POST /admin/limits
  router.post('/limits', (req: Request, res: Response) => {
    const limit = accountDB.createLimit(req.body);
    res.json(limit);
  });

  // PUT /admin/limits/:id/status
  router.put('/limits/:id/status', (req: Request, res: Response) => {
    const { status } = req.body;
    if (!status || !['active', 'disabled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    accountDB.updateLimitStatus(req.params.id as string, status);
    res.json({ id: req.params.id, status });
  });

  // ── Control Config Management ──

  // GET /admin/control-configs
  router.get('/control-configs', (_req: Request, res: Response) => {
    res.json(accountDB.getAllConfigs());
  });

  // POST /admin/control-configs
  router.post('/control-configs', (req: Request, res: Response) => {
    const config = accountDB.createControlConfig(req.body);
    res.json(config);
  });

  // PUT /admin/control-configs/:id/status
  router.put('/control-configs/:id/status', (req: Request, res: Response) => {
    const { status } = req.body;
    if (!status || !['active', 'disabled'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    accountDB.updateControlConfigStatus(req.params.id as string, status);
    res.json({ id: req.params.id, status });
  });

  return router;
}
