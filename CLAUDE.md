# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sman-server is a management hub for the Sman desktop application. It provides:

1. **Encrypted reporting & telemetry** — Clients send AES-256-GCM encrypted usage reports via PSK
2. **Broadcast notifications** — Push notifications to clients with read tracking
3. **Application updates** — Upload/publish updates for Electron auto-updater
4. **WebSocket Hub** — Real-time room collaboration, IM messaging, task coordination, agent management
5. **mTLS authentication** — Certificate-based client auth with self-hosted CA (CSR signing, renewal, revocation)
6. **Account & Ledger system** — Double-entry ledger with control flags, limits, circuit breaker
7. **Skill auto-updater scheduler** — Pull-model skill update dispatch via report response
8. **React admin dashboard** — i18n (zh-CN/en-US), dark/light theme, 12 tab modules

## Commands

```bash
# Development (starts API on :5882 and admin UI on :4000)
bash dev.sh

# Or run individually:
pnpm dev                    # API server via tsx (no compile step)
cd web && pnpm dev          # Vite dev server with proxy to backend

# Build everything (server TS → dist/, web → dist/public/)
pnpm build

# Build individually
pnpm build:server           # tsc only
pnpm build:web              # Vite build only

# Tests
pnpm test                   # vitest run (single execution)
pnpm test:watch             # vitest in watch mode
```

## Environment Setup

Copy `.env.example` to `.env`. Required variables:
- `SMAN_PSK` — 32-character pre-shared key for AES-256-GCM (server refuses to start if missing or wrong length)
- `ADMIN_TOKEN` — bearer token for admin API auth
- `PORT` — server port (default: 5882)
- `TLS_ENABLED` — enable HTTPS + mTLS (default: true, set `false` to disable)

Package manager is **pnpm** for both server and web.

## Architecture

**Stack:** Express 5 + better-sqlite3 (WAL mode, no ORM, raw SQL) + ws (WebSocket) + React 19 + Zustand + Vite. ESM throughout (`"type": "module"` in both package.json files). TypeScript imports use `.js` extensions.

### Server (`src/`)

Core modules:

| File | Responsibility |
|------|---------------|
| `index.ts` | Express app setup, env validation, route mounting, HTTPS/mTLS server, static serving, SPA fallback |
| `db.ts` | `HubDB` — clients, reports, broadcasts, read_log, settings, downloads, page views |
| `db-rooms.ts` | `RoomDB` — rooms, members, agents (collaboration rooms) |
| `db-tasks.ts` | `TaskDB` — tasks, task_events, evaluation_reports, task_assignments |
| `db-im.ts` | `IMDB` — IM rooms, messages (auto-cleanup >7 days) |
| `db-certs.ts` | `CertDB` — mTLS client certificates (active/revoked) |
| `db-accounts.ts` | `AccountDB` — accounts, identities, transactions, limits, control configs |
| `crypto.ts` | AES-256-GCM encrypt/decrypt. Wire format: base64(IV + ciphertext + authTag) |
| `im-crypto.ts` | IM-specific message encrypt/decrypt |
| `ca.ts` | Self-hosted CA: init, server cert generation, CSR signing, renewal, CRL |
| `ws-server.ts` | `WsHub` — WebSocket hub: PSK + mTLS auth, rooms, agents, IM, presence, stale detection |
| `ws-task-handler.ts` | WebSocket task message routing (evaluation, dispatch, progress, completion) |
| `task-engine.ts` | `TaskEngine` — task lifecycle: create → evaluate → confirm → dispatch → run → complete/fail, auto-confirm & auto-dispatch |
| `ledger-engine.ts` | `LedgerEngine` — double-entry transfer pipeline: circuit breaker → validate → idempotency → control flags → limits → balance → execute |
| `account-engine.ts` | `AccountEngine` — account CRUD operations |
| `skill-scheduler.ts` | `SkillScheduler` — pull-model skill update dispatch, ticks at scheduled time, queues commands in report response |
| `control-engine.ts` | Control config evaluation for account operations |
| `limit-engine.ts` | Rate/amount limit checking (time + counterparty dimensions) |
| `control-flags.ts` | Account control flag parsing (debit/credit/frozen/config/limit) |
| `circuit-breaker.ts` | Circuit breaker for ledger fault tolerance |
| `reject-codes.ts` | Structured reject code definitions for transfer pipeline |
| `types.ts` | Shared TypeScript interfaces (reports, broadcasts, rooms, agents, tasks, WS messages) |
| `account-types.ts` | Account/transaction/limit/control TypeScript types |

