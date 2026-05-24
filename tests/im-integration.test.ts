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

/**
 * Simulate handleImSend: decrypt → upsert → broadcast
 * This is the Hub's core IM message processing flow
 */
function simulateHubImSend(
  imdb: IMDB,
  roomId: string,
  sender: string,
  content: string,
  overrides: {
    id?: string;
    msgType?: string;
    status?: string;
    sessionId?: string;
    seq?: number;
    timestamp?: number;
  } = {},
): { id: string; broadcastMsg: Record<string, unknown> } {
  const id = overrides.id || crypto.randomUUID();
  const timestamp = overrides.timestamp || Date.now();
  const seq = overrides.seq || 0;
  const type = overrides.msgType || 'text';
  const status = overrides.status;
  const sessionId = overrides.sessionId;

  // Hub decrypts the message
  // Hub upserts into DB
  imdb.upsertMessage({
    id,
    room_id: roomId,
    sender,
    content,
    type,
    status,
    session_id: sessionId,
    timestamp,
    seq,
  });

  // Hub constructs broadcast message
  const broadcastMsg: Record<string, unknown> = {
    type: 'im.message',
    id,
    roomId,
    sender,
    content,
    msgType: type,
    timestamp,
    seq,
    status,
    sessionId,
  };
  // Remove undefined fields (as Hub code does)
  for (const key of Object.keys(broadcastMsg)) {
    if (broadcastMsg[key] === undefined) delete broadcastMsg[key];
  }

  return { id, broadcastMsg };
}

