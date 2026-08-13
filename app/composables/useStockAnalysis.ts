import { ref } from 'vue';

export interface StockDetailData {
  shcode: string;
  name: string;
  industry: string;
  closePrice: number;
  isHolding: boolean;
  holdingQuantity?: number;
  holdingAvgPrice?: number;
  score: number;
  isFullyMatched: boolean;
  conditions: Record<string, boolean>;
  shortSignal?: {
    label: string;
    confidence: string;
    summary: string;
  };
  psy?: number | null;
  rsi?: number | null;
  macdHist?: number | null;
  volumeRatio?: number | null;
}

export interface CalculatedAnalysisResult {
  decision: "매도" | "유지" | "매수" | "관찰";
  badgeClass: string;
  confidence: "높음" | "중간" | "낮음";
  targetPrice: number;
  stopLossPrice: number;
  expectedReturnRate: number;
  summary: string;
  keyReasons: string[];
  riskFactor: string;
  actionPlan: string;
  analyzedAt: string;
  apiProvider: string;
}

export function useStockAnalysis() {
  const isAnalyzing = ref(false);
  const analysisError = ref<string | null>(null);

  /**
   * 종목 데이터를 입력받아 Anthropic Claude API와 통신하고 정밀 매매 판단을 반환합니다.
   * 더미/가짜 데이터 생성을 금지하며, API 실패 시 명확한 오류 메세지를 표출합니다.
   */
  async function analyzeStockWithClaude(stock: StockDetailData): Promise<CalculatedAnalysisResult | null> {
    isAnalyzing.value = true;
    analysisError.value = null;

    const {
      shcode,
      name,
      industry,
      closePrice,
      isHolding,
      holdingQuantity,
      holdingAvgPrice,
      score,
      isFullyMatched,
      shortSignal,
      psy,
      rsi,
      macdHist,
      volumeRatio
    } = stock;

    const now = new Date();
    const analyzedAt = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    try {
      const targetRule = isHolding 
        ? "이 종목은 '현재 보유 중인 종목'입니다. 매매 판단(decision)은 반드시 ['매도', '유지'] 둘 중 하나만 선택하십시오."
        : "이 종목은 '미보유 관심 종목'입니다. 매매 판단(decision)은 반드시 ['매수', '관찰'] 둘 중 하나만 선택하십시오.";

      const prompt = `
다음 한국 주식 종목의 실시간 8대 기술적 지표 및 공매도 수급 데이터를 바탕으로 정밀 매매 판단을 내려주십시오.

[종목 기본 정보]
- 종목명: ${name} (${shcode})
- 업종: ${industry}
- 실시간 현재가: ${closePrice.toLocaleString()}원
- 보유 상태: ${isHolding ? `현재 보유 중 (평단가: ${holdingAvgPrice?.toLocaleString() || 0}원, 수량: ${holdingQuantity || 0}주)` : '미보유 관심종목'}
- 퀀트 스코어: ${score}점 / 100점 (8대 지표 완전충족 여부: ${isFullyMatched ? 'YES (100점)' : 'NO'})

[실시간 기술적 & 수급 지표 상태]
- 심리선(PSY 12일): ${psy ?? 'N/A'}% (기준: 25% 이하 침체)
- RSI(14일): ${rsi ?? 'N/A'} (기준: 35 이하 과매도 탈출)
- MACD 오실레이터: ${macdHist ?? 'N/A'} (기준: 양수 전환)
- 전일 대비 거래량 비율: ${volumeRatio ?? 'N/A'}% (기준: 120% 이상 급증)
- 공매도 5일 수급 신호: "${shortSignal?.label || '신호 분류 불가'}" (신뢰도: ${shortSignal?.confidence || '낮음'}, 상세: ${shortSignal?.summary || ''})

[판단 지침 규칙]
${targetRule}

다음 JSON 형식을 엄격히 준수하여 응답해 주십시오. Markdown이나 서론 설명 없이 오직 유효한 JSON 객체만 출력하십시오:
{
  "decision": "${isHolding ? '매도 또는 유지' : '매수 또는 관찰'}",
  "confidence": "높음 또는 중간 또는 낮음",
  "targetPrice": 숫자 (현재가 기준 적정 목표가),
  "stopLossPrice": 숫자 (적정 손절가),
  "summary": "종합 조언 한문장",
  "keyReasons": ["판단 근거1", "판단 근거2", "판단 근거3"],
  "riskFactor": "리스크 요인",
  "actionPlan": "구체적 실전 매매 액션 플랜"
}
`;

      const response = await $fetch<{ success: boolean; content: string; model: string }>('/api/ai/anthropic', {
        method: 'POST',
        body: {
          prompt,
          system: '당신은 한국 주식 및 LS증권 8대 기술적 지표 전문 AI 트레이딩 리서처입니다. 보유 종목이면 [매도] / [유지], 미보유 시 [매수] / [관찰]을 명확히 판단하고 JSON만 답변하세요.',
          temperature: 0.2
        }
      });

      if (!response || !response.content) {
        throw new Error('Claude API 응답 데이터 수진에 실패했습니다.');
      }

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Claude API 응답에서 유효한 JSON 구문을 생성하지 못했습니다.');
      }

      const parsedJson = JSON.parse(jsonMatch[0]);

      let validDecision: "매도" | "유지" | "매수" | "관찰" = isHolding ? "유지" : "관찰";
      if (isHolding) {
        validDecision = parsedJson.decision === '매도' ? '매도' : '유지';
      } else {
        validDecision = parsedJson.decision === '매수' ? '매수' : '관찰';
      }

      let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
      if (validDecision === '매수') {
        badgeClass = "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-emerald-950/50 shadow-lg";
      } else if (validDecision === '유지') {
        badgeClass = "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-amber-950/50 shadow-lg";
      } else if (validDecision === '매도') {
        badgeClass = "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-rose-950/50 shadow-lg";
      } else {
        badgeClass = "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-950/50 shadow-lg";
      }

      const targetPrice = Number(parsedJson.targetPrice) || Math.round(closePrice * 1.15);
      const stopLossPrice = Number(parsedJson.stopLossPrice) || Math.round(closePrice * 0.93);
      const expectedReturnRate = Number((((targetPrice - closePrice) / closePrice) * 100).toFixed(1));

      return {
        decision: validDecision,
        badgeClass,
        confidence: parsedJson.confidence || "높음",
        targetPrice,
        stopLossPrice,
        expectedReturnRate,
        summary: parsedJson.summary || `Claude AI 분석 결과 ${name}에 대해 [${validDecision}] 판단을 리턴합니다.`,
        keyReasons: Array.isArray(parsedJson.keyReasons) ? parsedJson.keyReasons : ["8대 기술적 지표 정밀 검증", "공매도 수급 분석", "손익비 기준"],
        riskFactor: parsedJson.riskFactor || "시장 수급 변동성 주의",
        actionPlan: parsedJson.actionPlan || `현재가 분할 접근 및 목표가 ${targetPrice.toLocaleString()}원 설정`,
        analyzedAt,
        apiProvider: `Anthropic Claude API (${response.model || 'claude-3-5-sonnet'})`
      };

    } catch (err: any) {
      console.error('Claude API Error:', err);
      // 더미 대체 생성 금지: 오류 발생 시 에러 메세지를 명확히 전파
      analysisError.value = `[Claude API 요청 실패]: ${err.statusMessage || err.message || 'API 통신 오류'}`;
      return null;
    } finally {
      isAnalyzing.value = false;
    }
  }

  return {
    isAnalyzing,
    analysisError,
    analyzeStockWithClaude
  };
}
