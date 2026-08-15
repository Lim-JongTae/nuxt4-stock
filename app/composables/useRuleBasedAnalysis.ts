import type { AIAnalysisRequest, AIAnalysisResponse } from '../../utils/types/claudeApi';
import { useStockDetailStore } from '../stores/useStockDetailStore';

/**
 * 8대 기술적 지표 및 공매도 수급 기반 룰 기반(Rule-Based) 종목 매매 진단 순수 비즈니스 계산 함수
 */
export function evaluateRuleBasedStockAnalysis(data: AIAnalysisRequest): AIAnalysisResponse {
  const {
    name,
    closePrice,
    isHolding,
    holdingAvgPrice,
    score,
    isFullyMatched,
    shortSignalLabel,
    psy,
    rsi,
    volumeRatio
  } = data;

  const now = new Date();
  const analyzedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  let decision: "매도" | "유지" | "매수" | "관찰" = "관찰";
  let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
  let confidence: "높음" | "중간" | "낮음" = "중간";
  let targetPrice = Math.round(closePrice * 1.15);
  let stopLossPrice = Math.round(closePrice * 0.93);
  let summary = "";
  const keyReasons: string[] = [];
  let riskFactor = "";
  let actionPlan = "";

  if (isHolding) {
    // === [보유 종목 케이스] ===
    const pnlRate = holdingAvgPrice && holdingAvgPrice > 0 
      ? Number((((closePrice - holdingAvgPrice) / holdingAvgPrice) * 100).toFixed(2)) 
      : 0;

    // 매도 조건: 8대 지표 우수하지 않고 수급 악화(신규 공매도 유입) 또는 손절가 위협
    if (score < 50 || shortSignalLabel === "신규 공매도 유입" || (pnlRate < -7.0)) {
      decision = "매도";
      badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-950/50 shadow-lg";
      confidence = "높음";
      targetPrice = Math.round(closePrice * 1.03);
      stopLossPrice = Math.round(closePrice * 0.95);
      summary = `현재 보유 중인 [${name}]은 8대 지표 약화 및 공매도 수급 부담(${shortSignalLabel})이 포착되어 리스크 관리를 위해 보유 비중 축소/매도를 권장합니다.`;
      
      keyReasons.push(`현재 수익률 ${pnlRate}% - 손절 및 이익보존 기준선 근접`);
      keyReasons.push(`공매도 수급 신호: "${shortSignalLabel}"로 하방 압력 존재`);
      keyReasons.push(`8대 기술적 퀀트 스코어 ${score}점으로 강세 모멘텀 둔화`);

      riskFactor = "추가 하락 리스크 및 잔고비율 증가로 인한 변동성 확대 위험";
      actionPlan = "분할 매도를 통해 현금 비중을 확보하고 추가 반등 시 잔여 수량 정리 전략 수립";
    } else {
      // 유지 (홀딩) 조건
      decision = "유지";
      badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/50 shadow-lg";
      confidence = "높음";
      targetPrice = Math.round(closePrice * 1.18);
      stopLossPrice = Math.round(holdingAvgPrice ? Math.min(holdingAvgPrice * 0.95, closePrice * 0.92) : closePrice * 0.92);
      summary = `보유 중인 [${name}]은 8대 지표(${score}점) 및 수급 상태가 안정적이어서 목표가(${targetPrice.toLocaleString()}원) 달성 시까지 홀딩(유지) 전략이 유효합니다.`;

      keyReasons.push(`현재 수익률 ${pnlRate}% - 안정적인 지지선 유지 중`);
      keyReasons.push(`공매도 수급 신호: "${shortSignalLabel}"로 숏커버링/매수 흡수 우위`);
      keyReasons.push(`8대 지표 점수 ${score}점으로 단기 정배열 및 과매도 탈출 지속`);

      riskFactor = "단기 상단 저항선 돌파 실패 시 박스권 지루한 흐름 가능성";
      actionPlan = `목표가 ${targetPrice.toLocaleString()}원 도달 시 익절 실행, 손절가 ${stopLossPrice.toLocaleString()}원 이탈 전까지 지속 홀딩`;
    }
  } else {
    // === [미보유 관심종목 케이스] ===
    // 매수 조건: 퀀트 점수 80점 이상 또는 완전 매칭 또는 숏커버링 유력
    if (isFullyMatched || score >= 80 || shortSignalLabel === "숏커버링(환매수) 유력" || shortSignalLabel === "매수세가 공매도 흡수 중") {
      decision = "매수";
      badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50 shadow-lg";
      confidence = "높음";
      targetPrice = Math.round(closePrice * 1.20);
      stopLossPrice = Math.round(closePrice * 0.93);
      summary = `관심종목 [${name}]은 8대 기술적 타점(${score}점)과 강력한 공매도 수급 신호(${shortSignalLabel})가 동시 성립하여 적극/분할 신규 매수 진입을 추천합니다.`;

      keyReasons.push(`8대 지표 퀀트 점수 ${score}점 (${isFullyMatched ? '100% 완전 매칭' : '우수 타점'})`);
      keyReasons.push(`수급 모멘텀: "${shortSignalLabel}" - 기관/외인 숏커버링 진입 포착`);
      keyReasons.push(`과매도 침체(PSY ${psy}%, RSI ${rsi}) 구간 이후 반등 기술적 타점`);

      riskFactor = "전체 시장 지수 급락 시 일시적 수급 이탈 가능성";
      actionPlan = `현재가(${closePrice.toLocaleString()}원) 부근에서 2~3회 분할 매수 진입, 목표가 ${targetPrice.toLocaleString()}원 설정`;
    } else {
      // 관찰 조건
      decision = "관찰";
      badgeClass = "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-950/50 shadow-lg";
      confidence = "중간";
      targetPrice = Math.round(closePrice * 1.12);
      stopLossPrice = Math.round(closePrice * 0.92);
      summary = `관심종목 [${name}]은 현재 일부 지표만 달성(점수 ${score}점)된 상태로, 추후 8대 지표 완결 및 확실한 매수 수급 확인 후 진입하도록 관찰(대기) 전략을 추천합니다.`;

      keyReasons.push(`8대 기술적 점수 ${score}점으로 완벽한 매수 조건 미달성`);
      keyReasons.push(`수급 상태: "${shortSignalLabel}" - 확실한 숏커버링 변환 대기 중`);
      keyReasons.push(`거래량 비율 ${volumeRatio}%로 수급 급증 확인 필요`);

      riskFactor = "섣부른 조기 진입 시 기간 조정에 따른 기회비용 발생 위험";
      actionPlan = `당장 매수하지 않고 관망 목록에 보관하며 퀀트 스코어 85점 이상 상향 돌파 시 매수 전환`;
    }
  }

  const expectedReturnRate = Number((((targetPrice - closePrice) / closePrice) * 100).toFixed(1));

  return {
    decision,
    badgeClass,
    confidence,
    targetPrice,
    stopLossPrice,
    expectedReturnRate,
    summary,
    keyReasons,
    riskFactor,
    actionPlan,
    analyzedAt
  };
}

