<div align="center">

# Sman Server

**Management hub for the Sman desktop application.**

Collects encrypted usage reports, manages broadcast notifications, serves application updates, provides real-time WebSocket collaboration (rooms, IM, tasks, agents), mTLS certificate authentication, a double-entry ledger system, and a React admin dashboard.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Issues](https://img.shields.io/github/issues/smancode/sman-server)](https://github.com/smancode/sman-server/issues)

[Getting Started](#getting-started) · [Architecture](#architecture) · [Development](#development) · [Contributing](./CONTRIBUTING.md) · [Security](./SECURITY.md)

</div>

---

## Features

### Encrypted Client Reports

Clients send AES-256-GCM encrypted usage reports with replay protection (5-min timestamp window). Server decrypts with a pre-shared key, upserts client records, and stores reports in SQLite.

### Broadcast Notifications

Push notifications to clients with read tracking. Broadcasts use soft delete and are delivered encrypted.

### Application Updates

Upload and publish application updates (`.exe`, `.dmg`, `.blockmap`, `.yml`). Auto-generates `latest.yml` for Electron auto-updater. Friendly download URLs (`/download/windows-x64`, `/download/macos-arm`).

### WebSocket Hub

Real-time collaboration via WebSocket (WSS):
- **Rooms** — Create, join, dissolve collaboration rooms with password protection
- **Agents** — Register workspace agents with capabilities, heartbeat-based presence
- **IM** — Encrypted instant messaging with room management, file transfer, typing indicators, presence tracking
- **Tasks** — Full task lifecycle: create → evaluate → confirm → dispatch → run → complete/fail, with auto-confirm & auto-dispatch

Supports both PSK and mTLS authentication for WebSocket connections.

### mTLS Authentication

Self-hosted Certificate Authority (CA) for client certificate management:
- CA initialization with self-signed root certificate
- Server TLS certificate generation (auto-renewal)
- Client CSR signing and certificate renewal
- Certificate revocation and CRL generation

### Account & Ledger System

Double-entry ledger with enterprise-grade controls:
- **Ledger Engine** — Atomic transfers with circuit breaker, idempotency, control flags, rate/amount limits
- **Control Engine** — Configurable debit/credit/transfer controls with whitelist/blacklist
- **Limit Engine** — Time-based and counterparty-based rate limiting
- **Circuit Breaker** — Fault tolerance for the transfer pipeline

### Skill Auto-Updater Scheduler

Pull-model skill update dispatch: scheduler queues commands at scheduled time, clients fetch and execute on next report heartbeat.

### Admin Dashboard

React SPA with i18n (zh-CN / en-US), dark/light theme, 12 tab modules:
Dashboard, Clients, Broadcasts, Upload, Analytics, Errors, Feedbacks, Leaderboard, Rooms, Agents, Tasks, Skill Scheduler.

Token-based authentication with Zustand state management.

---

## Architecture

```
Sman Desktop Client
        │  (AES-256-GCM encrypted / mTLS)
        ▼
Sman Server (Express 5 + SQLite + WebSocket)
   ├── POST /api/report         ← Client usage reports (+ skill commands)
   ├── POST /api/broadcasts     ← Fetch new broadcasts
   ├── POST /api/ack            ← Mark broadcasts as read
   ├── /api/auth/*              ← mTLS cert enrollment & renewal
   ├── /api/hub/*               ← Rooms, agents, tasks, evaluations (PSK)
   ├── /api/accounts/*          ← Balance, transfer, history (PSK)
   ├── /ws                      ← WebSocket Hub (rooms, IM, tasks, agents)
   └── /admin/*                 ← Admin dashboard & API (bearer token)
           │
           ▼
      React Admin SPA (i18n + dark mode)
```

**Stack:** Express 5 + better-sqlite3 (WAL mode) + ws (WebSocket) + React 19 + Zustand + Vite. ESM throughout. No ORM, raw SQL.

**Databases** (SQLite, one per domain):
`hub.db` (clients, reports, broadcasts, settings) · `rooms.db` · `tasks.db` · `im.db` · `certs.db` · `accounts.db`

---

## Getting Started

### Prerequisites

- [Node.js 22 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- OpenSSL (for mTLS certificate management)

### Install & Run

```bash
git clone https://github.com/smancode/sman-server.git
cd sman-server
cp .env.example .env   # Edit with your PSK and ADMIN_TOKEN
pnpm install
bash dev.sh            # Starts API :5882 + Admin UI :4000
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SMAN_PSK` | Yes | 32-character pre-shared key for AES-256-GCM |
| `ADMIN_TOKEN` | Yes | Bearer token for admin API authentication |
| `PORT` | No | Server port (default: 5882) |
| `TLS_ENABLED` | No | Enable HTTPS + mTLS (default: true) |
| `SKILL_SCHEDULE_HOUR` | No | Skill scheduler hour (default: 3) |
| `SKILL_SCHEDULE_MINUTE` | No | Skill scheduler minute (default: 3) |
| `HUB_DATA_DIR` | No | Data directory (default: `./data`) |

---

## Development

### Dev Mode

```bash
bash dev.sh              # API server + Admin UI (auto-kills existing processes)
# Or individually:
pnpm dev                 # API server via tsx (hot reload)
cd web && pnpm dev       # Vite dev server with proxy to backend
```

### Production Build

```bash
pnpm build              # Build server (tsc) + web (Vite)
```

### Run Tests

```bash
pnpm test               # vitest run
pnpm test:watch         # Watch mode
```

### Windows Deployment

```bash
bash pack.sh                                # One-click: build + package as self-contained zip
bash deploy-private/deploy-smancode.sh      # One-click: deploy to smancode.com
```

---

## Project Structure

```
sman-server/
├── src/
│   ├── index.ts              # Express app, HTTPS/mTLS server, route mounting
│   ├── db.ts                 # HubDB — clients, reports, broadcasts, settings
│   ├── db-rooms.ts           # RoomDB — rooms, members, agents
│   ├── db-tasks.ts           # TaskDB — tasks, events, evaluations, assignments
│   ├── db-im.ts              # IMDB — IM rooms, messages
│   ├── db-certs.ts           # CertDB — mTLS certificates
│   ├── db-accounts.ts        # AccountDB — accounts, transactions, limits
│   ├── crypto.ts             # AES-256-GCM encrypt/decrypt
│   ├── im-crypto.ts          # IM message encrypt/decrypt
│   ├── ca.ts                 # Self-hosted CA (init, sign, renew, CRL)
│   ├── ws-server.ts          # WsHub — WebSocket hub
│   ├── ws-task-handler.ts    # WebSocket task message routing
│   ├── task-engine.ts        # Task lifecycle management
│   ├── ledger-engine.ts      # Double-entry ledger pipeline
│   ├── account-engine.ts     # Account CRUD
│   ├── skill-scheduler.ts    # Skill auto-update scheduler
│   ├── control-engine.ts     # Control config evaluation
│   ├── limit-engine.ts       # Rate/amount limit checking
│   ├── control-flags.ts      # Control flag parsing
│   ├── circuit-breaker.ts    # Circuit breaker for fault tolerance
│   ├── reject-codes.ts       # Structured reject codes
│   ├── types.ts              # Shared interfaces (reports, rooms, tasks, WS)
│   ├── account-types.ts      # Account/transaction/limit types
│   └── routes/
│       ├── report.ts         # POST /api/report
│       ├── broadcast.ts      # POST /api/broadcasts, /api/ack
│       ├── admin.ts          # /admin/* stats, clients, broadcasts, uploads
│       ├── rooms.ts          # /admin/rooms/*
│       ├── tasks.ts          # /admin/tasks/*
│       ├── hub-api.ts        # /api/hub/* rooms, agents, tasks, evals
│       ├── auth.ts           # /api/auth/* mTLS cert enrollment
│       ├── accounts.ts       # /api/accounts/* balance, transfer
│       └── admin-accounts.ts # /admin/accounts/* management
├── web/src/
│   ├── App.tsx               # Main app with 12-tab navigation
│   ├── api.ts                # Admin API client
│   ├── components/           # 12 tab components + TokenScreen
│   ├── stores/               # Zustand stores (auth, theme)
│   ├── locales/              # i18n (zh-CN.json, en-US.json)
│   └── lib/                  # Utilities
├── tests/                    # Vitest test files
└── data/                     # SQLite DBs + TLS certs + updates + pages
```

---

## Ports

| Port | Purpose |
|------|---------|
| 5882 | API server + WebSocket (HTTPS in production) |
| 4000 | Vite dev server (development only) |

---

## Contributing

We welcome contributions! Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

Found a vulnerability? Please see [SECURITY.md](./SECURITY.md) for responsible disclosure.

## License

Sman Server is released under the [MIT License](./LICENSE).
