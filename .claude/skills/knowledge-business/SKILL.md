---
name: knowledge-business
description: "Business knowledge for sman-server. Verified against code."
_scanned:
  commitHash: d76da6e344e1f66d3c5acec32502380c83ce5a68
  scannedAt: "2026-05-25T00:00:00.000Z"
  branch: "master"
---

# Business Knowledge

> 贡献者: nasakim | 验证时间: 2026-05-23

## sman-server 项目定位
> by nasakim | 验证: 2026-05
✅ [已验证] package.json:L2, web/src/main.tsx:L1-L10
- 项目名：`sman-server`，定位为 Sman 桌面应用的管理中心（管理 Hub）
- 核心职责：加密使用报告收集、广播通知管理、应用更新分发
- 包含 React 管理后台（位于 `web/` 目录，使用 React 19 + Vite 构建）

## sman-server 对外接口架构
> by nasakim | 验证: 2026-05
✅ [已验证] src/index.ts:L140-L172, src/routes/*.ts
- 共 60 个 HTTP 接口，分为两大类：
  - **客户端接口**（27 个）：使用 `/api` 前缀，PSK 加密认证，供桌面客户端调用
  - **管理接口**（33 个）：使用 `/admin` 前缀，Bearer Token 认证，供管理后台调用
- 路由文件分类：
  - 客户端：`report.ts`, `broadcast.ts`, `hub-api.ts`（挂载于 `/api` 和 `/api/hub`）
  - 管理：`admin.ts`, `rooms.ts`, `tasks.ts`（挂载于 `/admin`）

## 核心定位
> by nasakim | 验证: 2026-05
✅ [已验证] CLAUDE.md:L1-L4
- Sman-Server 是 Sman 桌面应用的中央管理枢纽，四大核心能力：加密上报、广播推送、更新分发、数据看板
- 管理员通过 Bearer Token 认证访问管理后台；客户端通过预共享密钥(PSK)加密上报数据

## 数据模型
> by nasakim | 验证: 2026-05
✅ [已验证] src/db.ts:L68-L104
- 四表架构：clients(设备登记/upsert)、reports(使用记录/时间序列)、broadcasts(广播/软删除active标志)、read_log(已读/多对多)
- 核心索引：idx_reports_client, idx_reports_time, idx_broadcasts_active

## 版本规则
> by nasakim | 验证: 2026-05
❓ [待验证] pack.sh 中未明确版本号格式
- 版本号格式：`26.MDD.HH`（年.月日.小时），如 26.0519.01
