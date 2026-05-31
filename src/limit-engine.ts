import type { AccountDB } from './db-accounts.js';
import type { Account, RejectResult, ActionType, Limit, LimitMetric, ThresholdType, LimitDimension } from './account-types.js';
import { formatLimitReason } from './reject-codes.js';

export class LimitEngine {
  private db: AccountDB;

  constructor(db: AccountDB) {
    this.db = db;
  }

  check(
    account: Account,
    actionType: ActionType,
    counterpartyAccountId?: string,
    scene?: string | null,
  ): RejectResult | null {
    const limits = this.db.getApplicableLimits('account_type', account.type, actionType, scene);
    if (limits.length === 0) return null;

    for (const limit of limits) {
      if (limit.dimension === 'time') {
        const result = this.checkTimeLimit(account, limit);
        if (result) return result;
      } else if (limit.dimension === 'counterparty' && counterpartyAccountId) {
        const result = this.checkCounterpartyLimit(account, counterpartyAccountId, limit);
        if (result) return result;
      }
    }
    return null;
  }

  private checkTimeLimit(account: Account, limit: Limit): RejectResult | null {
    const current = limit.threshold_type === 'count'
      ? this.db.queryTimeWindowCount(account.id, limit.metric as LimitMetric, limit.interval_value)
      : this.db.queryTimeWindowAmount(account.id, limit.metric as LimitMetric, limit.interval_value);

    if (current >= limit.threshold) {
      return {
        code: limit.reject_code,
        reason: formatLimitReason(
          limit.dimension as LimitDimension,
          limit.metric as LimitMetric,
          limit.interval_value,
          limit.threshold,
          limit.threshold_type as ThresholdType,
        ),
        detail: {
          limitId: limit.id,
          currentCount: limit.threshold_type === 'count' ? current : undefined,
          currentAmount: limit.threshold_type === 'amount' ? current : undefined,
          threshold: limit.threshold,
        },
      };
    }
    return null;
  }

  private checkCounterpartyLimit(account: Account, counterpartyId: string, limit: Limit): RejectResult | null {
    const current = limit.threshold_type === 'count'
      ? this.db.queryCounterpartyCount(account.id, counterpartyId, limit.metric as LimitMetric, limit.interval_value)
      : this.db.queryCounterpartyAmount(account.id, counterpartyId, limit.metric as LimitMetric, limit.interval_value);

    if (current >= limit.threshold) {
      return {
        code: limit.reject_code,
        reason: formatLimitReason(
          limit.dimension as LimitDimension,
          limit.metric as LimitMetric,
          limit.interval_value,
          limit.threshold,
          limit.threshold_type as ThresholdType,
        ),
        detail: {
          limitId: limit.id,
          currentCount: limit.threshold_type === 'count' ? current : undefined,
          currentAmount: limit.threshold_type === 'amount' ? current : undefined,
          threshold: limit.threshold,
        },
      };
    }
    return null;
  }
}
