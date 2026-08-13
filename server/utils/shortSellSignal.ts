export interface ShortSellRecord {
  date: string;
  balanceRatio: number; // 잔고비율 (%)
  price: number;        // 주가 종가 (원)
  shortAvgPrice?: number; // 공매도 평균체결가 (원)
  volume: number;       // 거래량
}

export interface ShortSellSignalResult {
  label: "신규 공매도 유입" | "숏커버링(환매수) 유력" | "매수세가 공매도 흡수 중" | "판단 보류" | "신호 분류 불가";
  confidence: "높음" | "중간" | "낮음";
  metrics: {
    balanceRatioDiff: number; // 5일간 잔고비율 변화 (%p)
    priceDiffRate: number;    // 5일간 주가 변화율 (%)
    volumeDiffRate: number;   // 5일 평균 대비 거래량 변화율 (%)
  } | null;
  summary: string;
}

/**
 * 최근 5일치(또는 2일 이상) 공매도 시계열 데이터로 5일 누적 추세(잔고비율 %p, 주가 %, 거래량 %)를 계산하여
 * 노이즈를 제거하고 4가지 라벨 및 신뢰도를 분석하는 함수
 */
export function classifyShortSellSignal(shortSellData: ShortSellRecord[]): ShortSellSignalResult {
  if (!Array.isArray(shortSellData) || shortSellData.length < 2) {
    return {
      label: "신호 분류 불가",
      confidence: "낮음",
      metrics: null,
      summary: "공매도 분석 데이터가 최소 2일치 이상 필요합니다."
    };
  }

  // 날짜 오름차순 정렬 (과거 -> 최신)
  const sortedData = [...shortSellData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // 5일치 이상이면 5일 전(첫번째) 데이터와 최신(마지막) 데이터 비교, 아니면 있는 최장 데이터 비교
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

  // 4가지 라벨 추세 분류
  let label: ShortSellSignalResult["label"] = "판단 보류";
  if (balanceRatioDiff < 0 && priceDiffRate > 0) {
    label = "숏커버링(환매수) 유력";
  } else if (balanceRatioDiff > 0 && priceDiffRate < 0) {
    label = "신규 공매도 유입";
  } else if (balanceRatioDiff > 0 && priceDiffRate > 0) {
    label = "매수세가 공매도 흡수 중";
  } else {
    label = "판단 보류";
  }

  // 거래량 급증(+30% 이상) 및 분석 기간(5일 이상)에 따라 신뢰도 판정
  let confidence: ShortSellSignalResult["confidence"] = "중간";
  if (daysCount >= 4 && volumeDiffRate >= 30) {
    confidence = "높음";
  } else if (daysCount >= 3 && volumeDiffRate >= 0) {
    confidence = "중간";
  } else {
    confidence = "낮음";
  }

  const signRatio = balanceRatioDiff > 0 ? `+${balanceRatioDiff}` : `${balanceRatioDiff}`;
  const signPrice = priceDiffRate > 0 ? `+${priceDiffRate}` : `${priceDiffRate}`;
  const signVol = volumeDiffRate > 0 ? `+${volumeDiffRate}` : `${volumeDiffRate}`;

  const summary = `${daysCount}일 추세: 잔고 ${signRatio}%p, 주가 ${signPrice}%, 거래량 ${signVol}% → "${label}, 신뢰도 ${confidence}"`;

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
