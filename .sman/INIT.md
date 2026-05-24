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

### 2026-05-25T00:00:00Z (Commit: d76da6e3)
**Mode:** 增量更新

**Project Knowledge Skills 更新:**
- ✅ project-structure: 新增 IM 房间管理系统、并发控制、去抖动优化、集成测试
- ✅ project-apis: 新增 3 个 WebSocket 消息类型（im.room.invited/updated/dissolved），增强 im.send/im.sync/im.presence
- ✅ project-external-calls: 增强 WebSocket 服务（房间管理、并发控制、性能优化）
- ✅ database-schema: 新增 5 张表（im_rooms + 任务管理相关表），表数 24 → 28

**Team Knowledge 聚合:**
- ✅ knowledge-business: 同步更新（无新贡献）
- ✅ knowledge-conventions: 同步更新（无新贡献）
- ✅ knowledge-technical: 同步更新（无新贡献）

**关键变更:**
- 新增: IM 房间管理系统（im_rooms 表、成员追踪、离线恢复）
- 新增: WebSocket 消息 upsert 能力（支持 agent lifecycle: running→completed）
- 新增: 任务管理系统（tasks、task_events、task_assignments、evaluation_reports 4 张表）
- 增强: 并发控制（最多 20 个并发 IM 操作）
- 增强: Presence 广播去抖动（150ms 窗口）
- 新增: IM 端到端集成测试（tests/im-integration.test.ts，954 行）
- 数据库: im_messages 新增 seq 列（消息排序）

**Git 提交:** bfeee56（本地提交，push 因网络问题暂未推送）

### 2026-05-21T19:18:35Z (Commit: 312f64fb)
**Mode:** 增量更新

**Project Knowledge Skills 更新:**
- ✅ project-structure: 新增 IM 系统（db-im.ts、rooms、WebSocket 路由）
- ✅ project-apis: 新增 7 个 WebSocket 消息类型（im.send, im.sync, im.message 等）
- ✅ project-external-calls: 新增 IMDB 数据库、增强 WebSocket 服务
- ✅ database-schema: 表数从 15 → 19，新增 im_messages, rooms, room_members 相关表

**Team Knowledge 聚合:**
- ✅ knowledge-business: 同步更新（无新贡献）
- ✅ knowledge-conventions: 同步更新（无新贡献）
- ✅ knowledge-technical: 同步更新（无新贡献）

**关键变更:**
- 新增: 实时协作和即时通讯系统（Room-based IM、消息持久化、7天自动清理）
- 新增: Agent 工作区注册和发现（workspace_name 字段、能力声明）
- 数据库: 新增 4 张表（im_messages, rooms, room_members, agents 扩展）
- 架构: 第 4 个数据库（data/im.db），独立于主 hub DB

### 2026-05-23T00:00:00Z (Commit: 5e4e0b43)
**Mode:** 增量更新

**Project Knowledge Skills 更新:**
- ✅ project-structure: 新增 IM 加密模块（im-crypto.ts）、PSK 加载重构、客户端搜索功能
- ✅ project-apis: 新增 1 个 WebSocket 消息类型（im.clients.search），总计 60 个 HTTP 端点、39 个 WebSocket 消息
- ✅ project-external-calls: 增强 IM 消息加密、PSK 环境变量支持、WebSocket 客户端发现
- ✅ database-schema: 表数保持 19 张，im_messages 表新增 seq 列（消息排序）、achievement_leaderboard 新增 dimension_scores 列

**Team Knowledge 聚合:**
- ✅ knowledge-business: 验证 2 条（全部已验证）
- ✅ knowledge-conventions: 验证 1 条（前端卡片组件约定，已验证）
- ✅ knowledge-technical: 验证 2 条（路由分布、WebSocket 认证，已验证）

**关键变更:**
- 🔴 BREAKING: PSK 加载逻辑从 index.ts 内联重构为 crypto.ts 的 loadPsk() 函数，支持环境变量 SMAN_PSK
- 🔴 BREAKING: IM 消息新增加密传输（enc: 前缀），向后兼容未加密消息
- ⚠️ MIGRATION: im_messages 表新增 seq 列（自动迁移，默认值为 0）
- ⚠️ MIGRATION: achievement_leaderboard 表新增 dimension_scores 列（自动迁移）
- 新增: WebSocket 客户端搜索功能（im.clients.search），支持大小写不敏感的 clientId 子串搜索
- 优化: IM 消息同步改进，基于序列号排序提升可靠性

### 2026-05-24T00:00:00Z (Commit: 13532222)
**Mode:** 增量更新

**Project Knowledge Skills 更新:**
- ✅ project-structure: WsHub 构造函数新增 hubDB 参数（支持查询离线客户端）
- ✅ project-apis: 增强 im.clients.search 功能（支持离线客户端搜索）
- ✅ project-external-calls: WsHub 新增 HubDBLike 接口依赖
- ✅ database-schema: 无变更（仅代码层改动）

**Team Knowledge 聚合:**
- ✅ knowledge-business: 同步更新（无新贡献）
- ✅ knowledge-conventions: 同步更新（无新贡献）
- ✅ knowledge-technical: 验证 2 条（全部已验证：技术栈、健康检查端点）

**关键变更:**
- 🔴 BREAKING: WsHub 构造函数签名变更（新增 hubDB 参数）
- 新增: HubDBLike 接口（含 getAllClients() 方法）
- 增强: im.clients.search 现在返回在线+离线客户端（最多 20 条）
- 修复: IM 消息字段读取错误（从 decrypted 而非 msg 读取）

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
