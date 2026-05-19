# Conventions — nasakim

> Last extracted: 2026-05-19T01:30:46.126Z
<!-- hash: 1d2e3f -->
- ESM 全链路：`.js` 扩展，无编译步骤，tsx 直接运行
- 无 ORM、无路由库：原生 SQL(better-sqlite3)、前端纯状态切换、手写 CSS
- 包管理用 pnpm 严格模式（符号链接隔离）
<!-- end: 1d2e3f -->
<!-- hash: 4g5h6i -->
- 数据库 WAL 模式，单文件 SQLite
- 广播消息使用软删除（`active` 标志位），不做物理删除
- 启动命令统一用 `bash dev.sh`（API :5882 + 前端 :4000）
<!-- end: 4g5h6i -->