/**
 * Anthropic Claude API 및 AI 종목 분석 관련 데이터 타입 정의
 */

// 1. Claude API 단일 메시지 역할/콘텐츠 구조
export interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 2. Claude API 엔드포인트 요청 페이로드
export interface ClaudeApiRequest {
  prompt: string;
  system?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export type AnthropicApiRequest = ClaudeApiRequest;

// 3. Claude API 토큰 사용량 정보
export interface ClaudeUsageInfo {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
}

// 4. Claude API 엔드포인트 응답 구조
export interface ClaudeApiResponse {
  success: boolean;
  content: string;
  model: string;
  usage?: ClaudeUsageInfo;
  error?: string;
}

export type AnthropicApiResponse = ClaudeApiResponse;

// 5. AI 분석 입력을 위한 종목 상세 데이터 타입
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

// 6. Claude API 정밀 퀀트 분석 최종 판정 결과 구조
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

// 7. Claude 종목 보고서 분석 페이로드
export interface ClaudeReportAnalysisPayload {
  stock: StockDetailData;
  marketTrend?: {
    vkospi?: number;
    basis?: number;
    programNet?: number;
  };
  promptContext?: string;
}

// 8. /api/ai/stock-analysis 엔드포인트 요청 페이로드 타입
export interface AIAnalysisRequest {
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
  shortSignalLabel: string;
  shortSignalConfidence: string;
  shortSignalSummary: string;
  psy?: number | null;
  rsi?: number | null;
  macdHist?: number | null;
  volumeRatio?: number | null;
}

// 9. /api/ai/stock-analysis 엔드포인트 응답 타입
export interface AIAnalysisResponse {
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
}
