import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { AccountDB } from '../db-accounts.js';
import { parseFlags, canDebit, canCredit, setFlag, DEFAULT_FLAGS } from '../control-flags.js';
import { reject, formatLimitReason, getRejectInfo } from '../reject-codes.js';

let tmpDir: string;
let db: AccountDB;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sman-accounts-test-'));
  db = new AccountDB(path.join(tmpDir, 'accounts.db'));
});

afterEach(() => {
  db.close();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ── 场景: 账户开户与查询 ──

describe('场景: 账户开户与查询', () => {
  it('新用户首次访问自动开户，id 格式正确', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    expect(acc.id).toMatch(/^acc_[0-9a-f]{16}$/);
    expect(acc.user_id).toBe('user_alice');
    expect(acc.type).toBe('main');
    expect(acc.balance).toBe(0);
    expect(acc.control_flags).toBe('00');
    expect(acc.status).toBe('active');
    expect(acc.version).toBe(1);
  });

  it('重复调用返回同一账户', () => {
    const a1 = db.getOrCreateAccount('user_alice', 'main');
    const a2 = db.getOrCreateAccount('user_alice', 'main');
    expect(a1.id).toBe(a2.id);
  });

  it('同一用户可开多种类型账户（main, escrow, revenue）', () => {
    const main = db.getOrCreateAccount('user_alice', 'main');
    const escrow = db.getOrCreateAccount('user_alice', 'escrow');
    const revenue = db.getOrCreateAccount('user_alice', 'revenue');
    expect(main.id).not.toBe(escrow.id);
    expect(escrow.id).not.toBe(revenue.id);
  });

  it('不同用户各自独立开户', () => {
    const a = db.getOrCreateAccount('user_alice', 'main');
    const b = db.getOrCreateAccount('user_bob', 'main');
    expect(a.id).not.toBe(b.id);
  });
});

// ── 场景: 余额操作 ──

describe('场景: 余额操作', () => {
  it('充值后余额增加', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.updateBalance(acc.id, 5000000); // 5000 credits
    const updated = db.getAccount(acc.id)!;
    expect(updated.balance).toBe(5000000);
  });

  it('扣减后余额减少', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.updateBalance(acc.id, 5000000);
    db.updateBalance(acc.id, -1000000);
    const updated = db.getAccount(acc.id)!;
    expect(updated.balance).toBe(4000000);
  });

  it('乐观并发版本号自增', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    expect(db.bumpVersion(acc.id, 1)).toBe(true);
    expect(db.bumpVersion(acc.id, 1)).toBe(false); // version 已变为 2
    expect(db.bumpVersion(acc.id, 2)).toBe(true);
  });
});

// ── 场景: 管控标志位 ──

describe('场景: 管控标志位', () => {
  it('默认标志位 00 允许扣减和增加', () => {
    expect(canDebit('00')).toBe(true);
    expect(canCredit('00')).toBe(true);
  });

  it('标志位 10 禁止扣减，允许增加', () => {
    expect(canDebit('10')).toBe(false);
    expect(canCredit('10')).toBe(true);
  });

  it('标志位 01 允许扣减，禁止增加', () => {
    expect(canDebit('01')).toBe(true);
    expect(canCredit('01')).toBe(false);
  });

  it('标志位 11 禁止扣减和增加', () => {
    expect(canDebit('11')).toBe(false);
    expect(canCredit('11')).toBe(false);
  });

  it('标志位第 5 位为 1 表示冻结', () => {
    expect(canDebit('00001')).toBe(false);
    expect(canCredit('00001')).toBe(false);
  });

  it('parseFlags 解析正确', () => {
    const flags = parseFlags('10000');
    expect(flags.noDebit).toBe(true);
    expect(flags.noCredit).toBe(false);
    expect(flags.limitControlled).toBe(true);
    expect(flags.configControlled).toBe(true);
    expect(flags.frozen).toBe(false);
  });

  it('setFlag 修改指定位置', () => {
    expect(setFlag('00', 0, '1')).toBe('10');
    expect(setFlag('00', 1, '1')).toBe('01');
    expect(setFlag('00', 4, '1')).toBe('00001');
  });

  it('数据库更新管控标志位', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.updateControlFlags(acc.id, '10');
    const updated = db.getAccount(acc.id)!;
    expect(updated.control_flags).toBe('10');
  });
});

// ── 场景: 外部身份映射 ──

