---
name: knowledge-technical
description: "Technical architecture for sman-server. Verified against code."
_scanned:
  commitHash: d76da6e344e1f66d3c5acec32502380c83ce5a68
  scannedAt: "2026-05-25T00:00:00.000Z"
  branch: "master"
---

# Technical Architecture

> 贡献者: nasakim | 验证时间: 2026-05-23

## 技术栈
> by nasakim | 验证: 2026-05
✅ [已验证] package.json:L14-L18, web/package.json:L10-L12
- 后端：Express 5 + better-sqlite3
- 前端：React 19 + Vite
- 加密：AES-256-GCM

## 加密方案
> by nasakim | 验证: 2026-05
✅ [已验证] src/crypto.ts:L3-L27, src/routes/report.ts:L7, L33-L35
- 预共享密钥(PSK) 32 字符
- 时间戳防重放（5 分钟时间窗：`REPLAY_WINDOW_MS = 5 * 60 * 1000`）
- Wire format：base64(IV + ciphertext + authTag)，IV 12 字节，authTag 16 字节

## 安全约束
> by nasakim | 验证: 2026-05
✅ [已验证] src/index.ts:L26-L34, L39-L42, L245-L253
- PSK 强制 32 字符（启动校验）：`process.env.SMAN_PSK.length === 32`
- 管理接口强制 Bearer Token：`ADMIN_TOKEN` 必需
- 生产 SPA 仅 localhost 访问：静态文件服务无额外限制（需依赖反向代理）

## 打包目标
> by nasakim | 验证: 2026-05
✅ [已验证] pack.sh:L10-L13
- Windows x64 自包含（内置 `node.exe`）
- ARM64 开发机需切 x64 Node：`fnm use 22 --arch x64`
- pnpm 符号链接需展开（Windows zip 解压权限问题）
- 用 bestzip 非 tar（`tar -a` 生成 tar 格式，Windows 资源管理器无法直接打开）

## sman-server 路由文件分布
> by nasakim | 验证: 2026-05
✅ [已验证] src/routes/:1-15
- **`src/routes/admin.ts`**: 管理后台 API（Bearer token 认证）
- **`src/routes/hub-api.ts`**: Hub 协作接口（房间内消息、任务分发、IM）
- **`src/routes/rooms.ts`**: 房间管理（创建/加入/离开/解散房间，获取 agents）
- **`src/routes/tasks.ts`**: 任务管理（创建/取消/停止/确认/拒绝/分发任务）
- **`src/routes/report.ts`**: 客户端上报（使用数据、错误、反馈、成就上报及排行榜）
- **`src/routes/broadcast.ts`**: 广播消息（获取广播、标记已读）

## WebSocket 认证与连接约束
> by nasakim | 验证: 2026-05
✅ [已验证] src/ws-server.ts:L18-116, src/index.ts:L23
- **连接配置**: 路径 `/ws`，认证超时 5 秒（AUTH_TIMEOUT_MS）
- **认证流程**:
  1. 连接后 5 秒内必须发送 `auth.psk` 消息
  2. 消息包含加密 payload（含 clientId）和 timestamp
  3. 服务端解密 payload，验证 timestamp 与服务器时间差 ≤ 5 分钟
- **错误码**:
  - `4001`: 认证超时（5 秒内未收到 `auth.psk`）
  - `4002`: 未认证发送业务消息
  - `4003`: Timestamp 过期（与服务器差超 5 分钟）
  - `4004`: Payload 中缺少 clientId
  - `4005`: PSK 解密失败
- **默认端口**: 5882（可通过环境变量 PORT 覆盖）

## 启动方式与开发端口
> by nasakim | 验证: 2026-05-24
✅ [已验证] package.json:L6-L8, src/index.ts:L23, web/package.json
- **开发命令**: `bash dev.sh`（同时启动 API 和 UI）
- **API 端口**: 5882（可通过 `PORT` 环境变量覆盖）
- **UI 端口**: 4000（Vite dev server，代理到后端 API）
- **技术栈**: Express 5 + better-sqlite3 + React 19 + Vite

## 健康检查端点
> by nasakim | 验证: 2026-05-24
✅ [已验证] src/index.ts:L142-L143
- **`/health`**: 支持 GET（返回 `{"ok":true}`）和 HEAD（返回 200）
- **`/api/health`**: 支持 GET（返回 `{"ok":true}`）和 HEAD（返回 200）
- **用途**: 存活探测，无需认证
