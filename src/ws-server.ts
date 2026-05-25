import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import nodeCrypto from 'node:crypto';
import { decrypt, encrypt } from './crypto.js';
import { decryptIMMessage, encryptIMMessage } from './im-crypto.js';
import { RoomDB } from './db-rooms.js';
import { IMDB } from './db-im.js';
import type { WsMessage, WsAuthMessage, TaskStatus } from './types.js';
import type { TaskEngine } from './task-engine.js';
import { createTaskHandler } from './ws-task-handler.js';

interface HubDBLike {
  getAllClients(): { client_id: string; hostname: string }[];
}

interface AuthedClient {
  ws: WebSocket;
  clientId: string;
  subscribedRooms: Set<string>;
}

const AUTH_TIMEOUT_MS = 5000;
const STALE_CHECK_INTERVAL_MS = 60_000;
const STALE_THRESHOLD_MS = 90_000;
const IM_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const PRESENCE_DEBOUNCE_MS = 150;
const MAX_IM_CONCURRENCY = 20;
const LOG = (...args: unknown[]) => console.log(`[HubWS]`, ...args);

export class WsHub {
  private wss: WebSocketServer;
  private clients = new Map<WebSocket, AuthedClient>();
  /** Reverse index: clientId → WebSocket for O(1) lookup */
  private clientIdToWs = new Map<string, WebSocket>();
  private rooms = new Map<string, Set<WebSocket>>();
  /** IM room membership: imRoomId → Set of clientIds */
  private imRoomMembers = new Map<string, Set<string>>();
  private roomDB: RoomDB;
  private imDB: IMDB;
  private hubDB: HubDBLike | null;
  private psk: string;
  private staleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private imCleanupTimer: ReturnType<typeof setInterval> | null = null;
  private taskHandler: ReturnType<typeof createTaskHandler> | null = null;
  private taskEngine: TaskEngine | null = null;
  /** Debounced presence broadcasts: roomId → timer */
  private pendingPresenceBroadcasts = new Map<string, ReturnType<typeof setTimeout>>();
  /** IM message processing concurrency counter */
  private imActiveCount = 0;

  constructor(server: Server, roomDB: RoomDB, imDB: IMDB, hubDB: HubDBLike | null, psk: string, taskEngine?: TaskEngine) {
    this.roomDB = roomDB;
    this.imDB = imDB;
    this.hubDB = hubDB;
    this.psk = psk;
    this.taskEngine = taskEngine ?? null;
    this.wss = new WebSocketServer({ server, path: '/ws' });
    if (taskEngine) {
      this.taskHandler = createTaskHandler(taskEngine, this, this.roomDB);
    }

    this.wss.on('connection', (ws) => {
      const authTimeout = setTimeout(() => {
        if (!this.clients.has(ws)) {
          ws.close(4001, 'Auth timeout');
        }
      }, AUTH_TIMEOUT_MS);

      ws.on('message', (raw) => {
        let msg: WsMessage;
        try {
          msg = JSON.parse(raw.toString());
        } catch {
          this.sendError(ws, 'Invalid JSON');
          return;
        }

        if (!this.clients.has(ws)) {
          if (msg.type === 'auth.psk') {
            clearTimeout(authTimeout);
            this.handleAuth(ws, msg as WsAuthMessage);
          } else {
            ws.close(4002, 'Not authenticated');
          }
          return;
        }

        this.route(ws, msg);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });
    });

    this.staleCheckTimer = setInterval(() => {
      this.checkStaleAgents();
    }, STALE_CHECK_INTERVAL_MS);

    this.imCleanupTimer = setInterval(() => {
      const deleted = this.imDB.deleteOldMessages();
      if (deleted > 0) {
        console.log(`[IM] Cleaned up ${deleted} messages older than 7 days`);
      }
    }, IM_CLEANUP_INTERVAL_MS);
  }

