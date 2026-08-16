import { classifyShortSellSignal } from './useShortSellSignal';
import type { RawStockApiData, CalculatedStockDetail } from '../../utils/types/lsSecurities';

export type { RawStockApiData, CalculatedStockDetail };

/**
 * API에서 전달받은 순수 시세/지표 자료(변수)를 바탕으로 비즈니스 로직(8대 지표 조건 검사 및 퀀트 스코어 계산)을 수행하는 함수
 */
export function calculateQuantIndicators(raw: RawStockApiData): CalculatedStockDetail {
  const {
    shcode,
    name,
    industry,
    isHolding,
    holdingQuantity,
    holdingAvgPrice,
    closePrice,
    psy,
    bbLower,
    ma5,
    ma20,
    ma60,
    volumeRatio,
    macdHist,
    rsi,
    bullishDivergence,
    shortSellHistory = [],
    dataSource,
    errorMessage
  } = raw;

  // 8대 지표 조건 검사 & 퀀트 스코어 비즈니스 계산
  const cond_psy = typeof psy === 'number' && psy <= 25.0;
  const cond_bb = typeof bbLower === 'number' && bbLower > 0 && closePrice <= Math.round(bbLower * 1.02);
  const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' && typeof ma60 === 'number' &&
                        ma5 > 0 && ma20 > 0 && ma60 > 0 && ma5 >= ma20 && ma20 >= ma60;
  const cond_volume = typeof volumeRatio === 'number' && volumeRatio >= 120.0;
  const cond_macd = typeof macdHist === 'number' && macdHist > 0;
  const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;
  const cond_divergence = bullishDivergence === true;

  const shortSignal = classifyShortSellSignal(shortSellHistory);
  const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

  let score = 0;
  if (cond_psy) score += 10;
  if (cond_bb) score += 10;
  if (cond_ma_turn) score += 15;
  if (cond_volume) score += 15;
  if (cond_macd) score += 10;
  if (cond_rsi) score += 10;
  if (cond_divergence) score += 15;
  if (cond_short_signal) score += 15;

  const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi && cond_divergence && cond_short_signal;

  return {
    shcode,
    name,
    industry,
    isHolding,
    holdingQuantity,
    holdingAvgPrice,
    closePrice,
    psy,
    bbLower,
    ma5,
    ma20,
    ma60,
    volumeRatio,
    macdHist,
    rsi,
    bullishDivergence,
    shortSellHistory,
    shortSignal,
    conditions: {
      cond_psy,
      cond_bb,
      cond_ma_turn,
      cond_volume,
      cond_macd,
      cond_rsi,
      cond_divergence,
      cond_short_signal
    },
    score,
    isFullyMatched,
    dataSource,
    errorMessage
  };
}

export function useQuantIndicatorCalculator() {
  return {
    calculateQuantIndicators
  };
}