Route modules:

| File | Routes | Auth |
|------|--------|------|
| `routes/report.ts` | `POST /api/report` | PSK encrypted |
| `routes/broadcast.ts` | `POST /api/broadcasts`, `POST /api/ack` | PSK encrypted |
| `routes/admin.ts` | `/admin/*` stats, clients, broadcasts CRUD, uploads, publish | Bearer token |
| `routes/rooms.ts` | `/admin/rooms/*` room management | Bearer token |
| `routes/tasks.ts` | `/admin/tasks/*` task management | Bearer token |
| `routes/hub-api.ts` | `/api/hub/*` rooms, agents, tasks, evaluations, stardom/hub dev-mode | PSK encrypted |
| `routes/auth.ts` | `/api/auth/*` cert enrollment (CSR), renewal, CA cert fetch | Public + mTLS |
| `routes/accounts.ts` | `/api/accounts/*` balance, transfer, history | PSK encrypted |
| `routes/admin-accounts.ts` | `/admin/accounts/*` account management, topup, freeze, limits | Bearer token |

Route modules export factory functions: `createXRouter(deps)` — dependencies are injected, no global state.

### Admin Dashboard (`web/src/`)

React SPA with no routing library (tab switching via state). No CSS framework (hand-written CSS with custom properties). **Zustand** for state management (auth, theme). **i18n** with zh-CN / en-US locales (JSON dicts). Token auth stored in `localStorage` under `sman-admin-token`. Vite dev server on port 4000 proxies `/admin` to the API server.

Tab components: DashboardTab, ClientsTab, BroadcastsTab, UploadTab, RoomsTab, AgentsTab, TasksTab, ErrorsTab, FeedbacksTab, AnalyticsTab, SkillSchedulerTab, LeaderboardTab.

### Data Flow

1. **Reports**: Clients send encrypted reports → server decrypts with PSK → upserts client record + inserts report row → returns pending skill scheduler commands
2. **WebSocket**: Clients connect via WSS (mTLS auto-auth or PSK auth message) → join rooms → register agents → send/receive IM messages (encrypted) → coordinate tasks
3. **Broadcasts**: Clients fetch encrypted broadcasts and ack reads
4. **Accounts**: PSK-encrypted client routes for balance/transfer; bearer token admin routes for management
5. **Updates**: Admin uploads files → publishes `latest.yml` → Electron auto-updater downloads from `/updates/sman/` or friendly URLs (`/download/windows-x64`, `/download/macos-arm`)

### Key Patterns

- Client API uses encrypted envelopes: `{ payload, timestamp, pskVersion }` with 5-min replay protection
- Client records use upsert (INSERT ON CONFLICT DO UPDATE)
- Broadcasts use soft delete (`active` flag)
- Admin routes all require `Authorization: Bearer <ADMIN_TOKEN>`
- WebSocket supports both PSK auth and mTLS auto-authentication
- IM messages use separate encrypt/decrypt (`im-crypto.ts`)
- IM presence is debounced (150ms) to batch rapid changes
- IM concurrency guard (max 20 concurrent message processing)
- Task lifecycle: draft → evaluating → confirmed → dispatched → running → completed/failed (with auto-confirm & auto-dispatch)
- Ledger uses circuit breaker + control flags + limit checks + double-entry bookkeeping
- Skill scheduler uses pull model: queues commands → client fetches on next report heartbeat
- Tests create a temp database in `os.tmpdir()` per test file
- Update files served from `data/updates/sman/`, supports `_redirects/` for external URLs
- Public static pages from `data/pages/` (no auth, LAN accessible)
- Graceful shutdown: SIGTERM/SIGINT → stop scheduler → close WS → close DBs

## Packaging (Windows x64 deploy)

目标机器: Windows x64，无需预装 Node.js。打包产物为自包含 zip，内含 `node.exe` + 应用代码 + 依赖。

### 一键打包

