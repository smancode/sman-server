import crypto from 'node:crypto';
import type { AccountDB } from './db-accounts.js';
import type { Account, TransactionDetail, RejectResult, TransferRequest, TransferResult, TransactionType, TxnPhase } from './account-types.js';
import { canDebit, canCredit, isFrozen, parseFlags } from './control-flags.js';
import { reject } from './reject-codes.js';
import { CircuitBreaker } from './circuit-breaker.js';
import { LimitEngine } from './limit-engine.js';
import { ControlEngine } from './control-engine.js';

const MAX_AMOUNT = 1e12;
const SYSTEM_USER = '__system__';

export class LedgerEngine {
  private db: AccountDB;
  private circuitBreaker: CircuitBreaker;
  private limitEngine: LimitEngine;
  private controlEngine: ControlEngine;

  constructor(db: AccountDB) {
    this.db = db;
    this.circuitBreaker = new CircuitBreaker();
    this.limitEngine = new LimitEngine(db);
    this.controlEngine = new ControlEngine(db);
  }

  /**
   * Core transfer pipeline:
   * [0] Circuit breaker → [1] Validate → [2] Idempotency
   * → [3] Control flags → [4] Control config → [5] Limit check
   * → [6] Balance check → [7] Execute double-entry → [8] Record
   */
  recordEntry(params: {
    eventId?: string;
    type: TransactionType;
    fromUserId: string;
    fromAccountType?: string;
    toUserId: string;
    toAccountType?: string;
    amount: number;
    referenceType?: string;
    referenceId?: string;
    metadata?: Record<string, unknown>;
    scene?: string;
  }): TransferResult {
    // [0] Circuit breaker
    const blocked = this.circuitBreaker.canExecute();
    if (blocked) {
      this.db.logTxnPhase(params.eventId ?? 'unknown', 'pre_check', 'check_failed', JSON.stringify(blocked));
      return { success: false, reject: blocked };
    }

    // [1] Validate
    if (params.amount <= 0) {
      const r = reject('D003', 'Amount must be positive');
      return { success: false, reject: r };
    }
    if (params.amount > MAX_AMOUNT) {
      const r = reject('D003', `Amount exceeds maximum: ${MAX_AMOUNT}`);
      return { success: false, reject: r };
    }

    const eventId = params.eventId ?? `evt_${crypto.randomBytes(12).toString('hex')}`;
    const isSystemSource = params.fromUserId === SYSTEM_USER;

    return this.executeInTransaction(eventId, params, isSystemSource);
  }

  private executeInTransaction(
    eventId: string,
    params: Parameters<typeof this.recordEntry>[0],
    isSystemSource: boolean,
  ): TransferResult {
    try {
      return this.db.transaction(() => {
        // [2] Idempotency
        const existing = this.db.getTxnByEventId(eventId);
        if (existing) {
          this.db.logTxnPhase(eventId, 'pre_check', 'check_failed', JSON.stringify({ code: 'D001', reason: 'Duplicate event_id' }));
          return { success: true, transaction: existing };
        }

        // Get accounts
        const fromAccount = this.db.getOrCreateAccount(params.fromUserId, (params.fromAccountType ?? 'main') as 'main' | 'escrow' | 'revenue');
        const toAccount = this.db.getOrCreateAccount(params.toUserId, (params.toAccountType ?? 'main') as 'main' | 'escrow' | 'revenue');

        // Self-transfer check
        if (fromAccount.id === toAccount.id) {
          const r = reject('D004');
          this.db.logTxnPhase(eventId, 'pre_check', 'check_failed', JSON.stringify(r));
          return { success: false, reject: r };
        }

        // [3] Control flag check
        const flagResult = this.checkControlFlags(fromAccount, toAccount, isSystemSource, eventId);
        if (flagResult) return flagResult;

        // [4] Control config check
        const flags = parseFlags(fromAccount.control_flags);
        if (flags.configControlled && !isSystemSource) {
          const ctrlResult = this.controlEngine.check(fromAccount, this.mapActionType(params.type), params.scene);
          if (ctrlResult) {
            this.db.logTxnPhase(eventId, 'control_check', 'control_blocked', JSON.stringify(ctrlResult));
            return { success: false, reject: ctrlResult };
          }
        }

        // [5] Limit check
        if (flags.limitControlled && !isSystemSource) {
          const limitResult = this.limitEngine.check(
            fromAccount,
            this.mapActionType(params.type),
            toAccount.id,
            params.scene,
          );
          if (limitResult) {
            this.db.logTxnPhase(eventId, 'limit_check', 'limit_hit', JSON.stringify(limitResult));
            // Also create a control record
            this.db.createControlRecord({
              accountId: fromAccount.id,
              controlType: 'limit_hit',
              action: 'blocked',
              triggerEvent: eventId,
              detail: JSON.stringify(limitResult),
            });
            return { success: false, reject: limitResult };
          }
        }

        // [6] Balance check (inside transaction for atomicity)
        if (!isSystemSource && params.fromAccountType !== 'escrow') {
          const freshFrom = this.db.getAccount(fromAccount.id);
          if (!freshFrom || freshFrom.balance < params.amount) {
            const r = reject('C001', `可用余额不足: ${(freshFrom?.balance ?? 0) / 1000}, 需要 ${params.amount / 1000}`);
            this.db.logTxnPhase(eventId, 'balance_check', 'check_failed', JSON.stringify(r));
            return { success: false, reject: r };
          }
        }

        // [7] Execute double-entry
        if (!isSystemSource) {
          this.db.updateBalance(fromAccount.id, -params.amount);
          const afterDebit = this.db.getAccount(fromAccount.id);
          if (afterDebit && afterDebit.balance < 0) {
            throw new Error('Balance would go negative — aborted');
          }
        }
        this.db.updateBalance(toAccount.id, params.amount);

        // [8] Record transaction
        const txn = this.db.createTxnDetail({
          eventId,
          type: params.type,
          debitAccountId: fromAccount.id,
          creditAccountId: toAccount.id,
          amount: params.amount,
          referenceType: params.referenceType,
          referenceId: params.referenceId,
          metadata: params.metadata ? JSON.stringify({
            ...params.metadata,
            _audit: {
              timestamp: new Date().toISOString(),
            },
          }) : undefined,
        });

        this.db.logTxnPhase(eventId, 'execute', 'success');
        this.circuitBreaker.recordSuccess();
        return { success: true, transaction: txn };
      });
    } catch (err) {
      this.circuitBreaker.recordFailure();
      this.db.logTxnPhase(eventId, 'execute', 'fail', JSON.stringify({ error: String(err) }));
      return { success: false, reject: reject('E001', String(err)) };
    }
  }

