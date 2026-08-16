import type { ShortSellRecord, ShortSellSignalResult } from '../../utils/types/lsSecurities';

/**
 * 최근 5일치(또는 2일 이상) 공매도 시계열 데이터로 5일 누적 추세(잔고비율 %p, 주가 %, 거래량 %)를 계산하여
 * 노이즈를 제거하고 4가지 라벨 및 신뢰도를 분석하는 함수
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

  // 날짜 오름차순 정렬 (과거 -> 최신)
  const sortedData = [...shortSellData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const start = sortedData[0]!;
  const latest = sortedData[sortedData.length - 1]!;
  const daysCount = sortedData.length;

  // 1. 기간 누적 잔고비율 변화 (%p)
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

  // 4가지 라벨 추세 분류 (공매도 잔고 감소 시 숏커버링 유력 판정)
  let label: ShortSellSignalResult["label"] = "판단 보류";
  if (balanceRatioDiff < 0) {
    label = "숏커버링(환매수) 유력";
  } else if (balanceRatioDiff > 0 && priceDiffRate < 0) {
    label = "신규 공매도 유입";
  } else if (balanceRatioDiff > 0 && priceDiffRate >= 0) {
    label = "매수세가 공매도 흡수 중";
  } else {
    label = "판단 보류";
  }

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

  // 분석 기간 및 수급 변화율에 따른 신뢰도 판정
  let confidence: ShortSellSignalResult["confidence"] = "높음";
  if (daysCount >= 3) {
    confidence = "높음";
  } else if (daysCount >= 2) {
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
