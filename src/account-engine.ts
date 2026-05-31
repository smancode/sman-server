import type { AccountDB } from './db-accounts.js';
import type { Account, AccountAction } from './account-types.js';
import { setFlag } from './control-flags.js';

export class AccountEngine {
  private db: AccountDB;

  constructor(db: AccountDB) {
    this.db = db;
  }

  /** Open a new account for a user. Logs the action. */
  open(userId: string, type: import('./account-types.js').AccountType = 'main', operatorId?: string): Account {
    const acc = this.db.getOrCreateAccount(userId, type);
    this.db.logAccountAction({
      accountId: acc.id,
      action: 'opened',
      operatorId,
      reason: `开户: ${userId} ${type}`,
    });
    return acc;
  }

  /** Freeze an account. Sets control flag bit 4 and status. */
  freeze(accountId: string, reason: string, operatorId?: string): Account {
    const acc = this.db.getAccount(accountId);
    if (!acc) throw new Error(`Account not found: ${accountId}`);
    if (acc.status === 'closed') throw new Error('Cannot freeze a closed account');

    const oldFlags = acc.control_flags;
    const newFlags = setFlag(oldFlags, 4, '1');

    this.db.transaction(() => {
      this.db.updateControlFlags(accountId, newFlags);
      this.db.updateAccountStatus(accountId, 'frozen');
      this.db.logAccountAction({
        accountId,
        action: 'frozen',
        oldValues: JSON.stringify({ control_flags: oldFlags, status: acc.status }),
        newValues: JSON.stringify({ control_flags: newFlags, status: 'frozen' }),
        operatorId,
        reason,
      });
    });

    return this.db.getAccount(accountId)!;
  }

  /** Unfreeze an account. Clears control flag bit 4 and restores active status. */
  unfreeze(accountId: string, reason: string, operatorId?: string): Account {
    const acc = this.db.getAccount(accountId);
    if (!acc) throw new Error(`Account not found: ${accountId}`);

    const oldFlags = acc.control_flags;
    const newFlags = setFlag(oldFlags, 4, '0');

    this.db.transaction(() => {
      this.db.updateControlFlags(accountId, newFlags);
      this.db.updateAccountStatus(accountId, 'active');
      this.db.logAccountAction({
        accountId,
        action: 'unfrozen',
        oldValues: JSON.stringify({ control_flags: oldFlags, status: acc.status }),
        newValues: JSON.stringify({ control_flags: newFlags, status: 'active' }),
        operatorId,
        reason,
      });
    });

    return this.db.getAccount(accountId)!;
  }

  /** Close an account. Cannot be reversed. */
  close(accountId: string, reason: string, operatorId?: string): Account {
    const acc = this.db.getAccount(accountId);
    if (!acc) throw new Error(`Account not found: ${accountId}`);
    if (acc.balance > 0) throw new Error(`Cannot close account with positive balance: ${acc.balance}`);

    this.db.transaction(() => {
      this.db.updateAccountStatus(accountId, 'closed');
      this.db.logAccountAction({
        accountId,
        action: 'closed',
        oldValues: JSON.stringify({ status: acc.status }),
        newValues: JSON.stringify({ status: 'closed' }),
        operatorId,
        reason,
      });
    });

    return this.db.getAccount(accountId)!;
  }

  /** Update control flags on an account. */
  updateControlFlags(accountId: string, newFlags: string, reason: string, operatorId?: string): Account {
    const acc = this.db.getAccount(accountId);
    if (!acc) throw new Error(`Account not found: ${accountId}`);

    this.db.transaction(() => {
      this.db.updateControlFlags(accountId, newFlags);
      this.db.logAccountAction({
        accountId,
        action: 'control_changed',
        oldValues: JSON.stringify({ control_flags: acc.control_flags }),
        newValues: JSON.stringify({ control_flags: newFlags }),
        operatorId,
        reason,
      });
    });

    return this.db.getAccount(accountId)!;
  }
}
