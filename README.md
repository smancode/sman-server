<div align="center">

# Sman Server

**Management hub for the Sman desktop application.**

Collects encrypted usage reports, manages broadcast notifications, serves application updates, and provides a React admin dashboard.

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

Upload and publish application updates (`.exe`, `.dmg`, `.blockmap`, `.yml`). Auto-generates `latest.yml` for Electron auto-updater.

### Admin Dashboard

React SPA with token-based authentication. Manage broadcasts, view clients and stats, upload files — all from a browser.

---

## Architecture

```
Sman Desktop Client
        │  (AES-256-GCM encrypted)
        ▼
Sman Server (Express 5 + SQLite)
   ├── POST /api/report       ← Client usage reports
   ├── POST /api/broadcasts   ← Fetch new broadcasts
   ├── POST /api/ack          ← Mark broadcasts as read
   └── /admin/*               ← Admin dashboard & API
           │
           ▼
      React Admin SPA
```

**Stack:** Express 5 + better-sqlite3 (WAL mode) + React 19 + Vite. ESM throughout. No ORM, raw SQL.

---

## Getting Started

### Prerequisites

- [Node.js 22 LTS](https://nodejs.org/)
- [pnpm](https://pnpm.io/)

### Install & Run

```bash
git clone https://github.com/smancode/sman-server.git
cd sman-server
cp .env.example .env   # Edit with your PSK and ADMIN_TOKEN
pnpm install
pnpm dev
```

This starts the API server on `:5882` and the admin UI dev server on `:4000`.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PSK` | Yes | 32-character pre-shared key for AES-256-GCM |
| `ADMIN_TOKEN` | Yes | Bearer token for admin API authentication |
| `PORT` | No | Server port (default: 5882) |
| `PSK_VERSION` | Yes | Must be `1` |

---

## Development

### Dev Mode

```bash
pnpm dev              # API server via tsx (hot reload)
cd web && pnpm dev    # Vite dev server with proxy to backend
```

### Production Build

```bash
pnpm build            # Build server (tsc) + web (Vite)
```

### Run Tests

```bash
pnpm test             # vitest run
pnpm test:watch       # Watch mode
```

### Windows Deployment

```bash
bash pack.sh                    # One-click: build + package as self-contained zip
bash deploy-smancode.sh         # One-click: build + deploy to smancode.com
```

---

## Project Structure

```
sman-server/
├── src/
│   ├── index.ts          # Express app setup, route mounting
│   ├── db.ts             # HubDB — SQLite operations
│   ├── crypto.ts         # AES-256-GCM encrypt/decrypt
│   ├── types.ts          # Shared TypeScript interfaces
│   └── routes/
│       ├── report.ts     # POST /api/report
│       ├── broadcast.ts  # POST /api/broadcasts, /api/ack
│       └── admin.ts      # /admin/* (CRUD, stats, upload)
├── web/src/              # React admin dashboard
├── tests/                # Vitest test files
└── data/                 # SQLite DB + update files
```

---

## Ports

| Port | Purpose |
|------|---------|
| 5882 | API server (production) |
| 4000 | Vite dev server (development only) |

---

## Contributing

We welcome contributions! Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Security

Found a vulnerability? Please see [SECURITY.md](./SECURITY.md) for responsible disclosure.

## License

Sman Server is released under the [MIT License](./LICENSE).