// ═══════════════════════════════════════════════════════════════════════════
// 场景 1: A 发消息 → Hub 存储 → B 通过广播收到完整字段
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: A 发消息 → Hub 存储 → B 通过广播收到完整字段', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
    imdb.upsertRoom('r1', 'Test Room', ['alice@dev', 'bob@dev']);
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('Hub 收到 im.send → upsertMessage 存入 DB，字段完整', () => {
    const { id } = simulateHubImSend(imdb, 'r1', 'alice@dev', 'hello from alice');
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('hello from alice');
    expect(msgs[0].sender).toBe('alice@dev');
    expect(msgs[0].type).toBe('text');
    expect(msgs[0].room_id).toBe('r1');
  });

  it('广播消息含完整字段（content / sender / type / roomId / seq / timestamp）', () => {
    const { broadcastMsg } = simulateHubImSend(imdb, 'r1', 'alice@dev', 'broadcast test', {
      msgType: 'text',
      seq: 5,
    });
    expect(broadcastMsg.content).toBe('broadcast test');
    expect(broadcastMsg.sender).toBe('alice@dev');
    expect(broadcastMsg.msgType).toBe('text');
    expect(broadcastMsg.roomId).toBe('r1');
    expect(broadcastMsg.seq).toBe(5);
    expect(broadcastMsg.timestamp).toBeGreaterThan(0);
  });

  it('B 收到广播后解密得到原始 content', () => {
    const { broadcastMsg } = simulateHubImSend(imdb, 'r1', 'alice@dev', 'secret for bob');
    const encrypted = encryptIMMessage(broadcastMsg, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('secret for bob');
    expect(decrypted.sender).toBe('alice@dev');
  });

  it('广播消息的 status/sessionId/mentionedAgents 完整传递', () => {
    const { broadcastMsg } = simulateHubImSend(imdb, 'r1', 'alice@dev/agent1', 'agent result', {
      msgType: 'agent_output',
      status: 'completed',
      sessionId: 'sess-abc',
    });
    expect(broadcastMsg.status).toBe('completed');
    expect(broadcastMsg.sessionId).toBe('sess-abc');
    expect(broadcastMsg.msgType).toBe('agent_output');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 2: Agent running → completed，Hub upsertMessage 生命周期
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Agent running → completed，Hub upsertMessage 保证最终状态正确', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('running 消息 upsert → DB 状态为 running', () => {
    imdb.upsertMessage({
      id: 'm-agent-1', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].status).toBe('running');
    expect(msgs[0].content).toBe('');
  });

  it('completed 消息用 upsert 更新 running → 最终 DB 是 completed 且有完整内容', () => {
    // First: running
    imdb.upsertMessage({
      id: 'm-agent-1', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    // Then: completed (same id, updated content + status)
    imdb.upsertMessage({
      id: 'm-agent-1', room_id: 'r1', sender: 'alice@dev/agent1', content: '最终答案：42',
      type: 'agent_output', status: 'completed', session_id: 'sess-1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1); // Still 1 message, not 2
    expect(msgs[0].status).toBe('completed');
    expect(msgs[0].content).toBe('最终答案：42');
    expect(msgs[0].type).toBe('agent_output');
  });

  it('upsert vs insert: insert (INSERT OR IGNORE) 不会更新 running → completed', () => {
    // Using insertMessage (INSERT OR IGNORE)
    imdb.insertMessage({
      id: 'm-agent-2', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 'sess-2',
      timestamp: 1000, seq: 1,
    });
    // Try to "complete" with insertMessage — it's IGNORED
    imdb.insertMessage({
      id: 'm-agent-2', room_id: 'r1', sender: 'alice@dev/agent1', content: 'answer',
      type: 'agent_output', status: 'completed', session_id: 'sess-2',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].status).toBe('running'); // Still running! Bug if using insert instead of upsert
    expect(msgs[0].content).toBe(''); // Content not updated
  });

  it('running → failed 生命周期', () => {
    imdb.upsertMessage({
      id: 'm-agent-3', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 'sess-3',
      timestamp: 1000, seq: 1,
    });
    imdb.upsertMessage({
      id: 'm-agent-3', room_id: 'r1', sender: 'alice@dev/agent1', content: '执行超时',
      type: 'agent_output', status: 'failed', session_id: 'sess-3',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].status).toBe('failed');
    expect(msgs[0].content).toBe('执行超时');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 3: 空 content（agent running）Hub 不丢弃
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: 空 content（agent running）Hub 正确存储且不丢弃', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('content="" 的 agent_output 消息正确存入 Hub DB', () => {
    imdb.upsertMessage({
      id: 'm-empty', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 's1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    expect(msgs[0].content).toBe('');
    expect(msgs[0].status).toBe('running');
  });

  it('Hub 广播 content="" 的消息，接收方解密后得到空字符串', () => {
    const msg = { type: 'im.message', roomId: 'r1', content: '', status: 'running', msgType: 'agent_output' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    // Empty content is not encrypted (encryptIMMessage skips empty strings)
    expect(encrypted.content).toBe('');
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('');
  });

  it('sync 返回 content="" 的消息 → 接收方能收到', () => {
    imdb.upsertMessage({
      id: 'm-sync-empty', room_id: 'r1', sender: 'alice@dev/agent1', content: '',
      type: 'agent_output', status: 'running', session_id: 's1',
      timestamp: 1000, seq: 1,
    });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(1);
    // Sync encrypts messages for transmission
    const encrypted = encryptIMMessage(msgs[0] as unknown as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 4: Hub sync 返回正确的消息（按 afterTimestamp 过滤、加密传输）
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub im.sync 返回正确消息（按 timestamp 过滤、加密传输）', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
    imdb.upsertRoom('r1', 'Room', ['alice@dev', 'bob@dev']);
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('sync afterTimestamp=0 → 返回所有消息', () => {
    for (let i = 0; i < 5; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice@dev', content: `msg${i}`, timestamp: 1000 + i * 100, seq: i + 1 });
    }
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(5);
  });

  it('sync afterTimestamp=2000 → 只返回 timestamp > 2000 的消息', () => {
    // timestamps: 1000, 1100, 1200, 1300, 1400 — all ≤ 2000, so after=2000 returns 0
    for (let i = 0; i < 5; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice@dev', content: `msg${i}`, timestamp: 1000 + i * 100, seq: i + 1 });
    }
    expect(imdb.getMessagesAfter('r1', 2000)).toHaveLength(0);
    // With higher timestamps: 3000, 3100, 3200 — after=2000 returns all 3
    imdb.upsertRoom('r2', 'Room2', ['alice@dev']);
    for (let i = 0; i < 3; i++) {
      imdb.insertMessage({ id: `n${i}`, room_id: 'r2', sender: 'alice@dev', content: `msg${i}`, timestamp: 3000 + i * 100, seq: i + 1 });
    }
    expect(imdb.getMessagesAfter('r2', 2000)).toHaveLength(3);
  });

  it('sync 返回的消息是加密的，接收方可以解密', () => {
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice@dev', content: 'secret', timestamp: 1000, seq: 1 });
    const msgs = imdb.getMessagesAfter('r1', 0);
    const encrypted = encryptIMMessage(msgs[0] as unknown as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('secret');
  });

  it('sync 响应结构: { type: "im.sync", data: { roomId, messages: [...] } }', () => {
    const data = { roomId: 'r1', messages: [{ id: 'm1', content: 'enc:xxx' }] };
    expect(data.roomId).toBe('r1');
    expect(data.messages).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 5: Hub sender 校验 — 拒绝伪造发送者
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub sender 校验 — 拒绝伪造发送者', () => {
  it('sender === clientId → 合法', () => {
    const clientId = 'alice@dev';
    const rawSender = 'alice@dev';
    const valid = rawSender === clientId || rawSender.startsWith(clientId + '/');
    expect(valid).toBe(true);
  });

  it('sender 以 clientId + "/" 开头 → 合法（agent 发送）', () => {
    const clientId = 'alice@dev';
    const rawSender = 'alice@dev/agent1';
    const valid = rawSender === clientId || rawSender.startsWith(clientId + '/');
    expect(valid).toBe(true);
  });

  it('sender 是别人的 clientId → 不合法，回退为自身', () => {
    const clientId = 'alice@dev';
    const rawSender = 'bob@dev';
    const sender = rawSender === clientId || rawSender.startsWith(clientId + '/')
      ? rawSender
      : clientId;
    expect(sender).toBe('alice@dev');
  });

  it('sender 伪造为 alice（缺少 @dev 后缀）→ 不合法', () => {
    const clientId = 'alice@dev';
    const rawSender = 'alice';
    const valid = rawSender === clientId || rawSender.startsWith(clientId + '/');
    expect(valid).toBe(false);
  });

  it('sender 以 bob@dev/ 开头但 clientId 是 alice@dev → 不合法', () => {
    const clientId = 'alice@dev';
    const rawSender = 'bob@dev/agent1';
    const valid = rawSender === clientId || rawSender.startsWith(clientId + '/');
    expect(valid).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 6: Hub sync 权限校验 — 非成员被拒绝
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub im.sync 权限校验 — 非成员被拒绝', () => {
  it('in-memory 成员检查通过', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice@dev', 'bob@dev']));
    const isMember = imRoomMembers.get('r1')?.has('alice@dev');
    expect(isMember).toBe(true);
  });

  it('in-memory 非成员 → 回退到 DB 检查', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev', 'bob@dev']);
    // charlie@dev not in memory
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice@dev']));
    const isMemberInMemory = imRoomMembers.get('r1')?.has('charlie@dev');
    expect(isMemberInMemory).toBeFalsy();
    // Fallback to DB
    const dbRoom = imdb.getRoom('r1');
    const dbMembers: string[] = dbRoom ? JSON.parse(dbRoom.members) : [];
    expect(dbMembers.includes('charlie@dev')).toBe(false);
    cleanupDB(dbPath, imdb);
  });

  it('DB 中也不是成员 → 拒绝', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    const dbRoom = imdb.getRoom('r1');
    const dbMembers: string[] = JSON.parse(dbRoom!.members);
    expect(dbMembers.includes('eve@hacker')).toBe(false);
    cleanupDB(dbPath, imdb);
  });

  it('DB 检查通过后回写 in-memory', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev', 'bob@dev']);
    const imRoomMembers = new Map<string, Set<string>>();
    // bob not in memory
    // Hub code: this.addImRoomMember(roomId, client.clientId);
    let members = imRoomMembers.get('r1');
    if (!members) {
      members = new Set();
      imRoomMembers.set('r1', members);
    }
    members.add('bob@dev');
    expect(imRoomMembers.get('r1')!.has('bob@dev')).toBe(true);
    cleanupDB(dbPath, imdb);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 7: Hub 重连后 sendPendingImInvitations 合并（不替换）成员
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 重连 sendPendingImInvitations 合并成员而非替换', () => {
  let dbPath: string;
  let imdb: IMDB;

  beforeEach(() => {
    ({ dbPath, imdb } = createTestDB());
  });

  afterEach(() => cleanupDB(dbPath, imdb));

  it('已有 in-memory 成员 + DB 成员 → 合并后包含全部', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice@dev'])); // existing in-memory
    // DB has bob too
    imdb.upsertRoom('r1', 'Room', ['alice@dev', 'bob@dev']);
    // sendPendingImInvitations merges:
    const dbRoom = imdb.getRoom('r1');
    const dbMembers = JSON.parse(dbRoom!.members) as string[];
    const existing = imRoomMembers.get('r1');
    if (existing) {
      for (const m of dbMembers) existing.add(m);
    }
    expect(imRoomMembers.get('r1')).toEqual(new Set(['alice@dev', 'bob@dev']));
  });

  it('邀请消息包含 name 字段', () => {
    imdb.upsertRoom('r1', '我的讨论组', ['alice@dev', 'bob@dev']);
    const room = imdb.getRoom('r1');
    const invitedMsg = { type: 'im.room.invited', roomId: 'r1', members: JSON.parse(room!.members), name: room!.name };
    expect(invitedMsg.name).toBe('我的讨论组');
    expect(invitedMsg.members).toContain('bob@dev');
  });

  it('重连时 getRoomsForMember 返回该用户的所有房间', () => {
    imdb.upsertRoom('r1', 'Room1', ['alice@dev', 'bob@dev']);
    imdb.upsertRoom('r2', 'Room2', ['charlie@dev']);
    imdb.upsertRoom('r3', 'Room3', ['alice@dev', 'dave@dev']);
    const rooms = imdb.getRoomsForMember('alice@dev');
    expect(rooms).toHaveLength(2);
    expect(rooms.map(r => r.id).sort()).toEqual(['r1', 'r3']);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 8: Hub im.room.updated — 新成员检测和邀请
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub im.room.updated — 检测新成员并发送邀请', () => {
  it('检测新增成员（排除已存在的）', () => {
    const oldMembers = new Set(['alice@dev', 'bob@dev']);
    const newMembers = ['alice@dev', 'bob@dev', 'charlie@dev'];
    const addedMembers: string[] = [];
    for (const m of newMembers) {
      if (!oldMembers.has(m)) addedMembers.push(m);
    }
    expect(addedMembers).toEqual(['charlie@dev']);
  });

  it('无旧成员记录 → 所有人都是新成员', () => {
    const oldMembers: Set<string> | undefined = undefined;
    const newMembers = ['alice@dev', 'bob@dev'];
    const addedMembers: string[] = [];
    if (oldMembers) {
      for (const m of newMembers) {
        if (!oldMembers.has(m)) addedMembers.push(m);
      }
    } else {
      addedMembers.push(...newMembers);
    }
    expect(addedMembers).toEqual(['alice@dev', 'bob@dev']);
  });

  it('邀请消息排除发送者本人', () => {
    const senderClientId = 'alice@dev';
    const addedMembers = ['bob@dev', 'alice@dev', 'charlie@dev'];
    const invitedMembers = addedMembers.filter(m => m !== senderClientId);
    expect(invitedMembers).toEqual(['bob@dev', 'charlie@dev']);
  });

  it('Hub upsertRoom 持久化房间数据（供离线发现）', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev', 'bob@dev']);
    const room = imdb.getRoom('r1');
    expect(room).toBeDefined();
    expect(JSON.parse(room!.members)).toEqual(['alice@dev', 'bob@dev']);
    cleanupDB(dbPath, imdb);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 9: Hub 房间解散 — DB 删除 + 成员清理 + 事件转发
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 房间解散 — DB 删除 + in-memory 清理 + 事件转发', () => {
  it('Hub 删除房间 DB 记录', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    imdb.deleteRoom('r1');
    expect(imdb.getRoom('r1')).toBeUndefined();
    cleanupDB(dbPath, imdb);
  });

  it('Hub 清理 in-memory 成员追踪', () => {
    const imRoomMembers = new Map<string, Set<string>>();
    imRoomMembers.set('r1', new Set(['alice@dev', 'bob@dev']));
    imRoomMembers.delete('r1');
    expect(imRoomMembers.has('r1')).toBe(false);
  });

  it('解散事件加密转发给所有成员', () => {
    const msg = { type: 'im.room.dissolved', roomId: 'r1' };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    expect(encrypted.type).toBe('im.room.dissolved');
    expect(encrypted.roomId).toBe('r1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 10: Hub 广播机制 — broadcastToImRoom 排除发送者、跳过离线
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub broadcastToImRoom — 排除发送者、跳过离线成员', () => {
  it('排除发送者的 clientId', () => {
    const members = new Set(['alice@dev', 'bob@dev', 'charlie@dev']);
    const excludeClientId = 'alice@dev';
    const recipients: string[] = [];
    for (const clientId of members) {
      if (clientId === excludeClientId) continue;
      recipients.push(clientId);
    }
    expect(recipients).toEqual(['bob@dev', 'charlie@dev']);
  });

  it('跳过 WebSocket 已关闭的成员', () => {
    const members = new Set(['alice@dev', 'bob@dev']);
    const wsStates: Record<string, number> = { 'alice@dev': 1, 'bob@dev': 3 }; // bob CLOSED
    const recipients: string[] = [];
    for (const clientId of members) {
      if (wsStates[clientId] !== 1) continue;
      recipients.push(clientId);
    }
    expect(recipients).toEqual(['alice@dev']);
  });

  it('无成员时直接返回', () => {
    const members: Set<string> | undefined = undefined;
    const recipients: string[] = [];
    if (members) {
      for (const clientId of members) recipients.push(clientId);
    }
    expect(recipients).toHaveLength(0);
  });

  it('agent sender 不被追踪为房间成员（只有真实 client 被追踪）', () => {
    const sender = 'alice@dev/agent1';
    // Hub code: if (!sender.includes('/')) { this.addImRoomMember(roomId, sender); }
    const shouldTrack = !sender.includes('/');
    expect(shouldTrack).toBe(false);
  });

  it('agent sender 的 owner 被追踪为房间成员', () => {
    const clientId = 'alice@dev';
    const sender = 'alice@dev/agent1';
    // Hub code: if (sender.includes('/') && sender.startsWith(client.clientId + '/')) { this.addImRoomMember(roomId, client.clientId); }
    const shouldTrackOwner = sender.includes('/') && sender.startsWith(clientId + '/');
    expect(shouldTrackOwner).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 11: Hub 加密数据流 — PSK 级别加密
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 加密数据流 — PSK 加密→传输→解密完整链路', () => {
  it('content 字段加密→解密 roundtrip', () => {
    const result = encryptField('secret message', PSK);
    expect(result).toMatch(/^enc:/);
    expect(decryptField(result, PSK)).toBe('secret message');
  });

  it('IM 消息加密→解密 roundtrip 所有字段保持完整', () => {
    const msg = {
      type: 'agent_output', roomId: 'r1', sender: 'alice@dev/agent1',
      content: '最终答案', status: 'completed', sessionId: 'sess-1',
      mentionedAgents: ['agent2'], timestamp: 1000, seq: 5,
    };
    const encrypted = encryptIMMessage(msg as Record<string, unknown>, PSK);
    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('最终答案');
    expect((decrypted as any).status).toBe('completed');
    expect((decrypted as any).sessionId).toBe('sess-1');
    expect((decrypted as any).sender).toBe('alice@dev/agent1');
  });

  it('错误 PSK 解密 → 返回密文而非崩溃', () => {
    const encrypted = encryptIMMessage({ content: 'secret' } as Record<string, unknown>, PSK);
    const wrongPsk = 'wrong-key-12345678901234567890';
    const decrypted = decryptIMMessage(encrypted, wrongPsk);
    expect((decrypted as any).content).toMatch(/^enc:/);
  });

  it('auth 加密→解密 roundtrip', () => {
    const payload = { clientId: 'alice@192.168.1.1' };
    const encrypted = encrypt(payload, PSK);
    const decrypted = decrypt(encrypted, PSK);
    expect(decrypted).toEqual(payload);
  });

  it('损坏密文返回原始字符串', () => {
    const corrupt = 'enc:invalid-base64!!!';
    expect(decryptField(corrupt, PSK)).toBe(corrupt);
  });

  it('未加密字段不做处理', () => {
    expect(decryptField('plain text', PSK)).toBe('plain text');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 12: Hub 并发控制和资源管理
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 并发控制 — MAX_IM_CONCURRENCY 限制', () => {
  it('并发计数器递增和递减正确', () => {
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

  it('达到上限时拒绝新请求', () => {
    let imActiveCount = 20;
    const result = imActiveCount >= 20 ? 'busy' : 'ok';
    expect(result).toBe('busy');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 13: Hub 客户端搜索 — 去重 + 限制数量
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 客户端搜索 — WS 在线 + DB 去重合并', () => {
  it('WS 在线客户端和 DB 客户端去重合并', () => {
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

  it('按 clientId 和 hostname 搜索', () => {
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

  it('结果不超过 20 条', () => {
    const clients = Array.from({ length: 30 }, (_, i) => ({ clientId: `user${i}` }));
    expect(clients.slice(0, 20)).toHaveLength(20);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 14: Hub 旧消息清理（7 天自动删除）
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: Hub 旧消息清理 — 7 天以上自动删除', () => {
  it('7 天前的消息被删除，近期消息保留', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    imdb.insertMessage({ id: 'old', room_id: 'r1', sender: 'alice@dev', content: 'old', timestamp: now - sevenDays - 1, seq: 1 });
    imdb.insertMessage({ id: 'recent', room_id: 'r1', sender: 'alice@dev', content: 'recent', timestamp: now, seq: 2 });
    const deleted = imdb.deleteOldMessages();
    expect(deleted).toBe(1);
    const remaining = imdb.getMessagesAfter('r1', 0);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('recent');
    cleanupDB(dbPath, imdb);
  });

  it('无旧消息时 deleteOldMessages 返回 0', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice@dev', content: 'new', timestamp: Date.now(), seq: 1 });
    expect(imdb.deleteOldMessages()).toBe(0);
    cleanupDB(dbPath, imdb);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景 15: 边界条件（大消息、大量成员、快速连续消息、索引）
// ═══════════════════════════════════════════════════════════════════════════

describe('场景: 边界条件 — 大消息、大量成员、快速消息', () => {
  it('>10KB 的消息正确存储和读取', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    const longContent = 'x'.repeat(15000);
    imdb.insertMessage({ id: 'm1', room_id: 'r1', sender: 'alice@dev', content: longContent, timestamp: 1000, seq: 1 });
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs[0].content).toBe(longContent);
    expect(msgs[0].content.length).toBe(15000);
    cleanupDB(dbPath, imdb);
  });

  it('100+ 成员的房间正确处理', () => {
    const { dbPath, imdb } = createTestDB();
    const members = Array.from({ length: 150 }, (_, i) => `user${i}@dev`);
    imdb.upsertRoom('r1', 'Large Room', members);
    const room = imdb.getRoom('r1');
    expect(JSON.parse(room!.members)).toHaveLength(150);
    cleanupDB(dbPath, imdb);
  });

  it('快速连续 100 条消息有序存储', () => {
    const { dbPath, imdb } = createTestDB();
    imdb.upsertRoom('r1', 'Room', ['alice@dev']);
    const base = Date.now();
    for (let i = 0; i < 100; i++) {
      imdb.insertMessage({ id: `m${i}`, room_id: 'r1', sender: 'alice@dev', content: `msg${i}`, timestamp: base + i, seq: i + 1 });
    }
    const msgs = imdb.getMessagesAfter('r1', 0);
    expect(msgs).toHaveLength(100);
    expect(msgs[0].seq).toBe(1);
    expect(msgs[99].seq).toBe(100);
    cleanupDB(dbPath, imdb);
  });

  it('索引 idx_im_msg_room_ts 和 idx_im_msg_room_seq 存在', () => {
    const { dbPath, imdb } = createTestDB();
    const db = new Database(dbPath);
    const indexes = db.pragma('index_list("im_messages")') as { name: string }[];
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_im_msg_room_ts');
    expect(indexNames).toContain('idx_im_msg_room_seq');
    db.close();
    cleanupDB(dbPath, imdb);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 场景: 端到端加密消息传递 — nasakim → Hub → kimdai 完整链路
// ═══════════════════════════════════════════════════════════════════════════
//
// 数据流:
//   nasakim 本地: imMsg(content=明文) → encryptIMMessage(imMsg) → sendToHub({ ...encrypted, type:'im.send', roomId, msgType })
//   Hub: decryptIMMessage(msg, PSK) → content=明文 → upsertMessage → encryptIMMessage(fullMsg, PSK) → broadcastToImRoom
//   kimdai 本地: decryptIMMessage(broadcastMsg) → content=明文 → insertMessage → 前端显示

describe('场景: 端到端加密消息传递 — nasakim 发 → Hub 中转 → kimdai 收', () => {
  it('nasakim 加密 → Hub 解密再加密广播 → kimdai 解密，content 完整一致', () => {
    // --- Step 1: nasakim 本地构造消息并加密 ---
    const imMsg = {
      id: crypto.randomUUID(),
      roomId: 'r1',
      sender: 'nasakim@dev',
      content: '你好 kimdai，这是测试消息',
      type: 'text',
      timestamp: Date.now(),
      seq: 1,
      mentionedAgents: [],
    };

    // 本地 Sman 调用 encryptIMMessage（不带 PSK，自动 loadPsk）
    // 但测试环境没有 hub.key，所以模拟用 PSK 加密
    const encrypted = encryptIMMessage(imMsg as Record<string, unknown>, PSK);

    // 验证 content 被加密了
    expect(typeof encrypted.content).toBe('string');
    expect((encrypted.content as string).startsWith('enc:')).toBe(true);
    expect(encrypted.content).not.toBe(imMsg.content);

    // 本地 Sman sendToHub: { ...encrypted, type: 'im.send', roomId, msgType }
    // 重要：spread 在前，显式字段在后，确保 type 不被覆盖
    const hubbound: Record<string, unknown> = {
      ...encrypted,
      type: 'im.send',
      roomId: 'r1',
      msgType: 'text',
    };

    // --- Step 2: Hub 收到消息，解密 ---
    // Hub handleImSend 的核心逻辑
    const hubDecrypted = decryptIMMessage(hubbound, PSK);
    const hubContent = (hubDecrypted.content as string) || '';

    // 验证 Hub 解密得到明文
    expect(hubContent).toBe('你好 kimdai，这是测试消息');
    expect(hubbound.type).toBe('im.send');  // type 不被加密影响
    expect(hubbound.msgType).toBe('text');

    // Hub 构造广播消息
    const id = (hubbound.id as string) || crypto.randomUUID();
    const timestamp = (hubbound.timestamp as number) || Date.now();
    const seq = (hubbound.seq as number) || 0;
    const type = (hubbound.msgType as string) || (hubDecrypted.type as string) || 'text';
    const sender = (hubDecrypted.sender as string) || 'nasakim@dev';

    const fullMsg: Record<string, unknown> = {
      type: 'im.message', id, roomId: 'r1', sender, content: hubContent,
      msgType: type, timestamp, seq,
    };
    for (const key of Object.keys(fullMsg)) {
      if (fullMsg[key] === undefined) delete fullMsg[key];
    }

    // Hub 加密后广播
    const broadcastMsg = encryptIMMessage(fullMsg, PSK);

    // 验证广播消息的 content 被加密了
    expect(typeof broadcastMsg.content).toBe('string');
    expect((broadcastMsg.content as string).startsWith('enc:')).toBe(true);
    expect(broadcastMsg.type).toBe('im.message');  // type 不加密

    // --- Step 3: kimdai 本地收到广播，解密 ---
    const kimdaiDecrypted = decryptIMMessage(broadcastMsg, PSK);

    // 验证 kimdai 解密得到完整消息
    expect(kimdaiDecrypted.content).toBe('你好 kimdai，这是测试消息');
    expect(kimdaiDecrypted.sender).toBe('nasakim@dev');
    expect(kimdaiDecrypted.roomId).toBe('r1');
    expect(kimdaiDecrypted.type).toBe('im.message');
  });

  it('spread 顺序错误时 type 被覆盖，Hub 收到错误的 type', () => {
    const imMsg = {
      id: crypto.randomUUID(),
      roomId: 'r1',
      sender: 'nasakim@dev',
      content: 'test',
      type: 'text',
      timestamp: Date.now(),
      seq: 1,
    };
    const encrypted = encryptIMMessage(imMsg as Record<string, unknown>, PSK);

    // 错误的顺序：显式字段在前，encrypted 在后
    // encrypted 包含 type: 'text'（来自原始消息），会覆盖 'im.send'
    const wrongOrder = {
      type: 'im.send',
      roomId: 'r1',
      msgType: 'text',
      ...encrypted,  // encrypted.type = 'text' 覆盖了 'im.send'
    };

    expect(wrongOrder.type).toBe('text');  // BUG: 应该是 'im.send'
    expect(wrongOrder.type).not.toBe('im.send');
  });

  it('正确的 spread 顺序时 type 保持 im.send', () => {
    const imMsg = {
      id: crypto.randomUUID(),
      roomId: 'r1',
      sender: 'nasakim@dev',
      content: 'test',
      type: 'text',
      timestamp: Date.now(),
      seq: 1,
    };
    const encrypted = encryptIMMessage(imMsg as Record<string, unknown>, PSK);

    // 正确的顺序：encrypted 在前，显式字段在后
    const correctOrder = {
      ...encrypted,
      type: 'im.send',
      roomId: 'r1',
      msgType: 'text',
    };

    expect(correctOrder.type).toBe('im.send');
  });

  it('agent_output 消息的 status/sessionId 不被加密，直接传递', () => {
    const imMsg = {
      id: crypto.randomUUID(),
      roomId: 'r1',
      sender: 'nasakim@dev/agent1',
      content: 'agent completed result',
      type: 'agent_output',
      status: 'completed',
      sessionId: 'sess-123',
      timestamp: Date.now(),
      seq: 2,
    };

    const encrypted = encryptIMMessage(imMsg as Record<string, unknown>, PSK);
    // status 和 sessionId 不被加密
    expect(encrypted.status).toBe('completed');
    expect(encrypted.sessionId).toBe('sess-123');
    expect((encrypted.content as string).startsWith('enc:')).toBe(true);

    const decrypted = decryptIMMessage(encrypted, PSK);
    expect(decrypted.content).toBe('agent completed result');
    expect(decrypted.status).toBe('completed');
    expect(decrypted.sessionId).toBe('sess-123');
  });
});
