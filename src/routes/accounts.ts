import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AccountDB } from '../db-accounts.js';
import type { LedgerEngine } from '../ledger-engine.js';
import { decrypt, encrypt } from '../crypto.js';

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

export function createAccountRouter(accountDB: AccountDB, ledger: LedgerEngine, psk: string): Router {
  const router = Router();

  // PSK auth middleware
  router.use((req: Request, res: Response, next) => {
    try {
      const { payload, timestamp, pskVersion } = req.body;
      if (pskVersion !== 1) {
        res.status(400).json({ error: 'Unsupported PSK version' });
        return;
      }
      const now = Date.now();
      if (Math.abs(now - timestamp * 1000) > REPLAY_WINDOW_MS) {
        res.status(400).json({ error: 'Timestamp out of range' });
        return;
      }
      const decrypted = decrypt(payload as string, psk) as string;
      (req as any).body = JSON.parse(decrypted);
      next();
    } catch {
      res.status(401).json({ error: 'Invalid encrypted payload' });
    }
  });

  function encryptResponse(data: unknown, res: Response): void {
    const json = JSON.stringify(data);
    const encrypted = encrypt(json, psk);
    res.json({ payload: encrypted, timestamp: Math.floor(Date.now() / 1000), pskVersion: 1 });
  }

  // POST /api/accounts/balance
  router.post('/accounts/balance', (req: Request, res: Response) => {
    const { userId } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }
    const balance = ledger.getBalance(userId);
    encryptResponse({
      accountId: balance.accountId,
      balance: balance.balance / 1000,
      availableBalance: balance.availableBalance / 1000,
      currency: balance.currency,
      controlFlags: balance.controlFlags,
      status: balance.status,
    }, res);
  });

  // POST /api/accounts/history
  router.post('/accounts/history', (req: Request, res: Response) => {
    const { userId, limit } = req.body;
    if (!userId) {
      res.status(400).json({ error: 'Missing userId' });
      return;
    }
    const history = ledger.getHistory(userId, Math.min(limit ?? 50, 100));
    encryptResponse(history.map(t => ({
      ...t,
      amount: t.amount / 1000,
    })), res);
  });

  // POST /api/accounts/transfer
  router.post('/accounts/transfer', (req: Request, res: Response) => {
    const { fromUserId, toUserId, amount, type, referenceType, referenceId, eventId, metadata, scene } = req.body;
    if (!fromUserId || !toUserId || !amount) {
      res.status(400).json({ error: 'Missing required fields: fromUserId, toUserId, amount' });
      return;
    }
    const result = ledger.recordEntry({
      eventId,
      type: type ?? 'transfer',
      fromUserId,
      toUserId,
      amount: Math.round(amount * 1000),
      referenceType,
      referenceId,
      metadata,
      scene,
    });
    encryptResponse(result, res);
  });

  // POST /api/accounts/escrow/lock
  router.post('/accounts/escrow/lock', (req: Request, res: Response) => {
    const { payerId, payeeId, amount } = req.body;
    if (!payerId || !payeeId || !amount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // Escrow: move from payer main → payer escrow
    const result = ledger.recordEntry({
      type: 'escrow_lock',
      fromUserId: payerId,
      fromAccountType: 'main',
      toUserId: payerId,
      toAccountType: 'escrow',
      amount: Math.round(amount * 1000),
      referenceType: 'escrow',
      scene: 'escrow_lock',
    });
    encryptResponse(result, res);
  });

  // POST /api/accounts/escrow/confirm
  router.post('/accounts/escrow/confirm', (req: Request, res: Response) => {
    const { payerId, payeeId, escrowAmount } = req.body;
    if (!payerId || !payeeId || !escrowAmount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // Release escrow: payer escrow → payee main (minus 15% platform fee)
    const amount = Math.round(escrowAmount * 1000);
    const feeRate = 0.15;
    const platformFee = Math.round(amount * feeRate);
    const payeeAmount = amount - platformFee;

    // Escrow → payee
    const release = ledger.recordEntry({
      type: 'escrow_release',
      fromUserId: payerId,
      fromAccountType: 'escrow',
      toUserId: payeeId,
      toAccountType: 'revenue',
      amount: payeeAmount,
      referenceType: 'escrow',
      scene: 'escrow_release',
    });

    // Platform fee: payee revenue → platform
    if (platformFee > 0 && release.success) {
      ledger.recordEntry({
        type: 'platform_fee',
        fromUserId: payeeId,
        fromAccountType: 'revenue',
        toUserId: '__system__',
        toAccountType: 'main',
        amount: platformFee,
        referenceType: 'escrow',
      });
    }

    encryptResponse(release, res);
  });

  // POST /api/accounts/escrow/dispute
  router.post('/accounts/escrow/dispute', (req: Request, res: Response) => {
    const { payerId, escrowAmount } = req.body;
    if (!payerId || !escrowAmount) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }
    // Refund: payer escrow → payer main
    const result = ledger.recordEntry({
      type: 'escrow_refund',
      fromUserId: payerId,
      fromAccountType: 'escrow',
      toUserId: payerId,
      toAccountType: 'main',
      amount: Math.round(escrowAmount * 1000),
      referenceType: 'escrow',
      scene: 'escrow_refund',
    });
    encryptResponse(result, res);
  });

  return router;
}