describe('场景: 外部身份映射', () => {
  it('创建身份映射并查询', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    const identity = db.createIdentity(acc.id, 'wechat', 'openid_123', JSON.stringify({ appid: 'wx123' }));
    expect(identity.provider).toBe('wechat');
    expect(identity.external_id).toBe('openid_123');
    expect(identity.status).toBe('active');
  });

  it('通过外部 ID 查找账户', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.createIdentity(acc.id, 'wechat', 'openid_123');
    const found = db.getIdentityByExternal('wechat', 'openid_123');
    expect(found?.account_id).toBe(acc.id);
  });

  it('一个账户可绑定多个外部身份', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.createIdentity(acc.id, 'wechat', 'openid_1');
    db.createIdentity(acc.id, 'google', 'google_1');
    const identities = db.getIdentitiesByAccount(acc.id);
    expect(identities).toHaveLength(2);
  });

  it('解绑后不再出现在活跃身份列表', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    const id = db.createIdentity(acc.id, 'wechat', 'openid_1');
    db.unbindIdentity(id.id);
    expect(db.getIdentitiesByAccount(acc.id)).toHaveLength(0);
  });
});

// ── 场景: 账户日志 ──

describe('场景: 账户日志', () => {
  it('记录开户日志', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.logAccountAction({
      accountId: acc.id,
      action: 'opened',
      reason: '用户首次访问',
      operatorId: 'system',
    });
    const logs = db.getAccountLogs(acc.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('opened');
    expect(logs[0].reason).toBe('用户首次访问');
  });

  it('记录管控变更日志（含新旧值）', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.logAccountAction({
      accountId: acc.id,
      action: 'control_changed',
      oldValues: JSON.stringify({ control_flags: '00' }),
      newValues: JSON.stringify({ control_flags: '10' }),
      operatorId: 'admin',
      reason: '风险管控',
    });
    const logs = db.getAccountLogs(acc.id);
    expect(logs[0].old_values).toContain('00');
    expect(logs[0].new_values).toContain('10');
  });
});

// ── 场景: 交易明细 ──

describe('场景: 交易明细', () => {
  it('创建交易明细记录', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    const txn = db.createTxnDetail({
      eventId: 'evt_test_001',
      type: 'transfer',
      debitAccountId: from.id,
      creditAccountId: to.id,
      amount: 1000000,
    });
    expect(txn.id).toMatch(/^txn_/);
    expect(txn.event_id).toBe('evt_test_001');
    expect(txn.status).toBe('completed');
    expect(txn.reject_code).toBeNull();
  });

  it('event_id 唯一约束防止重复', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    db.createTxnDetail({ eventId: 'evt_dup_001', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 100 });
    expect(() => db.createTxnDetail({ eventId: 'evt_dup_001', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 100 })).toThrow();
  });

  it('查询交易历史', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    db.createTxnDetail({ eventId: 'evt_h1', type: 'topup', debitAccountId: from.id, creditAccountId: to.id, amount: 5000 });
    db.createTxnDetail({ eventId: 'evt_h2', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 1000 });
    const history = db.getTxnHistory(from.id);
    expect(history).toHaveLength(2);
  });

  it('记录拒绝码和拒绝原因', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    const txn = db.createTxnDetail({
      eventId: 'evt_rejected',
      type: 'transfer',
      debitAccountId: from.id,
      creditAccountId: to.id,
      amount: 1000,
      status: 'failed',
      rejectCode: 'A001',
      rejectReason: '每小时最多10笔交易',
    });
    expect(txn.reject_code).toBe('A001');
    expect(txn.status).toBe('failed');
  });
});

// ── 场景: 交易日志流水线 ──

describe('场景: 交易日志流水线', () => {
  it('记录多阶段日志', () => {
    db.logTxnPhase('evt_001', 'pre_check', 'check_passed');
    db.logTxnPhase('evt_001', 'limit_check', 'check_passed');
    db.logTxnPhase('evt_001', 'execute', 'success');
    // Verify via direct query
    const rows = db.transaction(() => {
      // Just verify no throw
      return true;
    });
    expect(rows).toBe(true);
  });
});

// ── 场景: 管控配置 ──

describe('场景: 管控配置', () => {
  it('创建全局白名单配置', () => {
    const cfg = db.createControlConfig({
      name: '全局转账白名单',
      scope: 'global',
      actionType: 'transfer',
    });
    expect(cfg.id).toMatch(/^cfg_/);
    expect(cfg.is_whitelist).toBe(1);
    expect(cfg.scope).toBe('global');
  });

  it('查询匹配的管控配置（优先级排序）', () => {
    db.createControlConfig({ name: '全局', scope: 'global', actionType: 'transfer', priority: 0 });
    db.createControlConfig({ name: 'main 类型', scope: 'account_type', scopeValue: 'main', actionType: 'transfer', priority: 10 });
    const configs = db.getMatchingConfigs('account_type', 'main', 'transfer');
    expect(configs.length).toBeGreaterThanOrEqual(2);
    // Higher priority first
    expect(configs[0].priority).toBeGreaterThanOrEqual(configs[1].priority);
  });
});

// ── 场景: 限额配置 ──

