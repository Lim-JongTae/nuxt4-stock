import { classifyShortSellSignal } from './useShortSellSignal';
import type { RawStockApiData, CalculatedStockDetail } from '../../utils/types/lsSecurities';
import { isEtfOrEtn, sanitizeShcode } from '../../utils/stockUtils';

export type { RawStockApiData, CalculatedStockDetail };

/** 볼린저밴드 하단 허용 오차 비율 (기본 2% = 1.02) */
export const BOLLINGER_BAND_TOLERANCE_RATE = 1.02;

/** 공매도 수급 신호 신뢰도별 점수 가중치 매핑 (높음: 15점, 중간: 11점, 낮음: 7점) */
export const SHORT_SIGNAL_CONFIDENCE_SCORE_MAP: Record<"높음" | "중간" | "낮음", number> = {
  "높음": 15,
  "중간": 11,
  "낮음": 7,
};

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

  // 종목코드 정제 (A 접두사 제거)
  const cleanCode = sanitizeShcode(shcode || '');

  // ETF/ETN 종목 여부 자동 판별
  const isEtf = isEtfOrEtn(name || '', industry);

  // DTC 계산: 공매도 누적 잔고수량 / 20일 평균 거래량
  let dtc: number | null = null;
  if (shortSellHistory && shortSellHistory.length > 0) {
    const latestShort = shortSellHistory[0];
    const shortVolume = latestShort?.shortVolume;

    if (shortVolume && shortVolume > 0) {
      const recentRecords = shortSellHistory.slice(0, Math.min(20, shortSellHistory.length));
      const totalVolume = recentRecords.reduce((sum, r) => sum + (r.volume || 0), 0);
      const avgDailyVolume = totalVolume / recentRecords.length;

      if (avgDailyVolume > 0) {
        dtc = Number((shortVolume / avgDailyVolume).toFixed(2));
      }
    }
  }

  // 8대 지표 조건 검사 & 퀀트 스코어 비즈니스 계산
  const cond_psy = typeof psy === 'number' && psy <= 25.0;
  const cond_bb = typeof closePrice === 'number' && closePrice > 0 && typeof bbLower === 'number' && bbLower > 0 && closePrice <= (bbLower * BOLLINGER_BAND_TOLERANCE_RATE);
  const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' && typeof ma60 === 'number' &&
                        ma5 > 0 && ma20 > 0 && ma60 > 0 && ma5 >= ma20 && ma20 >= ma60;
  const cond_volume = typeof volumeRatio === 'number' && volumeRatio >= 120.0;
  const cond_macd = typeof macdHist === 'number' && macdHist > 0;
  const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;
  const cond_divergence = bullishDivergence === true;

  // 공매도 신호 분류 (ETF/ETN 종목은 자동 제외 처리, DTC 값 전달)
  const shortSignal = classifyShortSellSignal(shortSellHistory, isEtf, dtc);
  const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" || shortSignal.label === "매수세가 공매도 흡수 중";

  // 공매도 수급 신호 스코어링
  // - 숏커버링 또는 매수세 흡수 호재 신호 시 신뢰도별 점수 부여 (높음=15점, 중간=11점, 낮음=7점)
  // - 데이터 미수집, 보합, 판단 보류, 악재 신호 시 0점
  const shortSignalScore = cond_short_signal
    ? (SHORT_SIGNAL_CONFIDENCE_SCORE_MAP[shortSignal.confidence] ?? 7)
    : 0;

  let score = 0;
  if (cond_psy) score += 10;
  if (cond_bb) score += 10;
  if (cond_ma_turn) score += 15;
  if (cond_volume) score += 15;
  if (cond_macd) score += 10;
  if (cond_rsi) score += 10;
  if (cond_divergence) score += 15;
  score += shortSignalScore;

  // 0~100점 범위 안전 클램핑
  const finalScore = Math.min(100, Math.max(0, score));

  // isFullyMatched: 8대 지표 조건이 모두 충족 (8/8 충족) 시에만 true
  const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi && cond_divergence && cond_short_signal;

  return {
    shcode: cleanCode,
    name,
    industry,
    isHolding: !!isHolding,
    holdingQuantity,
    holdingAvgPrice,
    closePrice,
    psy: psy ?? null,
    bbLower: bbLower ?? null,
    ma5: ma5 ?? null,
    ma20: ma20 ?? null,
    ma60: ma60 ?? null,
    volumeRatio: volumeRatio ?? null,
    macdHist: macdHist ?? null,
    rsi: rsi ?? null,
    bullishDivergence: bullishDivergence ?? null,
    shortSellHistory,
    shortSignal: isEtf ? { ...shortSignal, summary: 'ETF/ETN (공매도 t1927 제외 종목)' } : shortSignal,
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
    score: finalScore,
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

