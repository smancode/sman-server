# 项目初始化报告

生成时间: 2026-05-20

## 项目基本信息

- **技术栈**: TypeScript, Express 5, better-sqlite3, React 19, Vite, pnpm
- **架构模式**: Express API + React SPA, 原生 SQLite (WAL mode, 无 ORM)
- **规模**: small (41 个源码文件)
- **入口点数量**: 29 个 API 端点
- **外部依赖数量**: 4 个 (better-sqlite3, node:crypto, node:fs, ws)
- **数据库**: 4 张核心表 (clients, reports, broadcasts, read_log)

## Skill 生成情况

| Skill | 状态 | 摘要行数 | references 文件数 |
|-------|------|----------|------------------|
| project-structure | ✅ | 88 | 2 |
| knowledge-conventions | ✅ | 64 | 2 |
| knowledge-technical | ✅ | 129 | 2 |
| knowledge-business | ✅ | 80 | 4 |
| database-schema | ✅ | 80 | 4 |
| project-apis | ✅ | ~80 | 29 |
| project-external-calls | ✅ | ~80 | 4 |

**总计**: 7 个核心 skills, 47 个 reference 文件

## 关键发现

| 发现 | 影响 |
|------|------|
| 使用 AES-256-GCM 加密的客户端通信 | 高安全性，需要 PSK 管理 |
| 原生 SQLite (better-sqlite3) 无 ORM | 需要手写 SQL，注意 SQL 注入防护 |
| 软删除模式 (active 标志) | 查询需要 WHERE active = 1 |
| 工厂函数依赖注入模式 | 良好的可测试性 |
| Windows x64 打包部署 | 需要架构特定的原生模块 |

## 未覆盖（后续补充）

| 内容 | 建议 |
|------|------|
| WebSocket 实时通信细节 | 后续可添加 ws 流程文档 |
| 打包脚本 (pack.sh) 详解 | 已在 CLAUDE.md 中，可提取为独立 skill |
| 部署流程 (deploy-private/) | 涉及敏感信息，保持当前状态 |

## 下次更新

- 检查 commit hash 变化
- 增量更新受影响的 skills
- 验证团队知识 (.sman/knowledge/) 并聚合
