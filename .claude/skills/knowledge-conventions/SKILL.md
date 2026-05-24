---
name: knowledge-conventions
description: "Development conventions for sman-server. Verified against code."
_scanned:
  commitHash: d76da6e344e1f66d3c5acec32502380c83ce5a68
  scannedAt: "2026-05-25T00:00:00.000Z"
  branch: "master"
---

# Development Conventions

> 贡献者: nasakim | 验证时间: 2026-05-23

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

## 前端卡片/组件约定
> by nasakim | 验证: 2026-05
✅ [已验证] web/src/app.css:L306-326, web/src/components/DashboardTab.tsx:L77-82
- **统计卡片结构**: 使用 `stat-card`、`stat-label`、`stat-value` 类构建统计卡片
  - `stat-card`: 卡片容器，带背景色和边框，支持 hover 效果
  - `stat-value`: 数值显示，28px 加粗字体
  - `stat-label`: 标签显示，13px 字体，使用 `--text2` 变量颜色
- **徽章样式**: 使用 `badge`、`badge-green`、`badge-yellow`、`badge-blue`、`badge-red`、`badge-gray`、`badge-dot` 类
  - `badge`: 基础徽章容器，inline-flex 布局，6px 间距
  - `badge-dot`: 7px 圆点指示器
  - 颜色变体: 绿色(成功)、黄色(警告)、蓝色(信息)、红色(错误)、灰色(中性)
- **布局模式**: flex 布局 + `justify-content: space-between` 对齐（见 DashboardTab.tsx:L82-94）
- **CSS 变量**: 使用 `--text2` 控制次要文本颜色（line 7, 37）
