export interface ShortSellRecord {
  date: string;
  balanceRatio: number; // 잔고비율 (%)
  price: number;        // 주가 (원)
  volume: number;       // 거래량
}

export interface ShortSellSignalResult {
  label: "신규 공매도 유입" | "숏커버링(환매수) 유력" | "매수세가 공매도 흡수 중" | "판단 보류" | "신호 분류 불가";
  confidence: "높음" | "중간" | "낮음";
  metrics: {
    balanceRatioDiff: number; // %p
    priceDiffRate: number;    // %
    volumeDiffRate: number;   // %
  } | null;
  summary: string;
}

/**
 * 직전 vs 최신 공매도 데이터로 3가지 지표(잔고비율 %p, 주가 %, 거래량 %)를 계산하고
 * 4가지 라벨과 신뢰도(거래량 +30% 기준)를 분류하는 함수
 */
export function classifyShortSellSignal(shortSellData: ShortSellRecord[]): ShortSellSignalResult {
  // 데이터가 없거나 1건뿐이면 신호 분류 불가
  if (!Array.isArray(shortSellData) || shortSellData.length < 2) {
    return {
      label: "신호 분류 불가",
      confidence: "낮음",
      metrics: null,
      summary: "공매도 분석 데이터가 최소 2건 이상 필요합니다 (신호 분류 불가)."
    };
  }

  // 과거 -> 최신 순으로 입력된다고 가정 (날짜순 정렬 보장)
  const sortedData = [...shortSellData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const prev = sortedData[sortedData.length - 2]!;
  const latest = sortedData[sortedData.length - 1]!;

  // 1. 잔고비율 변화 (%p)
  const balanceRatioDiff = Number((latest.balanceRatio - prev.balanceRatio).toFixed(2));

  // 2. 주가 변화 (%)
  const priceDiffRate = prev.price > 0 
    ? Number((((latest.price - prev.price) / prev.price) * 100).toFixed(2))
    : 0;

  // 3. 거래량 변화 (%)
  const volumeDiffRate = prev.volume > 0 
    ? Number((((latest.volume - prev.volume) / prev.volume) * 100).toFixed(2))
    : 0;

  // 4가지 라벨 분류
  let label: ShortSellSignalResult["label"] = "판단 보류";
  if (balanceRatioDiff > 0 && priceDiffRate < 0) {
    label = "신규 공매도 유입";
  } else if (balanceRatioDiff < 0 && priceDiffRate > 0) {
    label = "숏커버링(환매수) 유력";
  } else if (balanceRatioDiff > 0 && priceDiffRate > 0) {
    label = "매수세가 공매도 흡수 중";
  } else {
    label = "판단 보류";
  }

  // 거래량 급증(+30% 이상) 동반 여부로 신뢰도(높음/중간/낮음) 판정
  let confidence: ShortSellSignalResult["confidence"] = "중간";
  if (volumeDiffRate >= 30) {
    confidence = "높음";
  } else if (volumeDiffRate >= 0) {
    confidence = "중간";
  } else {
    confidence = "낮음";
  }

  const signRatio = balanceRatioDiff > 0 ? `+${balanceRatioDiff}` : `${balanceRatioDiff}`;
  const signPrice = priceDiffRate > 0 ? `+${priceDiffRate}` : `${priceDiffRate}`;
  const signVol = volumeDiffRate > 0 ? `+${volumeDiffRate}` : `${volumeDiffRate}`;

  const summary = `잔고 ${signRatio}%p, 주가 ${signPrice}%, 거래량 ${signVol}% → "${label}, 신뢰도 ${confidence}"`;

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