/**
 * 사용자 원칙 적용 Composable
 * 
 * 1. API: 외부(LS증권/DB)에서 순수 데이터만 수신하여 반환
 * 2. 비즈니스 로직(Composable):
 *    - 평상시: Pinia Store(및 15일 LocalStorage)에서 자료를 가져와 무의미한 외부 토큰/API 호출 방지
 *    - 새로고침/갱신 요청 시: 외부 데이터 수집 API(/api/stock/[shcode])를 호출하여 신규 자료 가져옴
 *    - 가져온 자료를 비즈니스 로직에서 계산 후 View 화면에 표기
 */
export function useRuleBasedAnalysis() {
  const detailStore = useStockDetailStore();

  /**
   * 종목 퀀트 매매 진단 비즈니스 로직 함수
   * @param shcode 종목코드
   * @param forceRefresh 사용자가 새로고침 등을 요구하여 API 호출이 필요한지 여부 (기본값: false)
   */
  async function analyzeStock(shcode: string, forceRefresh = false): Promise<AIAnalysisResponse | null> {
    const cleanCode = String(shcode).trim().replace(/^A/i, '');
    let stockData = null;

    // 1. 무의미한 외부 토큰/API 호출을 줄이기 위해 Pinia Store에서 먼저 자료를 읽음
    if (!forceRefresh) {
      stockData = detailStore.getStockCache(cleanCode);
    }

    // 2. 캐시가 없거나, 사용자가 새로고침(forceRefresh)을 요청한 경우에만 외부 통신 API 호출!
    if (!stockData || forceRefresh) {
      stockData = await detailStore.fetchAndCacheStock(cleanCode); // 외부 시세 수집 API 호출
    }

    if (!stockData) return null;

    // 3. API 또는 Store에서 가져온 자료(변수)를 받아서 비즈니스 로직에서 계산 수행
    const requestPayload: AIAnalysisRequest = {
      shcode: stockData.shcode,
      name: stockData.name,
      industry: stockData.industry,
      closePrice: stockData.closePrice,
      isHolding: stockData.isHolding,
      holdingQuantity: stockData.holdingQuantity,
      holdingAvgPrice: stockData.holdingAvgPrice,
      score: stockData.score,
      isFullyMatched: stockData.isFullyMatched,
      conditions: stockData.conditions || {},
      shortSignalLabel: stockData.shortSignal?.label || '신호 분류 불가',
      shortSignalConfidence: stockData.shortSignal?.confidence || '낮음',
      shortSignalSummary: stockData.shortSignal?.summary || '',
      psy: stockData.psy,
      rsi: stockData.rsi,
      macdHist: stockData.macdHist,
      volumeRatio: stockData.volumeRatio
    };

    // 4. 계산된 결과를 View 화면으로 전달
    return evaluateRuleBasedStockAnalysis(requestPayload);
  }

  return {
    analyzeStock,
    evaluateRuleBasedStockAnalysis
  };
}
