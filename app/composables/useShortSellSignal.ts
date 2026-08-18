import type { ShortSellRecord, ShortSellSignalResult } from '../../utils/types/lsSecurities';

/**
 * 날짜 문자열(YYYYMMDD 또는 YYYY-MM-DD 등)을 안전하게 타임스탬프(ms)로 변환하는 유틸 함수
 */
function safeParseTimestamp(dateStr: string): number {
  if (!dateStr) return 0;
  const clean = String(dateStr).trim().replace(/[^0-9]/g, '');
  if (clean.length === 8) {
    const year = parseInt(clean.slice(0, 4), 10);
    const month = parseInt(clean.slice(4, 6), 10) - 1;
    const day = parseInt(clean.slice(6, 8), 10);
    return new Date(year, month, day).getTime();
  }
  const timestamp = new Date(dateStr).getTime();
  return isNaN(timestamp) ? 0 : timestamp;
}

/**
 * 최근 공매도 시계열 데이터로 5일 누적 추세(잔고비율 %p, 주가 %, 거래량 %)를 계산하여
 * 노이즈를 제거하고 4가지 라벨 및 신뢰도(5일 이상: 높음, 3~4일: 중간, 2일 이하: 낮음)를 분석하는 함수
 */
export function classifyShortSellSignal(shortSellData: ShortSellRecord[], isEtfOrForeign?: boolean): ShortSellSignalResult {
  if (isEtfOrForeign) {
    return {
      label: "판단 보류",
      confidence: "낮음",
      metrics: null,
      summary: "ETF/ETN 및 해외 주식은 LS증권 공매도(t1927) 대상 제외 항목입니다."
    };
  }

  if (!Array.isArray(shortSellData) || shortSellData.length === 0) {
    return {
      label: "판단 보류",
      confidence: "낮음",
      metrics: null,
      summary: "LS증권 t1927 공매도 데이터 미수집 상태입니다."
    };
  }

  // 실제 공매도 잔고/수량 데이터가 유효한 레코드만 추출
  // (balanceRatio가 undefined/null이 아니면서, 공매도 수량이나 잔고비율 유효성이 존재하는 항목)
  const validRecords = shortSellData.filter(r => 
    r && typeof r.balanceRatio === 'number' && !isNaN(r.balanceRatio)
  );

  // 유효한 공매도 레코드가 2개 미만이거나, 모든 레코드의 잔고비율 및 공매도 수량이 0인 경우 판단 보류
  const hasNonZeroData = validRecords.some(r => r.balanceRatio > 0 || (r.shortVolume || 0) > 0);

  if (validRecords.length < 2) {
    return {
      label: "판단 보류",
      confidence: "낮음",
      metrics: null,
      summary: "공매도 추세 비교를 위한 최소 기간(2일 이상) 데이터가 부족합니다."
    };
  }

  if (!hasNonZeroData) {
    return {
      label: "판단 보류",
      confidence: "낮음",
      metrics: { balanceRatioDiff: 0, priceDiffRate: 0, volumeDiffRate: 0 },
      summary: "유효한 LS증권 t1927 공매도 수급 데이터가 부족합니다."
    };
  }

  // 날짜 오름차순 정렬 (과거 -> 최신) - YYYYMMDD / YYYY-MM-DD 포맷 안전 처리
  const sortedData = [...validRecords].sort((a, b) => safeParseTimestamp(a.date) - safeParseTimestamp(b.date));
  
  // 최신 날짜의 데이터가 미수집되어 0으로 떨어진 경우(착시 잔고 감소) 제외 처리
  let latest = sortedData[sortedData.length - 1]!;
  let start = sortedData[0]!;

  // 최신 데이터 잔고가 0이고 직전 데이터 잔고가 양수이면(미수집 가능성), 마지막 유효 데이터 사용
  if (sortedData.length >= 3 && latest.balanceRatio === 0 && sortedData[sortedData.length - 2]!.balanceRatio > 0) {
    sortedData.pop(); // 0으로 미수집된 당일 데이터 제거
    latest = sortedData[sortedData.length - 1]!;
    start = sortedData[0]!;
  }

  const daysCount = sortedData.length;

  if (daysCount < 2) {
    return {
      label: "판단 보류",
      confidence: "낮음",
      metrics: null,
      summary: "공매도 추세 비교를 위한 최소 기간(2일 이상) 데이터가 부족합니다."
    };
  }

  // 1. 기간 누적 잔고비율 변화 (%p) - 소수점 2자리 보정
  const balanceRatioDiff = Number((latest.balanceRatio - start.balanceRatio).toFixed(2));

  // 2. 기간 누적 주가 변화율 (%)
  const priceDiffRate = start.price > 0 
    ? Number((((latest.price - start.price) / start.price) * 100).toFixed(2))
    : 0;

  // 3. 기간 평균 거래량 계산
  const totalVol = sortedData.reduce((acc, curr) => acc + (curr.volume || 0), 0);
  const avgVolume = totalVol / daysCount;

  // 최근 거래량이 기간 평균 대비 얼마나 급증했는지 (%)
  const volumeDiffRate = avgVolume > 0 
    ? Number((((latest.volume - avgVolume) / avgVolume) * 100).toFixed(2))
    : 0;

  // 4가지 라벨 추세 분류
  // - balanceRatioDiff <= -0.01: 공매도 잔고 유의미 감소 -> 숏커버링 유력
  // - balanceRatioDiff >= 0.01 && priceDiffRate < 0: 잔고 증가 & 주가 하락 -> 신규 공매도 유입
  // - balanceRatioDiff >= 0.01 && priceDiffRate >= 0: 잔고 증가 & 주가 상승/보합 -> 매수세가 공매도 흡수 중
  // - 그 외 (잔고 변동 미미): 판단 보류
  let label: ShortSellSignalResult["label"] = "판단 보류";
  if (balanceRatioDiff <= -0.01) { // -0.01%p 이하 감소 (경계값 포함)
    label = "숏커버링(환매수) 유력";
  } else if (balanceRatioDiff >= 0.01 && priceDiffRate < 0) {
    label = "신규 공매도 유입";
  } else if (balanceRatioDiff >= 0.01 && priceDiffRate >= 0) {
    label = "매수세가 공매도 흡수 중";
  } else {
    label = "판단 보류";
  }

  // 개발 환경 콘솔 디버그 로그 조건부 처리 (프로덕션 환경 로그 오염 방지)
  if (import.meta.dev || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) {
    console.log(`[LS증권 t1927 공매도 수급 계산 테스트]`, {
      daysCount,
      startDate: start.date,
      latestDate: latest.date,
      startBalanceRatio: start.balanceRatio,
      latestBalanceRatio: latest.balanceRatio,
      balanceRatioDiffP: `${balanceRatioDiff}%p`,
      priceDiffRate: `${priceDiffRate}%`,
      volumeDiffRate: `${volumeDiffRate}%`,
      classifiedLabel: label
    });
  }

  // 분석 기간(수집 일수)에 따른 신뢰도 판정 (5일 이상: 높음, 3~4일: 중간, 2일 이하: 낮음)
  let confidence: ShortSellSignalResult["confidence"] = "낮음";
  if (daysCount >= 5) {
    confidence = "높음";
  } else if (daysCount >= 3) {
    confidence = "중간";
  } else {
    confidence = "낮음";
  }

  const signRatio = balanceRatioDiff > 0 ? `+${balanceRatioDiff}` : `${balanceRatioDiff}`;
  const signPrice = priceDiffRate > 0 ? `+${priceDiffRate}` : `${priceDiffRate}`;
  const signVol = volumeDiffRate > 0 ? `+${volumeDiffRate}` : `${volumeDiffRate}`;

  const summary = `${daysCount}일 수급: 잔고 ${signRatio}%p, 주가 ${signPrice}%, 거래량 ${signVol}% → "${label}"`;

  return {
    label,
    confidence,
    metrics: {
      balanceRatioDiff,
      priceDiffRate,
      volumeDiffRate
    },
    summary
  };
}

/**
 * Nuxt 4 Composable: useShortSellSignal
 */
export function useShortSellSignal() {
  return {
    classifyShortSellSignal
  };
}