  private handleAuth(ws: WebSocket, msg: WsAuthMessage): void {
    try {
      const now = Date.now();
      const diff = Math.abs(now - msg.timestamp * 1000);
      if (diff > 5 * 60 * 1000) {
        ws.close(4003, 'Timestamp expired');
        return;
      }

      const decrypted = decrypt(msg.payload, this.psk) as { clientId: string };
      if (!decrypted.clientId) {
        ws.close(4004, 'Invalid payload');
        return;
      }

      const client: AuthedClient = {
        ws,
        clientId: decrypted.clientId,
        subscribedRooms: new Set(),
      };
      this.clients.set(ws, client);
      this.clientIdToWs.set(client.clientId, ws);
      LOG(`Client authenticated: ${client.clientId} (total ${this.clients.size})`);

      this.send(ws, { type: 'auth.ok', clientId: client.clientId });

      // Send pending IM room invitations for this client
      // (rooms where they are a member in Hub DB but may not know about locally)
      this.sendPendingImInvitations(client);
    } catch {
      ws.close(4005, 'Auth failed');
    }
  }

  /**
   * On auth, send room invites and batch presence broadcasts.
   * Collects all rooms first, then sends one presence per room (not one per member scan).
   */
  private sendPendingImInvitations(client: AuthedClient): void {
    const rooms = this.imDB.getRoomsForMember(client.clientId);
    if (rooms.length > 0) {
      LOG(`Sending ${rooms.length} pending IM room invitations to ${client.clientId}`);
    }
    if (rooms.length === 0) return;

    const affectedRoomIds: string[] = [];

    // Phase 1: merge in-memory membership + send invites to this client
    for (const room of rooms) {
      const members = JSON.parse(room.members) as string[];
      // Merge with existing in-memory set instead of replacing
      const existing = this.imRoomMembers.get(room.id);
      if (existing) {
        for (const m of members) existing.add(m);
      } else {
        this.imRoomMembers.set(room.id, new Set(members));
      }
      affectedRoomIds.push(room.id);

      if (client.ws.readyState === WebSocket.OPEN) {
        const invitedMsg: WsMessage = { type: 'im.room.invited', roomId: room.id, members, name: room.name };
        const encrypted = encryptIMMessage(invitedMsg as Record<string, unknown>, this.psk);
        client.ws.send(JSON.stringify(encrypted));
      }
    }

    // Phase 2: batch presence — one broadcast per affected room
    for (const roomId of affectedRoomIds) {
      this.broadcastImPresence(roomId);
    }
  }

