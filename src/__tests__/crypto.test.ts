import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto.js';

const PSK = '0123456789abcdef0123456789abcdef';

describe('crypto', () => {
  it('should encrypt then decrypt to original', () => {
    const data = { hello: 'world', num: 42 };
    const encrypted = encrypt(data, PSK);
    const decrypted = decrypt(encrypted, PSK);
    expect(decrypted).toEqual(data);
  });

  it('should produce different ciphertext each time (random IV)', () => {
    const data = { same: 'data' };
    const a = encrypt(data, PSK);
    const b = encrypt(data, PSK);
    expect(a).not.toBe(b);
  });

  it('should fail to decrypt with wrong key', () => {
    const data = { secret: 'test' };
    const encrypted = encrypt(data, PSK);
    expect(() => decrypt(encrypted, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).toThrow();
  });

  it('should fail to decrypt corrupted data', () => {
    expect(() => decrypt('not-valid-base64!!!', PSK)).toThrow();
  });

  it('should handle empty objects', () => {
    const data = {};
    const encrypted = encrypt(data, PSK);
    const decrypted = decrypt(encrypted, PSK);
    expect(decrypted).toEqual(data);
  });
});
