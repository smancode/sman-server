import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../crypto.js';

const PSK = '0123456789abcdef0123456789abcdef'; // exactly 32 bytes
const WRONG_PSK = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; // exactly 32 bytes

describe('crypto', () => {
  describe('encrypt + decrypt round-trip', () => {
    it('should preserve object data through encrypt/decrypt cycle', () => {
      const original = { hello: 'world', num: 42, nested: { a: true } };
      const encrypted = encrypt(original, PSK);
      const decrypted = decrypt(encrypted, PSK);
      expect(decrypted).toEqual(original);
    });

    it('should preserve string data through encrypt/decrypt cycle', () => {
      const original = 'plain text message';
      const encrypted = encrypt(original, PSK);
      const decrypted = decrypt(encrypted, PSK);
      expect(decrypted).toBe(original);
    });

    it('should preserve array data through encrypt/decrypt cycle', () => {
      const original = [1, 'two', { three: 3 }];
      const encrypted = encrypt(original, PSK);
      const decrypted = decrypt(encrypted, PSK);
      expect(decrypted).toEqual(original);
    });
  });

  describe('random IV (non-deterministic encryption)', () => {
    it('should produce different ciphertext for the same input', () => {
      const data = { test: 'deterministic' };
      const encrypted1 = encrypt(data, PSK);
      const encrypted2 = encrypt(data, PSK);

      // Ciphertext should differ due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // Both should decrypt to the same value
      expect(decrypt(encrypted1, PSK)).toEqual(data);
      expect(decrypt(encrypted2, PSK)).toEqual(data);
    });
  });

  describe('wrong key', () => {
    it('should throw when decrypting with a wrong PSK', () => {
      const encrypted = encrypt({ secret: 'data' }, PSK);
      expect(() => decrypt(encrypted, WRONG_PSK)).toThrow();
    });
  });

  describe('corrupted data', () => {
    it('should throw when ciphertext is not valid base64', () => {
      expect(() => decrypt('not-valid-base64!!!', PSK)).toThrow();
    });

    it('should throw when encrypted blob is tampered (random bytes)', () => {
      const encrypted = encrypt({ foo: 'bar' }, PSK);
      // Flip some bytes by modifying the base64 string
      const tampered = encrypted.slice(0, -4) + 'XXXX';
      expect(() => decrypt(tampered, PSK)).toThrow();
    });
  });

  describe('empty objects', () => {
    it('should handle empty object', () => {
      const original = {};
      const encrypted = encrypt(original, PSK);
      const decrypted = decrypt(encrypted, PSK);
      expect(decrypted).toEqual(original);
    });

    it('should handle null', () => {
      const original = null;
      const encrypted = encrypt(original, PSK);
      const decrypted = decrypt(encrypted, PSK);
      expect(decrypted).toBeNull();
    });
  });
});
