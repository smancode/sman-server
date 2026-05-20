---
name: knowledge-technical
description: "Technical architecture for sman-server. Verified against code."
_scanned:
  commitHash: 60687534e9e2a4acf2800a04840cf09048ff3dda
  scannedAt: "2026-05-20T19:11:59Z"
  branch: "master"
---

# Technical Architecture

> 贡献者: nasakim | 验证时间: 2026-05-20

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