  private checkControlFlags(
    fromAccount: Account,
    toAccount: Account,
    isSystemSource: boolean,
    eventId: string,
  ): TransferResult | null {
    // From account checks
    if (!isSystemSource) {
      if (isFrozen(fromAccount.control_flags)) {
        const r = reject('B005', '账户已冻结');
        this.db.logTxnPhase(eventId, 'control_check', 'check_failed', JSON.stringify(r));
        return { success: false, reject: r };
      }
      if (!canDebit(fromAccount.control_flags)) {
        const r = reject('B001', '账户禁止扣减');
        this.db.logTxnPhase(eventId, 'control_check', 'check_failed', JSON.stringify(r));
        return { success: false, reject: r };
      }
    }

    // To account checks
    if (isFrozen(toAccount.control_flags)) {
      const r = reject('B005', '目标账户已冻结');
      this.db.logTxnPhase(eventId, 'control_check', 'check_failed', JSON.stringify(r));
      return { success: false, reject: r };
    }
    if (!canCredit(toAccount.control_flags)) {
      const r = reject('B002', '目标账户禁止增加');
      this.db.logTxnPhase(eventId, 'control_check', 'check_failed', JSON.stringify(r));
      return { success: false, reject: r };
    }

    return null;
  }

  private mapActionType(type: TransactionType): import('./account-types.js').ActionType {
    switch (type) {
      case 'topup': case 'grant': return 'credit';
      case 'transfer': case 'work_usage': case 'work_purchase': return 'transfer';
      case 'escrow_lock': return 'escrow_lock';
      default: return 'debit';
    }
  }

  // ── Convenience Methods ──

  topup(userId: string, amount: number, source: string, referenceId?: string): TransferResult {
    return this.recordEntry({
      type: 'topup',
      fromUserId: SYSTEM_USER,
      toUserId: userId,
      amount,
      referenceType: source,
      referenceId,
      metadata: { source },
    });
  }

  grant(userId: string, amount: number, reason: string): TransferResult {
    return this.recordEntry({
      type: 'grant',
      fromUserId: SYSTEM_USER,
      toUserId: userId,
      amount,
      referenceType: 'grant',
      metadata: { reason },
    });
  }

  transfer(fromUserId: string, toUserId: string, amount: number, type: TransactionType = 'transfer'): TransferResult {
    return this.recordEntry({ type, fromUserId, toUserId, amount });
  }

  getBalance(userId: string): import('./account-types.js').AccountBalance {
    const main = this.db.getOrCreateAccount(userId, 'main');
    return {
      accountId: main.id,
      userId,
      balance: main.balance,
      availableBalance: main.balance,
      currency: main.currency,
      controlFlags: main.control_flags,
      status: main.status,
    };
  }

  getHistory(userId: string, limit = 50): TransactionDetail[] {
    const acc = this.db.getAccountByUser(userId);
    return this.db.getTxnHistory(acc.id, limit);
  }

  getCircuitState(): import('./circuit-breaker.js').CircuitState {
    return this.circuitBreaker.getState();
  }
}
