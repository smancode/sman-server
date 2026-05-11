# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sman-server is a management hub for the Sman desktop application. It collects encrypted usage reports from remote clients, manages broadcast notifications, serves application updates, and provides a React admin dashboard. All client-to-server communication is encrypted with AES-256-GCM using a pre-shared key.

## Commands

```bash
# Development (starts both API on :5882 and admin UI on :4000)
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
- `PSK` — 32-character pre-shared key for AES-256-GCM (server refuses to start if missing or wrong length)
- `ADMIN_TOKEN` — bearer token for admin API auth
- `PORT` — server port (default: 5882)
- `PSK_VERSION` — must be `1`

Package manager is **pnpm** for both server and web.

## Architecture

**Stack:** Express 5 + better-sqlite3 (WAL mode, no ORM, raw SQL) + React 19 + Vite. ESM throughout (`"type": "module"` in both package.json files). TypeScript imports use `.js` extensions.

### Server (`src/`)

- `index.ts` — Express app setup, env validation, route mounting, static file serving, SPA fallback (localhost-only in production)
- `db.ts` — `HubDB` class wrapping all SQLite operations. Four tables: `clients` (upsert on report), `reports`, `broadcasts` (soft delete via `active` flag), `read_log` (many-to-many client↔broadcast)
- `crypto.ts` — AES-256-GCM encrypt/decrypt. Wire format: base64(IV + ciphertext + authTag)
- `types.ts` — Shared TypeScript interfaces
- `routes/report.ts` — `POST /api/report` (encrypted client usage report, 5-min timestamp window for replay protection)
- `routes/broadcast.ts` — `POST /api/broadcasts` (fetch new broadcasts) and `POST /api/ack` (mark broadcasts as read)
- `routes/admin.ts` — All `/admin/*` routes (bearer token auth). CRUD for broadcasts, client listing, stats, file upload, publish endpoint for generating `latest.yml`

Route modules export factory functions: `createXRouter(db, psk)` — dependencies are injected, no global state.

### Admin Dashboard (`web/src/`)

React SPA with no routing library (tab switching via state). No CSS framework (hand-written CSS with custom properties). Token auth stored in `localStorage` under `sman-admin-token`. Vite dev server on port 4000 proxies `/admin` to the API server.

### Data Flow

Clients send encrypted reports → server decrypts with PSK → upserts client record + inserts report row. Clients fetch broadcasts (encrypted response) and ack reads. Admin dashboard authenticates via bearer token and manages broadcasts/uploads through `/admin/*` endpoints.

### Key Patterns

- Client API uses encrypted envelopes: `{ payload, timestamp, pskVersion }` with replay protection
- Client records use upsert (INSERT ON CONFLICT DO UPDATE)
- Broadcasts use soft delete (`active` flag)
- Admin routes all require `Authorization: Bearer <ADMIN_TOKEN>`
- Tests create a temp database in `os.tmpdir()` per test file
- Update files (`.exe`, `.dmg`, `.yml`, `.blockmap`) served from `data/updates/sman/`

## Packaging (Windows x64 deploy)

目标机器: Windows x64，无需预装 Node.js。打包产物为自包含 zip，内含 `node.exe` + 应用代码 + 依赖。

### 打包步骤

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

# 5. 构建（带部署环境变量）
SMAN_UPDATE_URL=http://TARGET_HOST:PORT/updates/sman \
SMAN_HUB_URL=http://TARGET_HOST:PORT \
pnpm build

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
