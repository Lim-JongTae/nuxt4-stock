import type { TechnicalIndicators, StockCandleMap } from '../../../utils/types/lsSecurities';

// LS증권 일별 캔들 데이터 기반 8대 기술적 지표 실시간 동적 계산
export function calculateTechnicalIndicators(
  htsMap: StockCandleMap | null
): TechnicalIndicators {
  if (!htsMap || htsMap.size === 0) {
    return { psy: null, bbLower: null, ma5: null, ma20: null, ma60: null, volumeRatio: null, macdHist: null, rsi: null, bullishDivergence: null };
  }

  // 날짜 오름차순 (과거 -> 최근) 정렬
  const dates = Array.from(htsMap.keys()).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
  const candles = dates.map(d => htsMap.get(d)!);
  const n = candles.length;
  if (n === 0) {
    return { psy: null, bbLower: null, ma5: null, ma20: null, ma60: null, volumeRatio: null, macdHist: null, rsi: null, bullishDivergence: null };
  }

  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume);

  // 1. ma5, ma20, ma60
  const calcMA = (period: number) => {
    if (n < period) return null;
    const slice = closes.slice(n - period);
    const sum = slice.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / period);
  };
  const ma5 = calcMA(5);
  const ma20 = calcMA(20);
  const ma60 = calcMA(60);

  // 2. 볼린저 밴드 하단 (20일 기준, 2배 표준편차)
  let bbLower: number | null = null;
  if (n >= 20 && ma20 !== null) {
    const slice20 = closes.slice(n - 20);
    const variance = slice20.reduce((acc, v) => acc + Math.pow(v - ma20, 2), 0) / 20;
    const stdDev = Math.sqrt(variance);
    bbLower = Math.round(ma20 - 2 * stdDev);
  }

  // 3. 심리선 (PSY 12일 기준): 최근 12일 중 전일 대비 상승 마감한 날의 비율 (%)
  let psy: number | null = null;
  if (n >= 13) {
    const slice13 = closes.slice(n - 13);
    let upCount = 0;
    for (let i = 1; i < 13; i++) {
      const curr = slice13[i];
      const prev = slice13[i - 1];
      if (curr !== undefined && prev !== undefined && curr > prev) upCount++;
    }
    psy = Number(((upCount / 12) * 100).toFixed(1));
  } else if (n >= 2) {
    let upCount = 0;
    for (let i = 1; i < n; i++) {
      const curr = closes[i];
      const prev = closes[i - 1];
      if (curr !== undefined && prev !== undefined && curr > prev) upCount++;
    }
    psy = Number(((upCount / (n - 1)) * 100).toFixed(1));
  }

  // 4. 거래량 비율 (volumeRatio %): 최근 1일 거래량 / 전일 5일 평균 거래량 * 100
  let volumeRatio: number | null = null;
  if (n >= 6) {
    const latestVol = volumes[n - 1] ?? 0;
    const prev5Vol = volumes.slice(n - 6, n - 1);
    const avgPrev5Vol = prev5Vol.reduce((acc, v) => acc + v, 0) / 5;
    if (avgPrev5Vol > 0) {
      volumeRatio = Number(((latestVol / avgPrev5Vol) * 100).toFixed(1));
    }
  } else if (n >= 2) {
    const latestVol = volumes[n - 1] ?? 0;
    const prevVol = volumes[n - 2] ?? 0;
    if (prevVol > 0) {
      volumeRatio = Number(((latestVol / prevVol) * 100).toFixed(1));
    }
  }

  // 5. RSI (14일 기준)
  let rsi: number | null = null;
  if (n >= 15) {
    const slice15 = closes.slice(n - 15);
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < 15; i++) {
      const curr = slice15[i];
      const prev = slice15[i - 1];
      if (curr !== undefined && prev !== undefined) {
        const diff = curr - prev;
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
    }
    const avgGain = gains / 14;
    const avgLoss = losses / 14;
    if (avgGain + avgLoss > 0) {
      rsi = Number(((avgGain / (avgGain + avgLoss)) * 100).toFixed(1));
    } else {
      rsi = 50;
    }
  }

  // 6. MACD 오실레이터 (12, 26, 9)
  let macdHist: number | null = null;
  if (n >= 35) {
    const calcEMA = (data: number[], period: number): number => {
      if (data.length === 0) return 0;
      const k = 2 / (period + 1);
      let ema = data[0] ?? 0;
      for (let i = 1; i < data.length; i++) {
        const val = data[i] ?? 0;
        ema = val * k + ema * (1 - k);
      }
      return ema;
    };
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const macdLine = ema12 - ema26;
    macdHist = Math.round(macdLine * 0.4);
  }

  // 7. 강세 다이버전스 (bullishDivergence)
  let bullishDivergence: boolean | null = null;
  if (rsi !== null && psy !== null) {
    bullishDivergence = rsi <= 35 && psy <= 25;
  }

  return { psy, bbLower, ma5, ma20, ma60, volumeRatio, macdHist, rsi, bullishDivergence };
}

export const calculateTechnicalIndicatorsFromLS = calculateTechnicalIndicators;
