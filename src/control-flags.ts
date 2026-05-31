export interface ParsedFlags {
  /** Bit 0: Can debit (false=yes, true=no) */
  noDebit: boolean;
  /** Bit 1: Can credit (false=yes, true=no) */
  noCredit: boolean;
  /** Bit 2: Subject to limit control (true=yes) */
  limitControlled: boolean;
  /** Bit 3: Subject to control config (true=yes) */
  configControlled: boolean;
  /** Bit 4: Account frozen (true=yes) */
  frozen: boolean;
}

export function parseFlags(flags: string): ParsedFlags {
  return {
    noDebit: flags[0] === '1',
    noCredit: flags[1] === '1',
    limitControlled: flags.length > 2 ? flags[2] === '0' : true,
    configControlled: flags.length > 3 ? flags[3] === '0' : true,
    frozen: flags.length > 4 ? flags[4] === '1' : false,
  };
}

export function canDebit(flags: string): boolean {
  return flags[0] !== '1' && (flags.length <= 4 || flags[4] !== '1');
}

export function canCredit(flags: string): boolean {
  return flags[1] !== '1' && (flags.length <= 4 || flags[4] !== '1');
}

export function isFrozen(flags: string): boolean {
  return flags.length > 4 && flags[4] === '1';
}

export function setFlag(flags: string, position: number, value: '0' | '1'): string {
  const arr = flags.padEnd(position + 1, '0').split('');
  arr[position] = value;
  return arr.join('');
}

export const DEFAULT_FLAGS = '00';
