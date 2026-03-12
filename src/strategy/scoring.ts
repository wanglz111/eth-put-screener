import type { StrategyConfig } from "../types/market";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * 计算期权候选的综合评分
 *
 * 策略目标：
 * 1. 主要目标：不行权，赚取权利金（偏好低 Delta）
 * 2. 次要目标：如果行权，买入价格有吸引力
 *
 * @param positionYield 仓位收益率（premium / strike）
 * @param iv 隐含波动率
 * @param absDelta Delta 绝对值（行权概率的代理指标）
 * @param spotPrice 现货价格
 * @param strike 行权价
 * @param config 策略配置
 * @returns 综合评分（0-1 之间，越高越好）
 */
export function scoreCandidate(
  positionYield: number,
  iv: number | null,
  absDelta: number,
  spotPrice: number,
  strike: number,
  config: StrategyConfig
): number {
  const { scoringWeights, scoringBaselines } = config;

  // 1. 收益率评分：归一化到 0-1
  // 收益率越高越好，以 baseline 为基准
  const normalizedYield = clamp(
    positionYield / scoringBaselines.yieldBaseline,
    0,
    1
  );

  // 2. IV 评分：归一化到 0-1
  // 高 IV 意味着更高的权利金，但也意味着更高的风险
  const normalizedIv = clamp(
    (iv ?? 0) / scoringBaselines.ivBaseline,
    0,
    1
  );

  // 3. Delta 评分：在允许范围内，偏好低 Delta
  // Delta 越低，行权概率越小，越符合"不行权赚权利金"的目标
  // 归一化：将 [minAbsDelta, maxAbsDelta] 映射到 [0, 1]
  // 注意：这里是正向归一化，但权重是负数，所以实际效果是惩罚高 Delta
  const deltaRange = config.maxAbsDelta - config.minAbsDelta || 1;
  const normalizedDelta = clamp(
    (absDelta - config.minAbsDelta) / deltaRange,
    0,
    1
  );

  // 4. 有效买入价评分：如果行权，买入价格的吸引力
  // 有效买入价 = strike - premium
  // 折扣率 = (spotPrice - effectiveBuyPrice) / spotPrice
  const premium = positionYield * strike;
  const effectiveBuyPrice = strike - premium;
  const discount = (spotPrice - effectiveBuyPrice) / spotPrice;

  // 归一化：折扣率越高越好（买得越便宜）
  const normalizedEffectivePrice = clamp(
    discount / scoringBaselines.effectivePriceDiscountBaseline,
    0,
    1
  );

  // 综合评分：加权求和
  const score =
    scoringWeights.yieldWeight * normalizedYield +
    scoringWeights.ivWeight * normalizedIv +
    scoringWeights.deltaWeight * normalizedDelta +
    scoringWeights.effectivePriceWeight * normalizedEffectivePrice;

  return score;
}

