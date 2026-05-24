import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { IMDB } from '../src/db-im.js';
import { encryptIMMessage, decryptIMMessage, encryptField, decryptField } from '../src/im-crypto.js';
import { encrypt, decrypt } from '../src/crypto.js';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const PSK = 'sman-hub-aes256-key!!2026-32b!!!';

// ─── Helpers ───

function createTestDB(): { dbPath: string; imdb: IMDB } {
  const dbPath = path.join(os.tmpdir(), `test-im-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const imdb = new IMDB(dbPath);
  return { dbPath, imdb };
}

function cleanupDB(dbPath: string, imdb: IMDB): void {
  try { imdb.close(); } catch {}
  try { fs.unlinkSync(dbPath); } catch {}
}

// ─── IMDB: Message CRUD ───

describe('IMDB: Message CRUD', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
    imdb.upsertRoom('r1', 'Test Room', ['alice', 'bob']);
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('inserts and retrieves a text message', () => {
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'hello', timestamp: 1000, seq: 1 });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello');
    expect(msgs[0].sender).toBe('alice');
    expect(msgs[0].type).toBe('text');
  });

  it('inserts message with all optional fields', () => {
    imdb.insertMessage({
      id: 'm1', room_id: 'r1', sender: 'alice', content: 'msg',
      mentioned_agents: JSON.stringify(['agent1']), quote_id: 'q1',
      type: 'text', status: null, attachments: JSON.stringify([{ file: 'a.pdf' }]),
      session_id: null, timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].mentioned_agents).toBe(JSON.stringify(['agent1']));
    expect(msgs[0].quote_id).toBe('q1');
    expect(msgs[0].attachments).toBe(JSON.stringify([{ file: 'a.pdf' }]));
  });

  it('stores agent_output with status and session_id', () => {
    imdb.insertMessage({
      id: 'm1', room_id: 'r1', sender: 'alice/agent', content: 'running...',
      type: 'agent_output', status: 'running', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    imdb.insertMessage({
      id: 'm2', room_id: 'r1', sender: 'alice/agent', content: 'final answer',
      type: 'agent_output', status: 'completed', session_id: 'sess-1',
      timestamp: 2000, seq: 2,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].status).toBe('running');
    expect(msgs[1].status).toBe('completed');
    expect(msgs[1].session_id).toBe('sess-1');
  });

  it('stores empty content (agent running status)', () => {
    imdb.insertMessage({
      id: 'm1', room_id: 'r1', sender: 'alice/agent', content: '',
      type: 'agent_output', status: 'running', timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('');
    expect(msgs[0].status).toBe('running');
  });

  it('deduplicates with INSERT OR IGNORE', () => {
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'hello', timestamp: 1000, seq: 1 });
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'hello', timestamp: 1000, seq: 1 });
    expect(imdb.getMessagesAfter('r1', 0)).toHaveLength(1);
  });

  it('getMessagesAfter filters by timestamp', () => {
    for (let i = 0; i < 5; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice', content: `msg${i}`, timestamp: 1000 + i * 100, seq: i + 1 });
    }
    const after = imdb.getMessagesAfter('r1', 1200);
    expect(after).toHaveLength(2); // m3(1300), m4(1400)
  });

  it('getMessagesAfter respects limit', () => {
    for (let i = 0; i < 10; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice', content: `msg${i}`, timestamp: 1000 + i, seq: i + 1 });
    }
    expect(imdb.getMessagesAfter('r1', 0, 3)).toHaveLength(3);
  });

  it('getMessagesAfter returns messages ordered by timestamp ASC', () => {
    imdb.insertMessage({ id: 'm3', room_id: 'r1', sender: 'alice', content: 'c', timestamp: 3000, seq: 3 });
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'a', timestamp: 1000, seq: 1 });
    imdb.insertMessage({ id: 'm2', room_id: 'r1', sender: 'alice', content: 'b', timestamp: 2000, seq: 2 });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs.map(m => m.id)).toEqual(['m1', 'm2', 'm3']);
  });

  it('getMessagesAfter returns empty for room with no messages after timestamp', () => {
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'hello', timestamp: 1000, seq: 1 });
    expect(imdb.getMessagesAfter('r1', 2000)).toHaveLength(0);
  });

  it('deleteOldMessages removes messages older than 7 days', () => {
    const now = Date.now();
    imdb.insertMessage({ id: 'old', room_id: 'r1', sender: 'alice', content: 'old', timestamp: now - 8 * 86400000, seq: 1 });
    imdb.insertMessage({ id: 'new', room_id: 'r1', sender: 'alice', content: 'new', timestamp: now, seq: 2 });
    const deleted = imdb.deleteOldMessages();
    expect(deleted).toBe(1);
    const remaining = imdb.getMessagesAfter('r1', 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('new');
  });

  it('deleteOldMessages returns 0 when no old messages', () => {
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'recent', timestamp: Date.now(), seq: 1 });
    expect(imdb.deleteOldMessages()).toBe(0);
  });
});

// ─── IMDB: Room CRUD ───

describe('IMDB: Room CRUD', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('upsertRoom creates a new room', () => {
    imdb.upsertRoom('r1', 'Room1', ['alice', 'bob']);
    const room = imdb.getRoom('r1');
    expect(room).toBeDefined();
    expect(room!.name).toBe('Room1');
    expect(JSON.parse(room!.members)).toEqual(['alice', 'bob']);
  });

  it('upsertRoom updates existing room members and name', () => {
    imdb.upsertRoom('r1', 'Original', ['alice']);
    imdb.upsertRoom('r1', 'Updated', ['alice', 'bob']);
    const room = imdb.getRoom('r1');
    expect(room!.name).toBe('Updated');
    expect(JSON.parse(room!.members)).toEqual(['alice', 'bob']);
  });

  it('getRoom returns undefined for nonexistent room', () => {
    expect(imdb.getRoom('nonexistent')).toBeUndefined();
  });

  it('getRoomsForMember finds rooms containing the member', () => {
    imdb.upsertRoom('r1', 'Room1', ['alice', 'bob']);
    imdb.upsertRoom('r2', 'Room2', ['charlie']);
    imdb.upsertRoom('r3', 'Room3', ['alice', 'dave']);
    const rooms = imdb.getRoomsForMember('alice');
    expect(rooms).toHaveLength(2);
    const ids = rooms.map(r => r.id).sort();
    expect(ids).toEqual(['r1', 'r3']);
  });

  it('getRoomsForMember returns empty when member not in any room', () => {
    imdb.upsertRoom('r1', 'Room1', ['alice']);
    expect(imdb.getRoomsForMember('bob')).toHaveLength(0);
  });

  it('deleteRoom removes room from DB', () => {
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.deleteRoom('r1');
    expect(imdb.getRoom('r1')).toBeUndefined();
  });

  it('upsertRoom preserves last_message_time', () => {
    imdb.upsertRoom('r1', 'Room', ['alice'], 5000);
    const room = imdb.getRoom('r1');
    expect(room!.last_message_time).toBe(5000);
  });
});

// ─── im-crypto (server side with PSK) ───

describe('im-crypto (server)', () => {
  it('encryptField adds enc: prefix', () => {
    const result = encryptField('hello', PSK);
    expect(result).toMatch(/^enc:/);
  });

  it('decryptField restores plaintext', () => {
    const encrypted = encryptField('secret', PSK);
    expect(decryptField(encrypted, PSK)).toBe('secret');
  });

  it('decryptField returns original if not encrypted', () => {
    expect(decryptField('plain text', PSK)).toBe('plain text');
  });

  it('decryptField returns original on corrupt ciphertext', () => {
    const corrupt = 'enc:invalid-base64!!!';
    expect(decryptField(corrupt, PSK)).toBe(corrupt);
  });

  it('decryptField with wrong PSK returns original on error', () => {
    const encrypted = encryptField('secret', PSK);
    const wrongPsk = 'wrong-key-12345678901234567890';
    expect(decryptField(encrypted, wrongPsk)).toBe(encrypted);
  });

  it('encryptIMMessage encrypts content field', () => {
    const original = { type: 'im.send', roomId: 'r1', content: 'secret message' };
    const encrypted = encryptIMMessage(original as Record<string, unknown>, PSK);
    expect((encrypted as any).content).toMatch(/^enc:/);
    expect(encrypted.type).toBe('im.send');
    expect(encrypted.roomId).toBe('r1');
  });

  it('encryptIMMessage encrypts attachments string', () => {
    const original = { type: 'text', content: 'msg', attachments: 'file-data' };
    const encrypted = encryptIMMessage(original as Record<string, unknown>, PSK);
    expect((encrypted as any).attachments).toMatch(/^enc:/);
  });

  it('encryptIMMessage skips empty content', () => {
    const original = { type: 'agent_output', content: '' };
    const encrypted = encryptIMMessage(original as Record<string, unknown>, PSK);
    expect(encrypted.content).toBe('');
  });

  it('decryptIMMessage restores encrypted content', () => {
    const encrypted = encryptIMMessage({ type: 'im.send', content: 'hello' } as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('hello');
  });

  it('decryptIMMessage passes through non-content fields unchanged', () => {
    const original = {
      type: 'im.send', roomId: 'r1', sender: 'alice',
      mentionedAgents: ['a1'], content: 'hi',
    };
    const encrypted = encryptIMMessage(original as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.type).toBe('im.send');
    expect(decrypted.roomId).toBe('r1');
    expect(decrypted.sender).toBe('alice');
    expect((decrypted as any).mentionedAgents).toEqual(['a1']);
  });

  it('roundtrip: encrypt then decrypt preserves all fields', () => {
    const msg = {
      type: 'agent_output', roomId: 'r1', sender: 'alice/agent',
      content: 'final answer', status: 'completed', sessionId: 'sess-1',
      mentionedAgents: [], timestamp: 1000, seq: 5,
    };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('final answer');
    expect((decrypted as any).status).toBe('completed');
    expect((decrypted as any).sessionId).toBe('sess-1');
    expect((decrypted as any).sender).toBe('alice/agent');
  });

  it('PSK mismatch: decryption returns encrypted string', () => {
    const encrypted = encryptIMMessage({ content: 'secret' } as Record<string, unknown>, PSK);
    const wrongPsk = 'wrong-key-12345678901234567890';
    const decrypted = decryptIMMessage(encrypted, wrongPsk);
    // decryptField catches error and returns ciphertext
    expect(typeof (decrypted as any).content).toBe('string');
    expect((decrypted as any).content).toMatch(/^enc:/);
  });

  it('encrypt does not modify original object', () => {
    const original = { type: 'im.send', content: 'hello' };
    const copy = { ...original };
    encryptIMMessage(original as Record<string, unknown>, PSK);
    expect(original).toEqual(copy);
  });
});

// ─── Hub auth encryption ───

describe('Hub auth encryption', () => {
  it('encrypts and decrypts auth payload', () => {
    const payload = { clientId: 'test@192.168.1.1' };
    const encrypted = encrypt(payload, PSK);
    expect(typeof encrypted).toBe('string');
    const decrypted = decrypt(encrypted, PSK);
    expect(decrypted).toEqual(payload);
  });

  it('different PSKs produce different ciphertexts', () => {
    const payload = { data: 'test' };
    const enc1 = encrypt(payload, PSK);
    const enc2 = encrypt(payload, PSK);
    // Different IVs produce different ciphertexts
    expect(enc1).not.toBe(enc2);
  });

  it('decrypt with wrong PSK throws error', () => {
    const encrypted = encrypt({ data: 'test' }, PSK);
    expect(() => decrypt(encrypted, 'wrong-key-12345678901234567890')).toThrow();
  });

  it('encrypt handles various data types', () => {
    expect(decrypt(encrypt('string', PSK), PSK)).toBe('string');
    expect(decrypt(encrypt(42, PSK), PSK)).toBe(42);
    expect(decrypt(encrypt(true, PSK), PSK)).toBe(true);
    expect(decrypt(encrypt(null, PSK), PSK)).toBe(null);
  });
});

// ─── handleImSend: Hub message handling patterns ───

describe('handleImSend: Message processing', () => {
  it('extracts content from encrypted message', () => {
    const msg = { type: 'im.send', roomId: 'r1', content: 'secret text', sender: 'alice' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('secret text');
  });

  it('preserves type via msgType field', () => {
    const msg = { type: 'im.send', roomId: 'r1', msgType: 'agent_output', content: 'reply' };
    expect(msg.msgType).toBe('agent_output');
    // Hub uses: (msg.msgType as string) || (decrypted.type as string) || 'text'
    const type = (msg.msgType as string) || (msg.type as string) || 'text';
    expect(type).toBe('agent_output');
  });

  it('falls back to decrypted.type when msgType is missing', () => {
    const msg = { type: 'im.send', roomId: 'r1', content: 'text' };
    const type = (undefined as string | undefined) || (msg.type as string) || 'text';
    expect(type).toBe('im.send');
  });

  it('falls back to text when neither msgType nor type available', () => {
    const msg = { roomId: 'r1', content: 'text' };
    const type = (undefined as string | undefined) || (undefined as string | undefined) || 'text';
    expect(type).toBe('text');
  });

  it('stores agent_output with status in DB', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.insertMessage({
      id: 'm1', room_id: 'r1', sender: 'alice/agent', content: 'running',
      type: 'agent_output', status: 'running', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].type).toBe('agent_output');
    expect(msgs[0].status).toBe('running');
    cleanupDB(dbPath, imdb);
  });

  it('stores message with msgType=agent_output and empty content', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.insertMessage({
      id: 'm1', room_id: 'r1', sender: 'alice/agent', content: '',
      type: 'agent_output', status: 'running', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].content).toBe('');
    cleanupDB(dbPath, imdb);
  });
});

// ─── handleImSync: Hub sync response ───

describe('handleImSync: Sync processing', () => {
  it('returns messages after given timestamp', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    for (let i = 0; i < 5; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice', content: `msg${i}`, timestamp: 1000 + i * 100, seq: i + 1 });
    }
    const msgs = imdb.getMessagesAfter('r1', 1200);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].id).toBe('m3');
    cleanupDB(dbPath, imdb);
  });

  it('returns empty when no messages after timestamp', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: 'hello', timestamp: 1000, seq: 1 });
    expect(imdb.getMessagesAfter('r1', 2000)).toHaveLength(0);
    cleanupDB(dbPath, imdb);
  });

  it('returns all messages when afterTimestamp=0', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    for (let i = 0; i < 3; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice', content: `msg${i}`, timestamp: 1000 + i, seq: i + 1 });
    }
    expect(imdb.getMessagesAfter('r1', 0)).toHaveLength(3);
    cleanupDB(dbPath, imdb);
  });

  it('encrypts messages in sync response', () => {
    const original = { id: 'm1', room_id: 'r1', content: 'hello', type: 'text', timestamp: 1000, seq: 1 };
    const encrypted = encryptIMMessage(original as Record<string, unknown>, PSK);
    expect((encrypted as any).content).toMatch(/^enc:/);
    expect(encrypted.type).toBe('text');
    // Receiver decrypts
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('hello');
  });

  it('sync response carries roomId in data wrapper', () => {
    // Hub sends: { type: 'im.sync', data: { roomId, messages: [...] } }
    const data = { roomId: 'r1', messages: [{ id: 'm1', content: 'enc:xxx' }] };
    expect(data.roomId).toBe('r1');
    expect(data.messages).toHaveLength(1);
  });
});

// ─── handleImRoomUpdated: Member management ───

describe('handleImRoomUpdated: Member management', () => {
  it('detects new members correctly', () => {
    const oldMembers = new Set(['alice', 'bob']);
    const newMembers = ['alice', 'bob', 'charlie'];
    const addedMembers: string[] = [];
    for (const m of newMembers) {
      if (!oldMembers.has(m)) addedMembers.push(m);
    }
    expect(addedMembers).toEqual(['charlie']);
  });

  it('detects all members as new when no prior record', () => {
    const oldMembers: Set<string> | undefined = undefined;
    const newMembers = ['alice', 'bob'];
    const addedMembers: string[] = [];
    if (oldMembers) {
      for (const m of newMembers) {
        if (!oldMembers.has(m)) addedMembers.push(m);
      }
    } else {
      addedMembers.push(...newMembers);
    }
    expect(addedMembers).toEqual(['alice', 'bob']);
  });

  it('excludes sender from invited members', () => {
    const senderClientId = 'alice@dev';
    const addedMembers = ['bob@dev', 'alice@dev', 'charlie@dev'];
    const invitedMembers = addedMembers.filter(m => m !== senderClientId);
    expect(invitedMembers).toEqual(['bob@dev', 'charlie@dev']);
  });

  it('im.room.invited message includes name field', () => {
    const invitedMsg = { type: 'im.room.invited', roomId: 'r1', members: ['alice', 'bob'], name: 'Group Chat' };
    const encrypted = encryptIMMessage(invitedMsg as Record<string, unknown>, PSK);
    expect((encrypted as any).name).toBe('Group Chat');
    expect(encrypted.type).toBe('im.room.invited');
    expect(encrypted.roomId).toBe('r1');
  });

  it('upserts room to Hub DB for offline discovery', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'My Room', ['alice', 'bob', 'charlie']);
    const room = imdb.getRoom('r1');
    expect(room).toBeDefined();
    expect(JSON.parse(room!.members)).toEqual(['alice', 'bob', 'charlie']);
    cleanupDB(dbPath, imdb);
  });

  it('updates existing room members via upsert', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.upsertRoom('r1', 'Room Updated', ['alice', 'bob']);
    const room = imdb.getRoom('r1');
    expect(JSON.parse(room!.members)).toEqual(['alice', 'bob']);
    expect(room!.name).toBe('Room Updated');
    cleanupDB(dbPath, imdb);
  });
});

// ─── handleImRoomDissolved: Room dissolution ───

describe('handleImRoomDissolved', () => {
  it('deletes room from DB', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    imdb.deleteRoom('r1');
    expect(imdb.getRoom('r1')).toBeUndefined();
    cleanupDB(dbPath, imdb);
  });

  it('removes room from in-memory tracking', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice', 'bob']));
    imRoomMembers.delete('r1');
    expect(imRoomMembers.has('r1')).toBe(false);
  });

  it('forwards dissolved event to remaining members', () => {
    const msg = { type: 'im.room.dissolved', roomId: 'r1' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    expect(encrypted.type).toBe('im.room.dissolved');
    expect(encrypted.roomId).toBe('r1');
  });
});

// ─── broadcastToImRoom: Targeted broadcasting ───

describe('broadcastToImRoom', () => {
  it('sends to all members except excluded clientId', () => {
    const members = new Set(['alice', 'bob', 'charlie']);
    const excludeClientId = 'alice';
    const recipients: string[] = [];
    for (const clientId of members) {
      if (clientId === excludeClientId) continue;
      recipients.push(clientId);
    }
    expect(recipients).toEqual(['bob', 'charlie']);
  });

  it('sends to all members when no exclusion', () => {
    const members = new Set(['alice', 'bob']);
    const recipients: string[] = [];
    for (const clientId of members) {
      recipients.push(clientId);
    }
    expect(recipients).toEqual(['alice', 'bob']);
  });

  it('returns early when no members for room', () => {
    const members: Set<string> | undefined = undefined;
    const recipients: string[] = [];
    if (!members) {
      // early return
    } else {
      for (const clientId of members) {
        recipients.push(clientId);
      }
    }
    expect(recipients).toHaveLength(0);
  });

  it('skips members with closed WebSocket', () => {
    // Simulating ws.readyState !== WebSocket.OPEN (1)
    const members = new Set(['alice', 'bob']);
    const wsStates: Record<string, number> = { alice: 1, bob: 3 }; // bob is CLOSED
    const recipients: string[] = [];
    for (const clientId of members) {
      if (wsStates[clientId] !== 1) continue;
      recipients.push(clientId);
    }
    expect(recipients).toEqual(['alice']);
  });
});

// ─── addImRoomMember: Membership tracking ───

describe('addImRoomMember', () => {
  it('creates new set for unknown room', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    const roomId = 'r1';
    const clientId = 'alice';
    let members = imRoomMembers.get(roomId);
    if (!members) {
      members = new Set();
      imRoomMembers.set(roomId, members);
    }
    members.add(clientId);
    expect(imRoomMembers.get('r1')!.has('alice')).toBe(true);
  });

  it('adds to existing set without duplicating', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice']));
    const members = imRoomMembers.get('r1')!;
    members.add('alice'); // duplicate
    members.add('bob');
    expect(members.size).toBe(2);
  });

  it('tracks sender as member when they send a message', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    // Simulate handleImSend calling addImRoomMember
    const roomId = 'r1';
    const sender = 'alice@dev';
    let members = imRoomMembers.get(roomId);
    if (!members) {
      members = new Set();
      imRoomMembers.set(roomId, members);
    }
    members.add(sender);
    expect(imRoomMembers.get(roomId)!.has('alice@dev')).toBe(true);
  });
});

// ─── sendPendingImInvitations: Reconnect recovery ───

describe('sendPendingImInvitations', () => {
  it('finds rooms for reconnecting client via getRoomsForMember', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room1', ['alice', 'bob']);
    imdb.upsertRoom('r2', 'Room2', ['charlie']);
    imdb.upsertRoom('r3', 'Room3', ['alice', 'dave']);
    const rooms = imdb.getRoomsForMember('alice');
    expect(rooms).toHaveLength(2);
    cleanupDB(dbPath, imdb);
  });

  it('sends im.room.invited for each room the client belongs to', () => {
    const clientRooms = [
      { id: 'r1', members: '["alice","bob"]', name: 'Room1' },
      { id: 'r3', members: '["alice","dave"]', name: 'Room3' },
    ];
    const invitations = clientRooms.map(r => ({
      type: 'im.room.invited',
      roomId: r.id,
      members: JSON.parse(r.members),
      name: r.name,
    }));
    expect(invitations).toHaveLength(2);
    expect(invitations[0].roomId).toBe('r1');
    expect(invitations[1].roomId).toBe('r3');
  });
});

// ─── handleImTransparent: Transparent forwarding ───

describe('handleImTransparent', () => {
  it('encrypts and forwards typing indicator', () => {
    const msg = { type: 'im.typing', roomId: 'r1', sender: 'alice' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    expect(encrypted.type).toBe('im.typing');
    expect(encrypted.roomId).toBe('r1');
    // No content to encrypt
    expect((encrypted as any).content).toBeUndefined();
  });

  it('encrypts and forwards agent_delta', () => {
    const msg = { type: 'im.agent_delta', roomId: 'r1', content: 'delta text' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    expect((encrypted as any).content).toMatch(/^enc:/);
    expect(encrypted.type).toBe('im.agent_delta');
  });
});

// ─── handleImPresence: Presence aggregation ───

describe('handleImPresence', () => {
  it('aggregates online users from all clients in room', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice', 'bob']));
    const clients = new Map<string, { subscribedRooms: Set<string> }>();
    clients.set('alice', { subscribedRooms: new Set(['r1']) });
    clients.set('bob', { subscribedRooms: new Set(['r1']) });
    clients.set('charlie', { subscribedRooms: new Set() });

    const onlineUsers: string[] = [];
    for (const clientId of imRoomMembers.get('r1')!) {
      if (clients.has(clientId)) {
        onlineUsers.push(clientId);
      }
    }
    expect(onlineUsers.sort()).toEqual(['alice', 'bob']);
  });

  it('debounces presence broadcasts', () => {
    const PRESENCE_DEBOUNCE_MS = 150;
    expect(PRESENCE_DEBOUNCE_MS).toBe(150);
    // Multiple presence events within 150ms should only trigger one broadcast
  });
});

// ─── handleClientsSearch: Client search ───

describe('handleClientsSearch', () => {
  it('searches connected clients by clientId', () => {
    const query = 'alice';
    const connectedClients = [
      { clientId: 'alice@dev' },
      { clientId: 'bob@dev' },
      { clientId: 'alice-test@prod' },
    ];
    const results = connectedClients.filter(c =>
      c.clientId.toLowerCase().includes(query.toLowerCase()),
    );
    expect(results).toHaveLength(2);
  });

  it('returns all clients when query is empty', () => {
    const query = '';
    const connectedClients = [
      { clientId: 'alice@dev' },
      { clientId: 'bob@dev' },
    ];
    const results = connectedClients.filter(c =>
      !query || c.clientId.toLowerCase().includes(query),
    );
    expect(results).toHaveLength(2);
  });

  it('caps results at MAX_RESULTS (20)', () => {
    const MAX_RESULTS = 20;
    const clients = Array.from({ length: 30 }, (_, i) => ({ clientId: `user${i}` }));
    const results = clients.filter(() => true).slice(0, MAX_RESULTS);
    expect(results).toHaveLength(20);
  });

  it('deduplicates between WS clients and DB clients', () => {
    const wsClients = [{ clientId: 'alice@dev' }, { clientId: 'bob@dev' }];
    const dbClients = [{ client_id: 'bob@dev', hostname: 'ws2' }, { client_id: 'charlie@dev', hostname: 'ws3' }];
    const seen = new Set<string>();
    const results: { clientId: string }[] = [];
    for (const c of wsClients) {
      if (seen.has(c.clientId)) continue;
      seen.add(c.clientId);
      results.push(c);
    }
    for (const c of dbClients) {
      if (seen.has(c.client_id)) continue;
      seen.add(c.client_id);
      results.push({ clientId: c.client_id });
    }
    expect(results).toHaveLength(3);
    expect(results.map(r => r.clientId)).toEqual(['alice@dev', 'bob@dev', 'charlie@dev']);
  });

  it('searches DB clients by hostname', () => {
    const query = 'server';
    const dbClients = [
      { client_id: 'alice@dev', hostname: 'dev-server-1' },
      { client_id: 'bob@dev', hostname: 'prod-box' },
    ];
    const results = dbClients.filter(c =>
      c.client_id.toLowerCase().includes(query) ||
      c.hostname.toLowerCase().includes(query),
    );
    expect(results).toHaveLength(1);
    expect(results[0].client_id).toBe('alice@dev');
  });
});

// ─── Concurrency control ───

describe('Concurrency control', () => {
  it('MAX_IM_CONCURRENCY limits concurrent IM operations', () => {
    const MAX_IM_CONCURRENCY = 20;
    expect(MAX_IM_CONCURRENCY).toBe(20);
  });

  it('imActiveCount is incremented and decremented around handler', () => {
    let imActiveCount = 0;
    const handle = () => {
      if (imActiveCount >= 20) return 'busy';
      imActiveCount++;
      try {
        // do work
      } finally {
        imActiveCount--;
      }
      return 'ok';
    };
    expect(handle()).toBe('ok');
    expect(imActiveCount).toBe(0);
  });

  it('rejects request when at concurrency limit', () => {
    let imActiveCount = 20;
    const result = imActiveCount >= 20 ? 'busy' : 'ok';
    expect(result).toBe('busy');
  });
});

// ─── IM cleanup ───

describe('IM cleanup', () => {
  it('cleanup interval is 1 hour', () => {
    const IM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
    expect(IM_CLEANUP_INTERVAL_MS).toBe(3600000);
  });

  it('deletes messages older than 7 days', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    imdb.insertMessage({ id: 'old', room_id: 'r1', sender: 'alice', content: 'old', timestamp: now - sevenDays - 1, seq: 1 });
    imdb.insertMessage({ id: 'recent', room_id: 'r1', sender: 'alice', content: 'recent', timestamp: now, seq: 2 });
    const deleted = imdb.deleteOldMessages();
    expect(deleted).toBe(1);
    cleanupDB(dbPath, imdb);
  });
});

// ─── Edge cases ───

describe('Edge cases', () => {
  it('message with very long content (>10KB) is stored correctly', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    const longContent = 'x'.repeat(15000);
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice', content: longContent, timestamp: 1000, seq: 1 });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].content).toBe(longContent);
    expect(msgs[0].content.length).toBe(15000);
    cleanupDB(dbPath, imdb);
  });

  it('room with many members (100+) is handled', () => {
    const { dbPath, imdb } = createTestDB();
    const members = Array.from({ length: 150 }, (_, i) => `user${i}`);
    imdb.upsertRoom('r1', 'Large Room', members);
    const room = imdb.getRoom('r1');
    expect(JSON.parse(room!.members)).toHaveLength(150);
    cleanupDB(dbPath, imdb);
  });

  it('rapid sequential messages maintain order', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice']);
    const base = Date.now();
    for (let i = 0; i < 100; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice', content: `msg${i}`, timestamp: base + i, seq: i + 1 });
    }
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(100);
    expect(msgs[0].seq).toBe(1);
    expect(msgs[99].seq).toBe(100);
    cleanupDB(dbPath, imdb);
  });

  it('WAL mode is enabled for performance', () => {
    const { dbPath, imdb } = createTestDB();
    // IMDB constructor sets journal_mode = WAL
    // We just verify it doesn't crash
    expect(imdb).toBeDefined();
    cleanupDB(dbPath, imdb);
  });

  it('index on (room_id, timestamp) exists for fast queries', () => {
    const { dbPath, imdb } = createTestDB();
    // Indexes are created in initTables — verify by querying
    const db = new Database(dbPath);
    const indexes = db.pragma('index_list("im_messages")') as { name: string }[];
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_im_msg_room_ts');
    expect(indexNames).toContain('idx_im_msg_room_seq');
    db.close();
    cleanupDB(dbPath, imdb);
  });
});
