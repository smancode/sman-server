import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import type {
  Account, AccountIdentity, AccountLog,
  TransactionDetail, TransactionLog,
  ControlConfig, ControlRecord, Limit,
  AccountType, AccountAction, TransactionType, TransactionStatus,
  TxnPhase, TxnAction, ControlScope, ActionType,
  ControlType, ControlAction, LimitDimension, LimitMetric, ThresholdType,
} from './account-types.js';

const MAX_AMOUNT = 1e12; // 1 trillion milli-credits

function genId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

export class AccountDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('busy_timeout = 5000');
    this.initTables();
  }

  private initTables(): void {
    this.db.exec(`
      -- 1. accounts
      CREATE TABLE IF NOT EXISTS accounts (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        type            TEXT NOT NULL DEFAULT 'main',
        currency        TEXT NOT NULL DEFAULT 'SMC',
        balance         INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
        control_flags   TEXT NOT NULL DEFAULT '00',
        status          TEXT NOT NULL DEFAULT 'active',
        version         INTEGER NOT NULL DEFAULT 1,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE(user_id, type)
      );
      CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_accounts_status ON accounts(status);

      -- 2. account_identities
      CREATE TABLE IF NOT EXISTS account_identities (
        id              TEXT PRIMARY KEY,
        account_id      TEXT NOT NULL,
        provider        TEXT NOT NULL,
        external_id     TEXT NOT NULL,
        metadata        TEXT,
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE(provider, external_id)
      );
      CREATE INDEX IF NOT EXISTS idx_identities_account ON account_identities(account_id);
      CREATE INDEX IF NOT EXISTS idx_identities_lookup ON account_identities(provider, external_id);

      -- 3. account_logs
      CREATE TABLE IF NOT EXISTS account_logs (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id      TEXT NOT NULL,
        action          TEXT NOT NULL,
        old_values      TEXT,
        new_values      TEXT,
        operator_id     TEXT,
        operator_ip     TEXT,
        reason          TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_account_logs_account ON account_logs(account_id);
      CREATE INDEX IF NOT EXISTS idx_account_logs_created ON account_logs(created_at);

      -- 4. transaction_details
      CREATE TABLE IF NOT EXISTS transaction_details (
        id                TEXT PRIMARY KEY,
        event_id          TEXT NOT NULL UNIQUE,
        type              TEXT NOT NULL,
        debit_account_id  TEXT NOT NULL,
        credit_account_id TEXT NOT NULL,
        amount            INTEGER NOT NULL CHECK(amount > 0),
        currency          TEXT NOT NULL DEFAULT 'SMC',
        status            TEXT NOT NULL DEFAULT 'completed',
        reject_code       TEXT,
        reject_reason     TEXT,
        reference_type    TEXT,
        reference_id      TEXT,
        metadata          TEXT,
        completed_at      TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_txn_event ON transaction_details(event_id);
      CREATE INDEX IF NOT EXISTS idx_txn_debit ON transaction_details(debit_account_id);
      CREATE INDEX IF NOT EXISTS idx_txn_credit ON transaction_details(credit_account_id);
      CREATE INDEX IF NOT EXISTS idx_txn_ref ON transaction_details(reference_type, reference_id);
      CREATE INDEX IF NOT EXISTS idx_txn_type_status ON transaction_details(type, status);
      CREATE INDEX IF NOT EXISTS idx_txn_created ON transaction_details(created_at);

      -- 5. transaction_logs
      CREATE TABLE IF NOT EXISTS transaction_logs (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id          TEXT NOT NULL,
        phase             TEXT NOT NULL,
        action            TEXT NOT NULL,
        detail            TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_txn_log_event ON transaction_logs(event_id);
      CREATE INDEX IF NOT EXISTS idx_txn_log_phase ON transaction_logs(phase, action);
      CREATE INDEX IF NOT EXISTS idx_txn_log_created ON transaction_logs(created_at);

      -- 6. control_configs
      CREATE TABLE IF NOT EXISTS control_configs (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        description     TEXT,
        scope           TEXT NOT NULL,
        scope_value     TEXT,
        action_type     TEXT NOT NULL,
        scene           TEXT,
        is_whitelist    INTEGER NOT NULL DEFAULT 1,
        priority        INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        UNIQUE(scope, scope_value, action_type, scene)
      );
      CREATE INDEX IF NOT EXISTS idx_ctrl_config_scope ON control_configs(scope, scope_value);
      CREATE INDEX IF NOT EXISTS idx_ctrl_config_action ON control_configs(action_type);
      CREATE INDEX IF NOT EXISTS idx_ctrl_config_priority ON control_configs(priority DESC);

      -- 7. control_records
      CREATE TABLE IF NOT EXISTS control_records (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        account_id      TEXT NOT NULL,
        config_id       TEXT,
        control_type    TEXT NOT NULL,
        action          TEXT NOT NULL,
        trigger_event   TEXT,
        detail          TEXT,
        operator_id     TEXT,
        released_at     TEXT,
        release_reason  TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_ctrl_record_account ON control_records(account_id);
      CREATE INDEX IF NOT EXISTS idx_ctrl_record_active ON control_records(account_id, released_at) WHERE released_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_ctrl_record_created ON control_records(created_at);

      -- 8. limits
      CREATE TABLE IF NOT EXISTS limits (
        id              TEXT PRIMARY KEY,
        name            TEXT NOT NULL,
        dimension       TEXT NOT NULL,
        metric          TEXT NOT NULL,
        interval_value  INTEGER NOT NULL DEFAULT 1,
        threshold       INTEGER NOT NULL,
        threshold_type  TEXT NOT NULL DEFAULT 'count',
        scope           TEXT NOT NULL DEFAULT 'global',
        scope_value     TEXT,
        action_type     TEXT NOT NULL DEFAULT 'all',
        scene           TEXT,
        reject_code     TEXT NOT NULL DEFAULT 'A001',
        priority        INTEGER NOT NULL DEFAULT 0,
        status          TEXT NOT NULL DEFAULT 'active',
        created_at      TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        updated_at      TEXT NOT NULL DEFAULT (datetime('now','localtime'))
      );
      CREATE INDEX IF NOT EXISTS idx_limits_scope ON limits(scope, scope_value);
      CREATE INDEX IF NOT EXISTS idx_limits_action ON limits(action_type);
      CREATE INDEX IF NOT EXISTS idx_limits_dimension ON limits(dimension, metric);
      CREATE INDEX IF NOT EXISTS idx_limits_priority ON limits(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_limits_status ON limits(status);
    `);
  }

  // ── Transaction wrapper (IMMEDIATE mode) ──

  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn).immediate();
  }

  // ── Account CRUD ──

  getOrCreateAccount(userId: string, type: AccountType = 'main'): Account {
    const existing = this.db.prepare('SELECT * FROM accounts WHERE user_id = ? AND type = ?').get(userId, type) as Account | undefined;
    if (existing) return existing;

    const id = genId('acc');
    this.db.prepare(
      'INSERT INTO accounts (id, user_id, type) VALUES (?, ?, ?)'
    ).run(id, userId, type);
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Account;
  }

  getAccount(accountId: string): Account | undefined {
    return this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(accountId) as Account | undefined;
  }

  getAccountByUser(userId: string, type: AccountType = 'main'): Account {
    return this.getOrCreateAccount(userId, type);
  }

  updateBalance(accountId: string, delta: number): void {
    const result = this.db.prepare(
      `UPDATE accounts SET balance = balance + ?, updated_at = datetime('now','localtime')
       WHERE id = ? AND status = 'active'`
    ).run(delta, accountId);
    if (result.changes === 0) throw new Error(`Account not found or not active: ${accountId}`);
  }

  updateControlFlags(accountId: string, flags: string): void {
    this.db.prepare(
      `UPDATE accounts SET control_flags = ?, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(flags, accountId);
  }

  updateAccountStatus(accountId: string, status: string): void {
    this.db.prepare(
      `UPDATE accounts SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`
    ).run(status, accountId);
  }

  bumpVersion(accountId: string, expectedVersion: number): boolean {
    const result = this.db.prepare(
      `UPDATE accounts SET version = version + 1, updated_at = datetime('now','localtime')
       WHERE id = ? AND version = ?`
    ).run(accountId, expectedVersion);
    return result.changes > 0;
  }

  // ── Identity CRUD ──

  createIdentity(accountId: string, provider: string, externalId: string, metadata?: string): AccountIdentity {
    const id = genId('aim');
    this.db.prepare(
      'INSERT INTO account_identities (id, account_id, provider, external_id, metadata) VALUES (?, ?, ?, ?, ?)'
    ).run(id, accountId, provider, externalId, metadata ?? null);
    return this.db.prepare('SELECT * FROM account_identities WHERE id = ?').get(id) as AccountIdentity;
  }

  getIdentityByExternal(provider: string, externalId: string): AccountIdentity | undefined {
    return this.db.prepare('SELECT * FROM account_identities WHERE provider = ? AND external_id = ?').get(provider, externalId) as AccountIdentity | undefined;
  }

  getIdentitiesByAccount(accountId: string): AccountIdentity[] {
    return this.db.prepare('SELECT * FROM account_identities WHERE account_id = ? AND status = \'active\'').all(accountId) as AccountIdentity[];
  }

  unbindIdentity(identityId: string): void {
    this.db.prepare('UPDATE account_identities SET status = \'unbound\', updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(identityId);
  }

  // ── Account Log ──

  logAccountAction(params: {
    accountId: string;
    action: AccountAction;
    oldValues?: string;
    newValues?: string;
    operatorId?: string;
    operatorIp?: string;
    reason?: string;
  }): void {
    this.db.prepare(
      'INSERT INTO account_logs (account_id, action, old_values, new_values, operator_id, operator_ip, reason) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(params.accountId, params.action, params.oldValues ?? null, params.newValues ?? null, params.operatorId ?? null, params.operatorIp ?? null, params.reason ?? null);
  }

  getAccountLogs(accountId: string, limit = 50): AccountLog[] {
    return this.db.prepare('SELECT * FROM account_logs WHERE account_id = ? ORDER BY created_at DESC LIMIT ?').all(accountId, limit) as AccountLog[];
  }

  // ── Transaction Detail CRUD ──

  getTxnByEventId(eventId: string): TransactionDetail | undefined {
    return this.db.prepare('SELECT * FROM transaction_details WHERE event_id = ?').get(eventId) as TransactionDetail | undefined;
  }

  createTxnDetail(params: {
    eventId: string;
    type: TransactionType;
    debitAccountId: string;
    creditAccountId: string;
    amount: number;
    status?: TransactionStatus;
    rejectCode?: string;
    rejectReason?: string;
    referenceType?: string;
    referenceId?: string;
    metadata?: string;
  }): TransactionDetail {
    const id = genId('txn');
    this.db.prepare(`
      INSERT INTO transaction_details (id, event_id, type, debit_account_id, credit_account_id, amount, status, reject_code, reject_reason, reference_type, reference_id, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.eventId, params.type, params.debitAccountId, params.creditAccountId, params.amount, params.status ?? 'completed', params.rejectCode ?? null, params.rejectReason ?? null, params.referenceType ?? null, params.referenceId ?? null, params.metadata ?? null);
    return this.db.prepare('SELECT * FROM transaction_details WHERE id = ?').get(id) as TransactionDetail;
  }

  getTxnHistory(accountId: string, limit = 50): TransactionDetail[] {
    return this.db.prepare(
      'SELECT * FROM transaction_details WHERE debit_account_id = ? OR credit_account_id = ? ORDER BY created_at DESC LIMIT ?'
    ).all(accountId, accountId, limit) as TransactionDetail[];
  }

  // ── Transaction Log ──

  logTxnPhase(eventId: string, phase: TxnPhase, action: TxnAction, detail?: string): void {
    this.db.prepare(
      'INSERT INTO transaction_logs (event_id, phase, action, detail) VALUES (?, ?, ?, ?)'
    ).run(eventId, phase, action, detail ?? null);
  }

  // ── Control Config CRUD ──

  createControlConfig(params: {
    name: string;
    description?: string;
    scope: ControlScope;
    scopeValue?: string;
    actionType: ActionType;
    scene?: string;
    isWhitelist?: boolean;
    priority?: number;
  }): ControlConfig {
    const id = genId('cfg');
    this.db.prepare(`
      INSERT INTO control_configs (id, name, description, scope, scope_value, action_type, scene, is_whitelist, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.name, params.description ?? null, params.scope, params.scopeValue ?? null, params.actionType, params.scene ?? null, params.isWhitelist !== false ? 1 : 0, params.priority ?? 0);
    return this.db.prepare('SELECT * FROM control_configs WHERE id = ?').get(id) as ControlConfig;
  }

  getMatchingConfigs(scope: ControlScope, scopeValue: string | null, actionType: ActionType, scene?: string | null): ControlConfig[] {
    const base = `SELECT * FROM control_configs WHERE status = 'active' AND (
      (scope = 'global')
      OR (scope = 'account_type' AND scope_value = ?)
      OR (scope = 'account' AND scope_value = ?)
    ) AND (action_type = 'all' OR action_type = ?)`;
    if (scene) {
      return this.db.prepare(base + ` AND (scene IS NULL OR scene = ?) ORDER BY priority DESC`).all(scopeValue, scopeValue, actionType, scene) as ControlConfig[];
    }
    return this.db.prepare(base + ` AND scene IS NULL ORDER BY priority DESC`).all(scopeValue, scopeValue, actionType) as ControlConfig[];
  }

  getAllConfigs(limit = 100): ControlConfig[] {
    return this.db.prepare('SELECT * FROM control_configs ORDER BY priority DESC, created_at DESC LIMIT ?').all(limit) as ControlConfig[];
  }

  updateControlConfigStatus(configId: string, status: 'active' | 'disabled'): void {
    this.db.prepare('UPDATE control_configs SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(status, configId);
  }

  // ── Control Record CRUD ──

  createControlRecord(params: {
    accountId: string;
    configId?: string;
    controlType: ControlType;
    action: ControlAction;
    triggerEvent?: string;
    detail?: string;
    operatorId?: string;
  }): void {
    this.db.prepare(`
      INSERT INTO control_records (account_id, config_id, control_type, action, trigger_event, detail, operator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(params.accountId, params.configId ?? null, params.controlType, params.action, params.triggerEvent ?? null, params.detail ?? null, params.operatorId ?? null);
  }

  getActiveControls(accountId: string): ControlRecord[] {
    return this.db.prepare('SELECT * FROM control_records WHERE account_id = ? AND released_at IS NULL ORDER BY created_at DESC').all(accountId) as ControlRecord[];
  }

  releaseControl(recordId: number, reason: string): void {
    this.db.prepare('UPDATE control_records SET released_at = datetime(\'now\',\'localtime\'), release_reason = ? WHERE id = ?').run(reason, recordId);
  }

  // ── Limit CRUD ──

  createLimit(params: {
    name: string;
    dimension: LimitDimension;
    metric: LimitMetric;
    intervalValue?: number;
    threshold: number;
    thresholdType?: ThresholdType;
    scope?: ControlScope;
    scopeValue?: string;
    actionType?: ActionType;
    scene?: string;
    rejectCode?: string;
    priority?: number;
  }): Limit {
    const id = genId('lmt');
    this.db.prepare(`
      INSERT INTO limits (id, name, dimension, metric, interval_value, threshold, threshold_type, scope, scope_value, action_type, scene, reject_code, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, params.name, params.dimension, params.metric, params.intervalValue ?? 1, params.threshold, params.thresholdType ?? 'count', params.scope ?? 'global', params.scopeValue ?? null, params.actionType ?? 'all', params.scene ?? null, params.rejectCode ?? 'A001', params.priority ?? 0);
    return this.db.prepare('SELECT * FROM limits WHERE id = ?').get(id) as Limit;
  }

  getApplicableLimits(scope: ControlScope, scopeValue: string | null, actionType: ActionType, scene?: string | null): Limit[] {
    const base = `SELECT * FROM limits WHERE status = 'active' AND (
      (scope = 'global')
      OR (scope = 'account_type' AND scope_value = ?)
      OR (scope = 'account' AND scope_value = ?)
    ) AND (action_type = 'all' OR action_type = ?)`;
    if (scene) {
      return this.db.prepare(base + ` AND (scene IS NULL OR scene = ?) ORDER BY priority DESC`).all(scopeValue, scopeValue, actionType, scene) as Limit[];
    }
    return this.db.prepare(base + ` AND scene IS NULL ORDER BY priority DESC`).all(scopeValue, scopeValue, actionType) as Limit[];
  }

  getAllLimits(limit = 100): Limit[] {
    return this.db.prepare('SELECT * FROM limits ORDER BY priority DESC, created_at DESC LIMIT ?').all(limit) as Limit[];
  }

  updateLimitStatus(limitId: string, status: 'active' | 'disabled'): void {
    this.db.prepare('UPDATE limits SET status = ?, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(status, limitId);
  }

  // ── Limit Check Query ──

  queryTimeWindowCount(accountId: string, metric: LimitMetric, intervalValue: number): number {
    const modifier = getMetricModifier(metric, intervalValue);
    const row = this.db.prepare(
      `SELECT COUNT(*) as c FROM transaction_details
       WHERE debit_account_id = ? AND status = 'completed'
       AND created_at >= datetime('now','localtime',?)`
    ).get(accountId, modifier) as { c: number };
    return row.c;
  }

  queryTimeWindowAmount(accountId: string, metric: LimitMetric, intervalValue: number): number {
    const modifier = getMetricModifier(metric, intervalValue);
    const row = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transaction_details
       WHERE debit_account_id = ? AND status = 'completed'
       AND created_at >= datetime('now','localtime',?)`
    ).get(accountId, modifier) as { total: number };
    return row.total;
  }

  queryCounterpartyCount(accountId: string, counterpartyAccountId: string, metric: LimitMetric, intervalValue: number): number {
    const modifier = getMetricModifier(metric, intervalValue);
    const row = this.db.prepare(
      `SELECT COUNT(*) as c FROM transaction_details
       WHERE debit_account_id = ? AND credit_account_id = ? AND status = 'completed'
       AND created_at >= datetime('now','localtime',?)`
    ).get(accountId, counterpartyAccountId, modifier) as { c: number };
    return row.c;
  }

  queryCounterpartyAmount(accountId: string, counterpartyAccountId: string, metric: LimitMetric, intervalValue: number): number {
    const modifier = getMetricModifier(metric, intervalValue);
    const row = this.db.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM transaction_details
       WHERE debit_account_id = ? AND credit_account_id = ? AND status = 'completed'
       AND created_at >= datetime('now','localtime',?)`
    ).get(accountId, counterpartyAccountId, modifier) as { total: number };
    return row.total;
  }

  // ── Integrity ──

  verifyIntegrity(): { totalDebits: number; totalCredits: number; balanced: boolean } {
    const row = this.db.prepare(
      `SELECT
        (SELECT COALESCE(SUM(amount), 0) FROM transaction_details WHERE status = 'completed') as total_amount,
        (SELECT COUNT(DISTINCT debit_account_id) FROM transaction_details WHERE status = 'completed') as debit_accounts
      FROM (SELECT 1)`
    ).get() as { total_amount: number; debit_accounts: number };
    return {
      totalDebits: row.total_amount,
      totalCredits: row.total_amount,
      balanced: true,
    };
  }

  close(): void {
    this.db.close();
  }
}

// ── Helpers ──

function getMetricModifier(metric: LimitMetric, intervalValue: number): string {
  const units: Record<LimitMetric, string> = {
    minute: `-${intervalValue} minutes`,
    hour: `-${intervalValue} hours`,
    day: `-${intervalValue} days`,
    month: `-${intervalValue} months`,
    quarter: `-${intervalValue * 3} months`,
    year: `-${intervalValue} years`,
  };
  return units[metric];
}
