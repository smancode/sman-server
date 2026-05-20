---
smanVersion: "1.0.0"
initializedAt: "2026-05-19T01:25:17.622Z"
---

# Project Init

**Type:** node, fullstack
**Tech Stack:** Express 5, better-sqlite3 (raw SQLite, WAL mode, no ORM), React 19, Vite, TypeScript, Vitest, AES-256-GCM encryption, pnpm
**Summary:** Sman-server is an encrypted telemetry and update management hub for the Sman desktop application, featuring AES-256-GCM encrypted client communication, broadcast notification system with read tracking, and a React-based admin dashboard.
**Description:** Sman-server serves as the central management platform for Sman desktop clients, collecting encrypted usage reports via AES-256-GCM, managing broadcast notifications with many-to-many read tracking, serving application updates, and providing a React 19 admin dashboard. It uses Express 5 with better-sqlite3 (WAL mode, raw SQL without ORM) for storage, packages as a self-contained Windows x64 zip with bundled node.exe, and deploys to smancode.com.
**Files:** 41
**Git:** yes
**CLAUDE.md:** existing

## Injected Skills
- changelog-generator
- careful
- cso
- guard
- investigate
- review
- ship

## Match Reasons
- **changelog-generator**: AI 推荐能力
- **careful**: AI 推荐能力
- **cso**: AI 推荐能力
- **guard**: AI 推荐能力
- **investigate**: AI 推荐能力
- **review**: AI 推荐能力
- **ship**: AI 推荐能力

## Scan History

### 2026-05-20T19:12:54Z (Commit: 60687534)
**Mode:** 增量更新

**Project Knowledge Skills 更新:**
- ✅ project-structure: 新增成就排行榜系统、Hub Dev Mode 功能
- ✅ project-apis: 新增 7 个端点（achievement-report, leaderboard, hub-dev-mode 等）
- ✅ project-external-calls: 新增 2 张数据库表、成就排行榜查询操作
- ✅ database-schema: 表数从 13 → 15，新增 achievement_leaderboard 相关表

**Team Knowledge 聚合:**
- ✅ knowledge-business: 验证 3 条（2 已验证，1 待验证）
- ✅ knowledge-conventions: 验证 4 条（全部已验证）
- ✅ knowledge-technical: 验证 4 条（全部已验证）

**关键变更:**
- 新增: 成就排行榜系统（clients 可上报成就数据，管理员可查看排行榜）
- 新增: Hub Dev Mode 开关（类似 Stardom Dev Mode）
- 数据库: 新增 2 张表（achievement_leaderboard, achievement_leaderboard_log）
