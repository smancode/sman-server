import type { RejectResult, LimitDimension, LimitMetric, ThresholdType } from './account-types.js';

// ── Reject Code Registry ──

const CODE_REGISTRY: Record<string, { category: string; message: string }> = {
  // A0xx — Limit violations (限额类)
  A001: { category: '限额', message: '时间窗口交易笔数超限' },
  A002: { category: '限额', message: '时间窗口交易金额超限' },
  A003: { category: '限额', message: '对手方交易笔数超限' },
  A004: { category: '限额', message: '对手方交易金额超限' },
  A005: { category: '限额', message: '单笔金额超限' },

  // B0xx — Control violations (管控类)
  B001: { category: '管控', message: '账户禁止扣减' },
  B002: { category: '管控', message: '账户禁止增加' },
  B003: { category: '管控', message: '管控配置黑名单命中' },
  B004: { category: '管控', message: '管控配置白名单未命中' },
  B005: { category: '管控', message: '账户已冻结' },
  B006: { category: '管控', message: '账户已销户' },

  // C0xx — Balance violations (余额类)
  C001: { category: '余额', message: '可用余额不足' },
  C002: { category: '余额', message: '余额将变为负数' },

  // D0xx — Auth violations (授权类)
  D001: { category: '授权', message: 'event_id 重复' },
  D002: { category: '授权', message: 'nonce 重放' },
  D003: { category: '授权', message: '金额不合法' },
  D004: { category: '授权', message: '自转账不允许' },
  D005: { category: '授权', message: '交易已冲正' },
  D006: { category: '授权', message: '交易不存在' },
  D007: { category: '授权', message: '非完成状态交易不可冲正' },

  // E0xx — System errors (系统类)
  E001: { category: '系统', message: '数据库写入失败' },
  E002: { category: '系统', message: '熔断器开启，系统暂时不可用' },
  E003: { category: '系统', message: '写入队列满' },
  E004: { category: '系统', message: '一致性校验失败' },
};

export function getRejectInfo(code: string): { category: string; message: string } {
  return CODE_REGISTRY[code] ?? { category: '未知', message: `未知错误码: ${code}` };
}

export function reject(code: string, extraReason?: string): RejectResult {
  const info = getRejectInfo(code);
  return {
    code,
    reason: extraReason ?? info.message,
  };
}

// ── Limit Reason Template ──

const DIMENSION_LABEL: Record<LimitDimension, string> = { time: '时间', counterparty: '对手方' };
const METRIC_LABEL: Record<LimitMetric, string> = {
  minute: '分钟', hour: '小时', day: '天', month: '月', quarter: '季度', year: '年',
};
const THRESHOLD_TYPE_LABEL: Record<ThresholdType, string> = { count: '笔', amount: '毫积分' };

export function formatLimitReason(
  dimension: LimitDimension,
  metric: LimitMetric,
  intervalValue: number,
  threshold: number,
  thresholdType: ThresholdType,
): string {
  const dim = DIMENSION_LABEL[dimension];
  const met = METRIC_LABEL[metric];
  const unit = THRESHOLD_TYPE_LABEL[thresholdType];
  return `达到${dim}的${met}限额，每${intervalValue}${met}最多${threshold}${unit}`;
}