```bash
git pull && bash pack.sh
```

`pack.sh` 自动完成：x64 Node 切换 → 安装依赖 → 构建 → 准备 staging → 验证（架构/符号链接/模块加载）→ 打 zip。

版本号格式：`26.MDD.HH`（年.月日.小时），自动取当前时间，月份去掉前导0。产物如 `sman-server-26.513.10.zip`。

### 一键部署到 smancode.com

部署脚本在 `deploy-private/` 目录中（已 gitignore，包含服务器地址、SSH 密钥等敏感信息）。

```bash
bash deploy-private/deploy-smancode.sh
```

如果需要部署，先读取 `deploy-private/` 目录下的脚本了解部署流程和服务器信息，再执行。通过 `ssh h5`（app 用户）和 `ssh h5-root`（root 用户）连接服务器，这些别名定义在本地 `~/.ssh/config` 中。

### 手动打包步骤（备用）

开发机是 ARM64 Windows，需要切换到 x64 Node 来获取正确的原生模块（better-sqlite3）。

```bash
# 1. 拉取最新代码
git pull

# 2. 切换到 x64 Node（开发机通过 fnm 管理）
eval "$(fnm env)" && fnm use 22 --arch x64

# 3. 安装服务端依赖（获取 x64 原生模块）
rm -rf node_modules && pnpm install

# 4. 安装 web 依赖（需要 x64 的 rollup）
cd web && rm -rf node_modules && pnpm install && pnpm add -D @rollup/rollup-win32-x64-msvc && cd ..

# 5. 构建（设置目标环境变量）
SMAN_UPDATE_URL=<目标更新URL> SMAN_HUB_URL=<目标Hub URL> pnpm build

# 6. 准备打包目录
mkdir -p staging2/sman-server
# - 复制 dist/、node.exe、.env.example、start.sh、package.json（仅含生产依赖）
# - 安装生产依赖: pnpm install --prod --shamefully-hoist
# - 覆盖 x64 的 better_sqlite3.node（pnpm 可能下载了 ARM64 版）
# - 将 node_modules 中所有符号链接解析为实际文件（Windows 解压符号链接会报权限错误）

# 7. 打包为真正的 zip（不要用 tar -a，Windows 资源管理器会报格式警告）
cd staging2 && npx bestzip ../sman-server-<版本号>.zip sman-server/
```

### 打包产物验证清单

每次打包后必须检查以下项：

1. **关键文件完整**: `dist/index.js`, `dist/public/index.html`, `dist/routes/*.js`, `start.sh`, `.env.example`, `package.json`
2. **node.exe 架构**: PE Machine 必须是 `0x8664`（x64），不是 `0xAA64`（ARM64）
3. **better_sqlite3.node 架构**: 同样必须是 x64
4. **无符号链接**: `node_modules` 中递归搜索不得存在任何符号链接（Windows zip 解压会报 "客户端没有所需的特权"）
5. **模块加载测试**: 在 staging 目录中运行 `./node.exe -e "import('better-sqlite3')..."` 验证三个核心模块（better-sqlite3, express, dotenv）都能正常加载
6. **start.sh 内容**: 必须用 `./node.exe`（自带），环境变量 `SMAN_UPDATE_URL` 和 `SMAN_HUB_URL` 已内置
7. **zip 格式**: 必须是真正的 zip，不能用 tar（Windows 资源管理器无法直接打开 tar）

### 已踩过的坑

- **ARM64 开发机 vs x64 目标**: better-sqlite3 有原生 .node 二进制，必须用 x64 Node 安装才能拿到 x64 版本
- **pnpm 符号链接**: pnpm 用符号链接做依赖隔离，Windows zip 解压时会报权限错误，必须展开为实际文件
- **pnpm --shamefully-hoist**: 即使加了此选项，Windows 上 top-level 仍是 junction/symlink，需要额外解析
- **tar -a 不是真 zip**: `tar -a -c -f xxx.zip` 生成的是 tar 格式，Windows 资源管理器会报警告
- **xcopy dist/**: staging 里容易漏掉 dist/ 目录，每次都要验证
- **express 间接依赖**: pnpm 严格隔离下 body-parser 等间接依赖不可见，需要 shamefully-hoist
