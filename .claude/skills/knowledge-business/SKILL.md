---
name: knowledge-business
description: "Business knowledge for sman-server. Verified against code."
_scanned:
  commitHash: 312f64fbef5f2cd1acae067c829101d7e6203a92
  scannedAt: "2026-05-22T00:00:00Z"
  branch: "master"
---

# Business Knowledge

> 贡献者: nasakim | 验证时间: 2026-05-22

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