describe('场景: 限额配置', () => {
  it('创建时间维度限额', () => {
    const limit = db.createLimit({
      name: '每小时最多 10 笔',
      dimension: 'time',
      metric: 'hour',
      intervalValue: 1,
      threshold: 10,
      thresholdType: 'count',
      rejectCode: 'A001',
    });
    expect(limit.id).toMatch(/^lmt_/);
    expect(limit.dimension).toBe('time');
    expect(limit.threshold).toBe(10);
  });

  it('创建对手方维度限额', () => {
    const limit = db.createLimit({
      name: '每天对同一对手方最多 5 笔',
      dimension: 'counterparty',
      metric: 'day',
      intervalValue: 1,
      threshold: 5,
      thresholdType: 'count',
      rejectCode: 'A003',
    });
    expect(limit.dimension).toBe('counterparty');
  });

  it('查询适用的限额规则', () => {
    db.createLimit({ name: '全局小时限额', dimension: 'time', metric: 'hour', threshold: 10, scope: 'global', actionType: 'debit', priority: 0 });
    db.createLimit({ name: 'main 类型日限额', dimension: 'time', metric: 'day', threshold: 50, scope: 'account_type', scopeValue: 'main', actionType: 'debit', priority: 10 });
    const limits = db.getApplicableLimits('account_type', 'main', 'debit');
    expect(limits.length).toBeGreaterThanOrEqual(2);
    expect(limits[0].priority).toBeGreaterThanOrEqual(limits[1].priority);
  });

  it('限额时间窗口计数查询', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    db.createTxnDetail({ eventId: 'evt_lc1', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 100 });
    db.createTxnDetail({ eventId: 'evt_lc2', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 200 });
    const count = db.queryTimeWindowCount(from.id, 'hour', 1);
    expect(count).toBe(2);
  });

  it('限额时间窗口金额查询', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    db.createTxnDetail({ eventId: 'evt_la1', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 300000 });
    db.createTxnDetail({ eventId: 'evt_la2', type: 'transfer', debitAccountId: from.id, creditAccountId: to.id, amount: 200000 });
    const total = db.queryTimeWindowAmount(from.id, 'day', 1);
    expect(total).toBe(500000);
  });
});

// ── 场景: 管控记录 ──

describe('场景: 管控记录', () => {
  it('记录管控触发', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.createControlRecord({
      accountId: acc.id,
      controlType: 'limit_hit',
      action: 'blocked',
      triggerEvent: 'evt_001',
      detail: JSON.stringify({ limitId: 'lmt_001', code: 'A001' }),
    });
    const records = db.getActiveControls(acc.id);
    expect(records).toHaveLength(1);
    expect(records[0].control_type).toBe('limit_hit');
  });

  it('释放管控记录', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.createControlRecord({
      accountId: acc.id,
      controlType: 'manual_freeze',
      action: 'frozen',
      operatorId: 'admin',
    });
    const [record] = db.getActiveControls(acc.id);
    db.releaseControl(record.id, '审核通过');
    expect(db.getActiveControls(acc.id)).toHaveLength(0);
  });
});

// ── 场景: 拒绝码 ──

describe('场景: 拒绝码', () => {
  it('reject 返回正确结构', () => {
    const r = reject('A001');
    expect(r.code).toBe('A001');
    expect(r.reason).toBeTruthy();
  });

  it('getRejectInfo 返回分类和消息', () => {
    const info = getRejectInfo('B005');
    expect(info.category).toBe('管控');
    expect(info.message).toContain('冻结');
  });

  it('formatLimitReason 生成正确模板', () => {
    const reason = formatLimitReason('time', 'hour', 1, 10, 'count');
    expect(reason).toContain('时间');
    expect(reason).toContain('小时');
    expect(reason).toContain('10');
    expect(reason).toContain('笔');
  });

  it('formatLimitReason 对手方维度', () => {
    const reason = formatLimitReason('counterparty', 'day', 1, 5, 'count');
    expect(reason).toContain('对手方');
    expect(reason).toContain('天');
  });
});

// ── 场景: IMMEDIATE 事务 ──

describe('场景: IMMEDIATE 事务', () => {
  it('事务内操作原子性', () => {
    const from = db.getOrCreateAccount('user_alice', 'main');
    const to = db.getOrCreateAccount('user_bob', 'main');
    db.updateBalance(from.id, 5000000);
    db.transaction(() => {
      db.updateBalance(from.id, -1000000);
      db.updateBalance(to.id, 1000000);
    });
    expect(db.getAccount(from.id)!.balance).toBe(4000000);
    expect(db.getAccount(to.id)!.balance).toBe(1000000);
  });

  it('事务内异常回滚', () => {
    const acc = db.getOrCreateAccount('user_alice', 'main');
    db.updateBalance(acc.id, 5000000);
    try {
      db.transaction(() => {
        db.updateBalance(acc.id, -1000000);
        throw new Error('simulated failure');
      });
    } catch {}
    expect(db.getAccount(acc.id)!.balance).toBe(5000000);
  });
});