  /** Collect all online clientIds for a room and broadcast im.presence */
  private broadcastImPresence(roomId: string): void {
    const members = this.imRoomMembers.get(roomId);
    if (!members) return;
    const onlineUsers: string[] = [];
    for (const clientId of members) {
      const ws = this.clientIdToWs.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        onlineUsers.push(clientId);
      }
    }
    const payload: WsMessage = { type: 'im.presence', roomId, users: onlineUsers };
    const encrypted = encryptIMMessage(payload as Record<string, unknown>, this.psk);
    this.broadcastToImRoom(roomId, encrypted as WsMessage);
  }

  /** Debounced presence: batch rapid presence changes within PRESENCE_DEBOUNCE_MS */
  private schedulePresenceBroadcast(roomId: string): void {
    const existing = this.pendingPresenceBroadcasts.get(roomId);
    if (existing) clearTimeout(existing);
    this.pendingPresenceBroadcasts.set(roomId, setTimeout(() => {
      this.pendingPresenceBroadcasts.delete(roomId);
      this.broadcastImPresence(roomId);
    }, PRESENCE_DEBOUNCE_MS));
  }

  private handleDisconnect(ws: WebSocket): void {
    const client = this.clients.get(ws);
    if (!client) return;

    for (const roomId of client.subscribedRooms) {
      const roomSet = this.rooms.get(roomId);
      if (roomSet) {
        roomSet.delete(ws);
        if (roomSet.size === 0) this.rooms.delete(roomId);
      }
    }

    const agents = this.roomDB.getClientAgents(client.clientId);
    for (const agent of agents) {
      this.roomDB.deregisterAgent(agent.id);
      this.broadcastToRoom(agent.room_id, {
        type: 'agent.offline',
        agentId: agent.id,
        roomId: agent.room_id,
      });
    }

    this.clients.delete(ws);
    this.clientIdToWs.delete(client.clientId);
    LOG(`Client disconnected: ${client.clientId} (remaining ${this.clients.size})`);

    // Clean up IM room membership and broadcast presence to remaining members
    const affectedRooms: string[] = [];
    for (const [roomId, members] of this.imRoomMembers) {
      if (members.has(client.clientId)) {
        members.delete(client.clientId);
        affectedRooms.push(roomId);
      }
    }
    // Broadcast updated presence for each affected room (debounced)
    for (const roomId of affectedRooms) {
      this.schedulePresenceBroadcast(roomId);
    }
  }

  private route(ws: WebSocket, msg: WsMessage): void {
    const client = this.clients.get(ws);
    if (!client) return;

    if (msg.type.startsWith('im.')) {
      LOG(`route: type=${msg.type} from=${client.clientId}`);
    }

    if (this.taskHandler && (msg.type.startsWith('task.') || msg.type.startsWith('evaluation.'))) {
      const handled = this.taskHandler.handle(client, msg);
      if (handled) return;
    }

    switch (msg.type) {
      case 'room.create':
        this.handleRoomCreate(client, msg);
        break;
      case 'room.join':
        this.handleRoomJoin(client, msg);
        break;
      case 'room.leave':
        this.handleRoomLeave(client, msg);
        break;
      case 'room.list':
        this.handleRoomList(client);
        break;
      case 'room.dissolve':
        this.handleRoomDissolve(client, msg);
        break;
      case 'room.info':
        this.handleRoomInfo(client, msg);
        break;
      case 'agent.register':
        this.handleAgentRegister(client, msg);
        break;
      case 'agent.deregister':
        this.handleAgentDeregister(client, msg);
        break;
      case 'agent.heartbeat':
        this.handleAgentHeartbeat(client, msg);
        break;
      case 'agent.list':
        this.handleAgentList(client, msg);
        break;

      // ---- IM handlers (with concurrency guard) ----
      case 'im.send':
        if (this.imActiveCount >= MAX_IM_CONCURRENCY) {
          this.sendError(client.ws, 'Server busy, try again');
          break;
        }
        this.imActiveCount++;
        try { this.handleImSend(client, msg); } finally { this.imActiveCount--; }
        break;
      case 'im.sync':
        if (this.imActiveCount >= MAX_IM_CONCURRENCY) {
          this.sendError(client.ws, 'Server busy, try again');
          break;
        }
        this.imActiveCount++;
        try { this.handleImSync(client, msg); } finally { this.imActiveCount--; }
        break;
      case 'im.agent_delta':
      case 'im.typing':
      case 'im.file.request':
      case 'im.file.response':
      case 'im.file.ack':
        this.handleImTransparent(client, msg);
        break;
      case 'im.room.dissolved':
        this.handleImRoomDissolved(client, msg);
        break;
      case 'im.presence':
        this.handleImPresence(client, msg);
        break;
      case 'im.room.updated':
        if (this.imActiveCount >= MAX_IM_CONCURRENCY) {
          this.sendError(client.ws, 'Server busy, try again');
          break;
        }
        this.imActiveCount++;
        try { this.handleImRoomUpdated(client, msg); } finally { this.imActiveCount--; }
        break;
      case 'im.clients.search':
        this.handleClientsSearch(client, msg);
        break;

      default:
        LOG(`Unknown message type: ${msg.type} from ${client.clientId}`);
        this.sendError(ws, `Unknown message type: ${msg.type}`);
    }
  }

  // ---- Room handlers ----

  private handleRoomCreate(client: AuthedClient, msg: WsMessage): void {
    const name = msg.name as string;
    if (!name) {
      this.sendError(client.ws, 'Room name is required');
      return;
    }

    const room = this.roomDB.createRoom({
      name,
      description: msg.description as string | undefined,
      ownerId: client.clientId,
      maxAgents: msg.maxAgents as number | undefined,
      visibility: (msg.visibility as 'public' | 'private') || 'private',
    });

    this.subscribe(client, room.id);
    this.send(client.ws, { type: 'room.created', room });
  }

  private handleRoomJoin(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) {
      this.sendError(client.ws, 'Room ID is required');
      return;
    }

    const member = this.roomDB.joinRoom({
      roomId,
      clientId: client.clientId,
      displayName: (msg.displayName as string) || client.clientId,
    });

    if (!member) {
      this.sendError(client.ws, 'Cannot join room (not found, full, or already joined)');
      return;
    }

    this.subscribe(client, roomId);
    this.send(client.ws, { type: 'room.joined', roomId, member });

    this.broadcastToRoom(roomId, {
      type: 'room.member.joined',
      roomId,
      member,
    });
  }

  private handleRoomLeave(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) return;

    const left = this.roomDB.leaveRoom(roomId, client.clientId);
    if (left) {
      this.unsubscribe(client, roomId);
      this.send(client.ws, { type: 'room.left', roomId });
      this.broadcastToRoom(roomId, {
        type: 'room.member.left',
        roomId,
        clientId: client.clientId,
      });
    }
  }

  private handleRoomDissolve(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) return;

    const room = this.roomDB.getRoom(roomId);
    if (!room) {
      this.sendError(client.ws, 'Room not found');
      return;
    }
    if (room.owner_id !== client.clientId) {
      this.sendError(client.ws, 'Only owner can dissolve room');
      return;
    }

    // Check for active tasks
    if (this.taskHandler) {
      const activeStatuses: TaskStatus[] = ['dispatched', 'running', 'stopping'];
      for (const status of activeStatuses) {
        const tasks = this.taskEngine?.getRoomTasks(roomId, status);
        if (tasks && tasks.length > 0) {
          this.sendError(client.ws, 'Cannot dissolve: room has active tasks. Stop them first.');
          return;
        }
      }
    }

    this.roomDB.deactivateRoom(roomId);
    this.broadcastToRoom(roomId, { type: 'room.dissolved', roomId });
    this.rooms.delete(roomId);
  }

  private handleRoomList(client: AuthedClient): void {
    const rooms = this.roomDB.listRoomsVisibleTo(client.clientId);
    this.send(client.ws, { type: 'room.list.update', rooms });
  }

  private handleRoomInfo(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    const room = this.roomDB.getRoom(roomId);
    if (!room) {
      this.sendError(client.ws, 'Room not found');
      return;
    }
    const members = this.roomDB.getRoomMembers(roomId);
    const agents = this.roomDB.getRoomAgents(roomId);
    this.send(client.ws, { type: 'room.info.update', room, members, agents });
  }

  // ---- Agent handlers ----

  private handleAgentRegister(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    const workspace = msg.workspace as string;
    if (!roomId || !workspace) {
      this.sendError(client.ws, 'roomId and workspace are required');
      return;
    }

    if (!this.roomDB.isMember(roomId, client.clientId)) {
      this.sendError(client.ws, 'Must join room before registering agent');
      return;
    }

    const agentId = this.buildAgentId(client.clientId, workspace);
    const capabilities = (msg.capabilities as { skills: string[]; techStack: string[]; projectType: string }) || { skills: [], techStack: [], projectType: '' };

    const agent = this.roomDB.registerAgent({
      agentId,
      roomId,
      clientId: client.clientId,
      workspace,
      capabilities,
      maxConcurrent: msg.maxConcurrent as number | undefined,
      workspaceName: msg.workspaceName as string | undefined,
    });

    this.send(client.ws, { type: 'agent.registered', agent });

    this.broadcastToRoom(roomId, {
      type: 'agent.online',
      agentId: agent.id,
      roomId,
      capabilities,
    });
  }

  private handleAgentDeregister(client: AuthedClient, msg: WsMessage): void {
    const agentId = msg.agentId as string;
    const agent = this.roomDB.getAgent(agentId);
    if (!agent || agent.client_id !== client.clientId) return;

    this.roomDB.deregisterAgent(agentId);
    this.send(client.ws, { type: 'agent.deregistered', agentId });

    this.broadcastToRoom(agent.room_id, {
      type: 'agent.offline',
      agentId,
      roomId: agent.room_id,
    });
  }

  private handleAgentHeartbeat(client: AuthedClient, msg: WsMessage): void {
    const agentId = msg.agentId as string;
    const agent = this.roomDB.getAgent(agentId);
    if (!agent || agent.client_id !== client.clientId) return;

    this.roomDB.updateHeartbeat(agentId);

    const status = msg.status as string | undefined;
    if (status === 'online' || status === 'busy' || status === 'idle') {
      const mapped = status === 'idle' ? 'online' : status;
      this.roomDB.updateAgentStatus(agentId, mapped as 'online' | 'offline' | 'busy');
    }
  }

  private handleAgentList(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) {
      this.sendError(client.ws, 'roomId is required');
      return;
    }
    const agents = this.roomDB.getRoomAgents(roomId);
    this.send(client.ws, { type: 'agent.list.update', roomId, agents });
  }

  // ---- IM handlers ----

  private handleImSend(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    // Decrypt content from transmission
    const decrypted = decryptIMMessage(msg as Record<string, unknown>, this.psk);
    const content = (decrypted.content as string) || '';
    if (!roomId) {
      this.sendError(client.ws, 'roomId is required for im.send');
      return;
    }
    LOG(`im.send: from=${client.clientId}, room=${roomId}, content=${String(content).slice(0, 50)}`);

    const id = (msg.id as string) || nodeCrypto.randomUUID();
    const timestamp = (msg.timestamp as number) || Date.now();
    const seq = (msg.seq as number) || 0;
    // Validate sender: must be the client themselves or one of their agents
    const rawSender = (msg.sender as string) || client.clientId;
    const sender = rawSender === client.clientId || rawSender.startsWith(client.clientId + '/')
      ? rawSender
      : client.clientId;

    // Track sender as member of this IM room (only real clients, not agents)
    if (!sender.includes('/')) {
      this.addImRoomMember(roomId, sender);
    }
    // Also ensure the real client (owner of the agent) is tracked
    if (sender.includes('/') && sender.startsWith(client.clientId + '/')) {
      this.addImRoomMember(roomId, client.clientId);
    }

    const type = (msg.msgType as string) || (decrypted.type as string) || 'text';
    const status = (decrypted.status as string) || undefined;
    const sessionId = (decrypted.sessionId as string) || undefined;

    // Upsert into DB (insert new or update content/status for agent lifecycle)
    this.imDB.upsertMessage({
      id,
      room_id: roomId,
      sender,
      content,
      mentioned_agents: msg.mentionedAgents ? JSON.stringify(msg.mentionedAgents) : undefined,
      quote_id: (msg.quoteId as string) || undefined,
      type,
      status,
      attachments: typeof decrypted.attachments === 'string'
        ? decrypted.attachments
        : (decrypted.attachments ? JSON.stringify(decrypted.attachments) : undefined),
      session_id: sessionId,
      timestamp,
      seq,
    });

    // Broadcast full message to members (excluding sender)
    const attachments = decrypted.attachments
      ? (typeof decrypted.attachments === 'string' ? JSON.parse(decrypted.attachments as string) : decrypted.attachments)
      : undefined;
    const fullMsg: Record<string, unknown> = {
      type: 'im.message', id, roomId, sender, content,
      msgType: type, timestamp, seq, mentionedAgents: msg.mentionedAgents,
      quoteId: (msg.quoteId as string) || undefined, status, sessionId,
      attachments: attachments ? JSON.stringify(attachments) : undefined,
    };
    // Remove undefined fields
    for (const key of Object.keys(fullMsg)) {
      if (fullMsg[key] === undefined) delete fullMsg[key];
    }
    const broadcastMsg = encryptIMMessage(fullMsg, this.psk);
    this.broadcastToImRoom(roomId, broadcastMsg as WsMessage, client.clientId);
  }

  private handleImRoomDissolved(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (roomId) {
      // Forward to all remaining members BEFORE deleting membership
      const encrypted = encryptIMMessage(msg as Record<string, unknown>, this.psk);
      this.broadcastToImRoom(roomId, encrypted as WsMessage, client.clientId);
      // Remove from Hub DB and in-memory tracking
      this.imDB.deleteRoom(roomId);
      this.imRoomMembers.delete(roomId);
    }
  }

  private handleImSync(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) {
      this.sendError(client.ws, 'roomId is required for im.sync');
      return;
    }
    // Verify membership: check in-memory first, then fall back to DB
    const members = this.imRoomMembers.get(roomId);
    const isMemberInMemory = members?.has(client.clientId);
    if (!isMemberInMemory) {
      const dbRoom = this.imDB.getRoom(roomId);
      const dbMembers: string[] = dbRoom ? JSON.parse(dbRoom.members) : [];
      if (!dbMembers.includes(client.clientId)) {
        this.sendError(client.ws, 'Not a member of this room');
        return;
      }
      // Re-register in memory for future checks
      this.addImRoomMember(roomId, client.clientId);
    }
    const afterTimestamp = (msg.afterTimestamp as number) || 0;
    const messages = this.imDB.getMessagesAfter(roomId, afterTimestamp);
    LOG(`im.sync: from=${client.clientId}, room=${roomId}, after=${afterTimestamp}, found=${messages.length}`);
    // Encrypt message content for transmission
    const encryptedMessages = messages.map(m => encryptIMMessage(m as unknown as Record<string, unknown>, this.psk));
    this.send(client.ws, { type: 'im.sync', data: { roomId, messages: encryptedMessages } });
  }

  private handleImTransparent(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (roomId) {
      const encrypted = encryptIMMessage(msg as Record<string, unknown>, this.psk);
      this.broadcastToImRoom(roomId, encrypted as WsMessage, client.clientId);
    }
  }

  /**
   * Aggregate online users from all connected clients for this room,
   * then broadcast the complete presence list to all room members.
   */
  private handleImPresence(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    if (!roomId) return;
    this.schedulePresenceBroadcast(roomId);
  }

  private handleImRoomUpdated(client: AuthedClient, msg: WsMessage): void {
    const roomId = msg.roomId as string;
    const members = msg.members as string[] | undefined;
    const roomName = (msg.name as string) || '';
    if (roomId && members) {
      // Determine which members are new (not in the old set)
      const oldMembers = this.imRoomMembers.get(roomId);
      const newMemberSet = new Set(members);
      const addedMembers: string[] = [];
      if (oldMembers) {
        for (const m of members) {
          if (!oldMembers.has(m)) addedMembers.push(m);
        }
      } else {
        // No prior record — treat all as new
        addedMembers.push(...members);
      }

      LOG(`im.room.updated: room=${roomId}, members=${members.length}, added=${addedMembers.length} (${addedMembers.join(',')}) by ${client.clientId}`);

      // Update Hub-side membership tracking (in-memory)
      this.imRoomMembers.set(roomId, newMemberSet);

      // Persist room to DB so offline users can discover it on reconnect
      this.imDB.upsertRoom(roomId, roomName, members);

      // Forward to all members (including sender, so they get confirmation)
      const encrypted = encryptIMMessage(msg as Record<string, unknown>, this.psk);
      this.broadcastToImRoom(roomId, encrypted as WsMessage);

      // Send im.room.invited to newly added members (excluding sender) so they can fetch room data
      const invitedMembers = addedMembers.filter(m => m !== client.clientId);
      if (invitedMembers.length > 0) {
        const invitedMsg: WsMessage = { type: 'im.room.invited', roomId, members, name: roomName };
        const invitedEncrypted = encryptIMMessage(invitedMsg as Record<string, unknown>, this.psk);
        const data = JSON.stringify(invitedEncrypted);
        for (const memberId of invitedMembers) {
          const ws = this.clientIdToWs.get(memberId);
          if (ws && ws.readyState === WebSocket.OPEN) {
            LOG(`Sending im.room.invited to ${memberId} for room ${roomId}`);
            ws.send(data);
          } else {
            LOG(`im.room.invited: ${memberId} not online (ws=${ws ? 'readyState=' + ws.readyState : 'null'}), will invite on reconnect`);
          }
        }
      }
    }
  }

  private handleClientsSearch(client: AuthedClient, msg: WsMessage): void {
    const query = ((msg.query as string) || '').toLowerCase();
    const MAX_RESULTS = 20;
    const results: { clientId: string }[] = [];
    const seen = new Set<string>();

    // Search WS-connected clients
    for (const [, c] of this.clients) {
      if (results.length >= MAX_RESULTS) break;
      if (seen.has(c.clientId)) continue;
      seen.add(c.clientId);
      if (!query || c.clientId.toLowerCase().includes(query)) {
        results.push({ clientId: c.clientId });
      }
    }

    // Also search registered clients from DB (includes offline clients)
    if (results.length < MAX_RESULTS && this.hubDB) {
      for (const dbClient of this.hubDB.getAllClients()) {
        if (results.length >= MAX_RESULTS) break;
        const cid = dbClient.client_id;
        if (seen.has(cid)) continue;
        seen.add(cid);
        // Match against both clientId and hostname
        if (!query || cid.toLowerCase().includes(query) || dbClient.hostname.toLowerCase().includes(query)) {
          results.push({ clientId: cid });
        }
      }
    }

    this.send(client.ws, { type: 'im.clients.search', results, seq: msg.seq });
  }

  // ---- Helpers ----

  private buildAgentId(clientId: string, workspace: string): string {
    const hash = nodeCrypto.createHash('sha256').update(`${clientId}:${workspace}`).digest('hex').slice(0, 12);
    const hostname = clientId.split('@')[0] || clientId;
    return `${hostname}:${hash}`;
  }

  private subscribe(client: AuthedClient, roomId: string): void {
    client.subscribedRooms.add(roomId);
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId)!.add(client.ws);
  }

  private unsubscribe(client: AuthedClient, roomId: string): void {
    client.subscribedRooms.delete(roomId);
    const roomSet = this.rooms.get(roomId);
    if (roomSet) {
      roomSet.delete(client.ws);
      if (roomSet.size === 0) this.rooms.delete(roomId);
    }
  }

  broadcastToRoom(roomId: string, msg: WsMessage): void {
    const roomSet = this.rooms.get(roomId);
    if (!roomSet) return;
    const data = JSON.stringify(msg);
    for (const ws of roomSet) {
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(data); } catch { /* skip disconnected */ }
      }
    }
  }

  /** Broadcast a message to all connected clients, optionally excluding one */
  private broadcastToAll(msg: WsMessage, excludeWs?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const ws of this.clients.keys()) {
      if (ws === excludeWs) continue;
      if (ws.readyState === WebSocket.OPEN) {
        try { ws.send(data); } catch { /* skip disconnected */ }
      }
    }
  }

  /** Add a clientId as member of an IM room */
  private addImRoomMember(imRoomId: string, clientId: string): void {
    let members = this.imRoomMembers.get(imRoomId);
    if (!members) {
      members = new Set();
      this.imRoomMembers.set(imRoomId, members);
    }
    members.add(clientId);
  }

  /** Broadcast a message only to members of an IM room (optionally excluding one clientId) */
  private broadcastToImRoom(imRoomId: string, msg: WsMessage, excludeClientId?: string): void {
    const members = this.imRoomMembers.get(imRoomId);
    if (!members) return;
    const data = JSON.stringify(msg);
    for (const clientId of members) {
      if (clientId === excludeClientId) continue;
      const ws = this.clientIdToWs.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(data); } catch { /* skip disconnected */ }
      }
    }
  }

  sendToAgent(agentId: string, msg: WsMessage): void {
    const agent = this.roomDB.getAgent(agentId);
    if (!agent) return;
    for (const [ws, client] of this.clients) {
      if (client.clientId === agent.client_id && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(msg));
        return;
      }
    }
  }

  private send(ws: WebSocket, msg: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify(msg)); } catch { /* skip disconnected */ }
    }
  }

  private sendError(ws: WebSocket, reason: string): void {
    this.send(ws, { type: 'error', reason });
  }

  private checkStaleAgents(): void {
    const stale = this.roomDB.getStaleAgents(STALE_THRESHOLD_MS);
    if (stale.length === 0) return;

    const ids = stale.map(a => a.id);
    this.roomDB.markAgentsOffline(ids);

    for (const agent of stale) {
      this.broadcastToRoom(agent.room_id, {
        type: 'agent.offline',
        agentId: agent.id,
        roomId: agent.room_id,
      });
    }
  }

  close(): void {
    if (this.staleCheckTimer) {
      clearInterval(this.staleCheckTimer);
      this.staleCheckTimer = null;
    }
    if (this.imCleanupTimer) {
      clearInterval(this.imCleanupTimer);
      this.imCleanupTimer = null;
    }
    for (const timer of this.pendingPresenceBroadcasts.values()) {
      clearTimeout(timer);
    }
    this.pendingPresenceBroadcasts.clear();
    this.wss.close();
  }
}
