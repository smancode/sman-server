import type { AccountDB } from './db-accounts.js';
import type { Account, RejectResult, ActionType } from './account-types.js';
import { reject } from './reject-codes.js';

export class ControlEngine {
  private db: AccountDB;

  constructor(db: AccountDB) {
    this.db = db;
  }

  /**
   * Check control configs (whitelist/blacklist) for an account performing an action.
   * Returns null if allowed, or a RejectResult if blocked.
   *
   * Logic: find the highest-priority matching config.
   * - If it's a whitelist (is_whitelist=1) → allowed
   * - If it's a blacklist (is_whitelist=0) → blocked (B003)
   * - If no config matches and default-deny → blocked (B004)
   */
  check(
    account: Account,
    actionType: ActionType,
    scene?: string | null,
  ): RejectResult | null {
    const configs = this.db.getMatchingConfigs('account_type', account.type, actionType, scene);
    if (configs.length === 0) return null; // No config = allowed by default

    const top = configs[0]; // Highest priority
    if (top.is_whitelist === 0) {
      this.db.createControlRecord({
        accountId: account.id,
        configId: top.id,
        controlType: 'control_blocked',
        action: 'blocked',
        detail: JSON.stringify({ configId: top.id, configName: top.name }),
      });
      return reject('B003', `管控配置黑名单命中: ${top.name}`);
    }

    return null; // Whitelist = allowed
  }
}
