# Business — nasakim

> Last extracted: 2026-05-19T01:30:46.126Z
<!-- hash: a1b2c3 -->
- Sman-Server 是 Sman 桌面应用的中央管理枢纽，四大核心能力：加密上报、广播推送、更新分发、数据看板
- 管理员通过 Bearer Token 认证访问管理后台；客户端通过预共享密钥(PSK)加密上报数据
<!-- end: a1b2c3 -->
<!-- hash: d4e5f6 -->
- 数据模型 4 表：clients(设备登记/upsert)、reports(使用记录/时间序列)、broadcasts(广播/软删除active标志)、read_log(已读/多对多)
<!-- end: d4e5f6 -->
<!-- hash: 7a8b9c -->
- 版本号格式：`26.MDD.HH`（年.月日.小时），如 26.0519.01
<!-- end: 7a8b9c -->