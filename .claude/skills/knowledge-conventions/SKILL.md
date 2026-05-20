---
name: knowledge-conventions
description: "Development conventions for sman-server. Verified against code."
_scanned:
  commitHash: 60687534e9e2a4acf2800a04840cf09048ff3dda
  scannedAt: "2026-05-20T19:11:59Z"
  branch: "master"
---

# Development Conventions

> 贡献者: nasakim | 验证时间: 2026-05-20

## 技术栈选择
> by nasakim | 验证: 2026-05
✅ [已验证] package.json:L1-L6, web/package.json:L1-L4
- ESM 全链路：`"type": "module"`，TypeScript imports 用 `.js` 扩展，tsx 直接运行无编译步骤
- 无 ORM、无路由库：原生 SQL (better-sqlite3)、前端纯状态切换、手写 CSS
- 包管理用 pnpm 严格模式（符号链接隔离）

## 数据库配置
> by nasakim | 验证: 2026-05
✅ [已验证] src/db.ts:L63
- 数据库 WAL 模式：`journal_mode = WAL`，单文件 SQLite

## 软删除模式
> by nasakim | 验证: 2026-05
✅ [已验证] src/db.ts:L92, src/db.ts:L253-L254
- 广播消息使用软删除（`active` 标志位），不做物理删除

## 开发启动
> by nasakim | 验证: 2026-05
✅ [已验证] dev.sh:L1-L6
- 启动命令统一用 `bash dev.sh`（API :5882 + 前端 :4000）
