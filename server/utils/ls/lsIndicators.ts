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
  } else if (n >= 5) {
    let gains = 0;
    let losses = 0;
    for (let i = 1; i < n; i++) {
      const diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses += Math.abs(diff);
    }
    const avgGain = gains / (n - 1);
    const avgLoss = losses / (n - 1);
    if (avgGain + avgLoss > 0) {
      rsi = Number(((avgGain / (avgGain + avgLoss)) * 100).toFixed(1));
    } else {
      rsi = 50;
    }
  }

  // 6. MACD 오실레이터 표준 계산 (최소 26일 이상 캔들 확보 시 계산)
  let macdHist: number | null = null;
  if (n >= 26) {
    const period12 = Math.min(12, Math.floor(n / 2));
    const period26 = Math.min(26, n - 1);
    const k12 = 2 / (period12 + 1);
    const k26 = 2 / (period26 + 1);
    const k9 = 2 / (9 + 1);

    const sma12 = closes.slice(0, period12).reduce((a, b) => a + b, 0) / period12;
    const sma26 = closes.slice(0, period26).reduce((a, b) => a + b, 0) / period26;

    const ema12Series: number[] = new Array(n).fill(0);
    const ema26Series: number[] = new Array(n).fill(0);

    let currEma12 = sma12;
    let currEma26 = sma26;

    for (let i = 0; i < n; i++) {
      const price = closes[i] ?? 0;
      if (i >= period12) {
        currEma12 = price * k12 + currEma12 * (1 - k12);
      }
      if (i >= period26) {
        currEma26 = price * k26 + currEma26 * (1 - k26);
      }
      ema12Series[i] = currEma12;
      ema26Series[i] = currEma26;
    }

    const macdSeries: number[] = [];
    for (let i = period26; i < n; i++) {
      macdSeries.push((ema12Series[i] ?? 0) - (ema26Series[i] ?? 0));
    }

    if (macdSeries.length >= 1) {
      const signalLen = Math.min(9, macdSeries.length);
      const signalSma = macdSeries.slice(0, signalLen).reduce((a, b) => a + b, 0) / signalLen;
      let currSignal = signalSma;

      for (let i = signalLen; i < macdSeries.length; i++) {
        const m = macdSeries[i] ?? 0;
        currSignal = m * k9 + currSignal * (1 - k9);
      }

      const latestMacdLine = macdSeries[macdSeries.length - 1] ?? 0;
      macdHist = Math.round(latestMacdLine - currSignal);
    }
  }

  // 7. 강세 다이버전스 (Bullish Divergence): 주가는 신저점을 갱신(Lower Low)하지만 RSI 지표는 저점을 높일 때(Higher Low)
  // (RSI 14일 계산 + 20일 분석 구간을 확보하기 위해 최소 n >= 34 필요)
  let bullishDivergence: boolean | null = null;
  if (n >= 34) {
    // 14일 RSI 시계열 생성 (인덱스 14부터 n-1까지)
    const rsiSeries: (number | null)[] = new Array(n).fill(null);
    for (let i = 14; i < n; i++) {
      let gains = 0;
      let losses = 0;
      for (let j = i - 13; j <= i; j++) {
        const diff = (closes[j] ?? 0) - (closes[j - 1] ?? 0);
        if (diff > 0) gains += diff;
        else losses += Math.abs(diff);
      }
      const avgGain = gains / 14;
      const avgLoss = losses / 14;
      if (avgGain + avgLoss > 0) {
        rsiSeries[i] = Number(((avgGain / (avgGain + avgLoss)) * 100).toFixed(1));
      } else {
        rsiSeries[i] = 50;
      }
    }

    // 최근 20일 데이터를 전반 10일(구간 A: n-20 ~ n-11)과 후반 10일(구간 B: n-10 ~ n-1)로 분할
    let minPriceA = Infinity;
    let rsiAtMinA = 50;
    for (let i = n - 20; i <= n - 11; i++) {
      const price = closes[i] ?? Infinity;
      const rVal = rsiSeries[i] ?? 50;
      if (price < minPriceA) {
        minPriceA = price;
        rsiAtMinA = rVal;
      }
    }

    let minPriceB = Infinity;
    let rsiAtMinB = 50;
    for (let i = n - 10; i <= n - 1; i++) {
      const price = closes[i] ?? Infinity;
      const rVal = rsiSeries[i] ?? 50;
      if (price < minPriceB) {
        minPriceB = price;
        rsiAtMinB = rVal;
      }
    }

    // 주가 신저점 하락(Lower Low) + RSI 지표 저점 상승(Higher Low) + RSI 45 이하 침체 영역 조건 검사
    bullishDivergence = minPriceB < minPriceA && rsiAtMinB > rsiAtMinA && rsiAtMinB <= 45;
  } else {
    bullishDivergence = false;
  }

  return { psy, bbLower, ma5, ma20, ma60, volumeRatio, macdHist, rsi, bullishDivergence };
}

export const calculateTechnicalIndicatorsFromLS = calculateTechnicalIndicators;
