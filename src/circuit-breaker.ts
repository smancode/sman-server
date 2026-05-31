import type { RejectResult } from './account-types.js';
import { reject } from './reject-codes.js';

export type CircuitState = 'closed' | 'open' | 'half_open';

const DEFAULT_CONFIG = {
  failureThreshold: 5,
  successThreshold: 3,
  timeout: 30000,
};

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private readonly cfg = DEFAULT_CONFIG;

  canExecute(): RejectResult | null {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.cfg.timeout) {
        this.state = 'half_open';
        this.successCount = 0;
      } else {
        return reject('E002');
      }
    }
    return null;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half_open') {
      this.successCount++;
      if (this.successCount >= this.cfg.successThreshold) {
        this.state = 'closed';
        this.successCount = 0;
      }
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === 'half_open' || this.failureCount >= this.cfg.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
  }
}
