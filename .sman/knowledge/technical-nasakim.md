# Technical — nasakim

> Last extracted: 2026-05-19T01:30:46.126Z
<!-- hash: a0b1c2 -->
- 后端 Express 5 + better-sqlite3；前端 React 19 + Vite；加密 AES-256-GCM
- 加密方案：预共享密钥(PSK) + 时间戳防重放（5分钟时间窗）
<!-- end: a0b1c2 -->
<!-- hash: d3e4f5 -->
- 安全约束：PSK 强制 32 字符（启动校验）、管理接口强制 Bearer Token、生产 SPA 仅 localhost 访问
<!-- end: d3e4f5 -->
<!-- hash: 6g7h8i -->
- 打包目标：Windows x64 自包含（内置 node.exe），需注意：ARM64 开发机需切 x64 Node、pnpm 符号链接需展开、用 tar 非 zip
<!-- end: 6g7h8i -->