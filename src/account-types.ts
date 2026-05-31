// ── Account Types ──

export type AccountType = 'main' | 'escrow' | 'revenue';
export type AccountStatus = 'active' | 'frozen' | 'closed';
export type IdentityProvider = 'wechat' | 'wecom' | 'feishu' | 'google' | 'internal';
export type IdentityStatus = 'active' | 'unbound';
export type AccountAction = 'opened' | 'modified' | 'closed' | 'frozen' | 'unfrozen' | 'control_changed';

export interface Account {
  id: string;
  user_id: string;
  type: AccountType;
  currency: string;
  balance: number;
  control_flags: string;
  status: AccountStatus;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface AccountIdentity {
  id: string;
  account_id: string;
  provider: IdentityProvider;
  external_id: string;
  metadata: string | null;
  status: IdentityStatus;
  created_at: string;
  updated_at: string;
}

export interface AccountLog {
  id: number;
  account_id: string;
  action: AccountAction;
  old_values: string | null;
  new_values: string | null;
  operator_id: string | null;
  operator_ip: string | null;
  reason: string | null;
  created_at: string;
}

// ── Transaction Types ──

export type TransactionType =
  | 'topup' | 'grant' | 'transfer'
  | 'escrow_lock' | 'escrow_release' | 'escrow_refund'
  | 'platform_fee' | 'work_purchase' | 'work_usage'
  | 'referral_bonus' | 'reversal';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'reversed';
export type TxnPhase = 'pre_check' | 'limit_check' | 'control_check' | 'balance_check' | 'execute' | 'post_check';
export type TxnAction = 'check_passed' | 'check_failed' | 'limit_hit' | 'control_blocked' | 'success' | 'fail';

export interface TransactionDetail {
  id: string;
  event_id: string;
  type: TransactionType;
  debit_account_id: string;
  credit_account_id: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  reject_code: string | null;
  reject_reason: string | null;
  reference_type: string | null;
  reference_id: string | null;
  metadata: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface TransactionLog {
  id: number;
  event_id: string;
  phase: TxnPhase;
  action: TxnAction;
  detail: string | null;
  created_at: string;
}

// ── Control Types ──

export type ControlScope = 'global' | 'account_type' | 'account';
export type ActionType = 'debit' | 'credit' | 'transfer' | 'escrow_lock' | 'all';
export type ControlType = 'limit_hit' | 'control_blocked' | 'manual_freeze' | 'compliance' | 'risk';
export type ControlAction = 'blocked' | 'frozen' | 'restricted' | 'warned';

export interface ControlConfig {
  id: string;
  name: string;
  description: string | null;
  scope: ControlScope;
  scope_value: string | null;
  action_type: ActionType;
  scene: string | null;
  is_whitelist: number; // SQLite INTEGER: 1=whitelist, 0=blacklist
  priority: number;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

export interface ControlRecord {
  id: number;
  account_id: string;
  config_id: string | null;
  control_type: ControlType;
  action: ControlAction;
  trigger_event: string | null;
  detail: string | null;
  operator_id: string | null;
  released_at: string | null;
  release_reason: string | null;
  created_at: string;
}

// ── Limit Types ──

export type LimitDimension = 'time' | 'counterparty';
export type LimitMetric = 'minute' | 'hour' | 'day' | 'month' | 'quarter' | 'year';
export type ThresholdType = 'count' | 'amount';

export interface Limit {
  id: string;
  name: string;
  dimension: LimitDimension;
  metric: LimitMetric;
  interval_value: number;
  threshold: number;
  threshold_type: ThresholdType;
  scope: ControlScope;
  scope_value: string | null;
  action_type: ActionType;
  scene: string | null;
  reject_code: string;
  priority: number;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
}

// ── Reject Result ──

export interface RejectResult {
  code: string;
  reason: string;
  detail?: {
    limitId?: string;
    currentCount?: number;
    currentAmount?: number;
    threshold?: number;
  };
}

// ── API Types ──

export interface AccountBalance {
  accountId: string;
  userId: string;
  balance: number;
  availableBalance: number;
  currency: string;
  controlFlags: string;
  status: AccountStatus;
}

export interface TransferRequest {
  fromUserId: string;
  toUserId: string;
  amount: number;
  type: TransactionType;
  referenceType?: string;
  referenceId?: string;
  eventId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferResult {
  success: boolean;
  transaction?: TransactionDetail;
  reject?: RejectResult;
}
