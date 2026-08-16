/**
 * LS증권 Open API 및 기술적 수급 분석 관련 데이터 타입 정의
 */

// 1. LS증권 OAuth2 토큰 발급 응답 타입
export interface LSTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

// 2. LS증권 t1102 주식 현재가 시세 Block 타입
export interface LST1102OutBlock {
  shcode: string;
  hname?: string;
  price: string | number;
  sign?: string;
  change?: string | number;
  diff?: string | number;
  volume?: string | number;
  recprice?: string | number;
  open?: string | number;
  high?: string | number;
  low?: string | number;
}

// 3. LS증권 t8413/t1305 기간별주가(일봉) 차트 Item 타입
export interface LST8413ChartItem {
  date: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  jdiff_vol?: string | number;
  volume?: string | number;
  value?: string | number;
}

// 4. LS증권 t1927 공매도 일별 추이 Item 타입
export interface LST1927ShortSellItem {
  date: string;
  price: string | number;
  sign?: string;
  diff?: string | number;
  volume?: string | number;
  gm_vo?: string | number;
  gm_vo_sum?: string | number;
  gm_per?: string | number;
  ms_m_rate?: string | number;
  ms_rate?: string | number;
  gm_avg?: string | number;
}

// 5. 파싱된 일별 캔들 데이터 구조
export interface StockCandleData {
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  change?: number;
  diff?: number;
}

export type StockCandleMap = Map<string, StockCandleData>;

// 5.1 LS증권 시세/차트 수집 요청 파라미터 인터페이스
export interface FetchLSQuoteParams {
  token: string;
  shcode: string;
  externalLivePrice?: number | null;
}

// 6. 8대 기술적 지표 계산 결과 인터페이스
export interface TechnicalIndicators {
  psy: number | null;               // 심리선 (12일 기준, %)
  bbLower: number | null;           // 볼린저 밴드 하단 (20일, 2.0σ)
  ma5: number | null;               // 5일 이동평균선
  ma20: number | null;              // 20일 이동평균선
  ma60: number | null;              // 60일 이동평균선
  volumeRatio: number | null;       // 거래량 비율 (%)
  macdHist: number | null;          // MACD 오실레이터 히스토그램
  rsi: number | null;               // 상대강도지수 (14일, %)
  bullishDivergence: boolean | null; // 강세 다이버전스 성립 여부
}

// 7. 파싱된 공매도 시계열 레코드
export interface ShortSellRecord {
  date: string;                     // YYYY-MM-DD
  balanceRatio: number;             // 잔고비율 (%)
  price: number;                    // 주가 종가 (원)
  shortAvgPrice?: number;           // 공매도 평균체결가 (원)
  shortVolume?: number;             // 공매도 체결/매도 수량 (주)
  changeRate?: number;              // 주가 등락율 (%)
  volume: number;                   // 총 누적 거래량
}

// 8. 공매도/숏커버링 수급 분석 최종 결과
export interface ShortSellSignalResult {
  label: "신규 공매도 유입" | "숏커버링(환매수) 유력" | "매수세가 공매도 흡수 중" | "판단 보류" | "신호 분류 불가";
  confidence: "높음" | "중간" | "낮음";
  metrics: {
    balanceRatioDiff: number;       // 5일간 잔고비율 변화 (%p)
    priceDiffRate: number;          // 5일간 주가 변화율 (%)
    volumeDiffRate: number;         // 5일 평균 대비 거래량 변화율 (%)
  } | null;
  summary: string;
}

// 9. 종목 기본 정보 타입
export interface LSStockMaster {
  shcode: string;
  name: string;
  industry?: string;
  type?: 'holding' | 'watchlist';
  avgPrice?: number;
  quantity?: number;
}

// 10. 스크리너/조건검색 종합 결과 종목 Item
export interface LSScreenerStockResult {
  shcode: string;
  name: string;
  industry: string;
  closePrice: number;
  changeRate?: number;
  score: number;
  psy: number | null;
  rsi: number | null;
  bbLower: number | null;
  ma5: number | null;
  ma20: number | null;
  ma60?: number | null;
  volumeRatio: number | null;
  macdHist: number | null;
  shortSellingStatus: string;
  shortSellingConfidence?: string;
  shortSignalSummary?: string;
  isFullyMatched: boolean;
}

// 11. API에서 수신하는 순수 주식 데이터 구조
export interface RawStockApiData {
  shcode: string;
  name: string;
  industry: string;
  isHolding?: boolean;
  type?: string;
  holdingQuantity?: number;
  holdingAvgPrice?: number;
  closePrice: number;
  psy?: number | null;
  bbLower?: number | null;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  volumeRatio?: number | null;
  macdHist?: number | null;
  rsi?: number | null;
  bullishDivergence?: boolean | null;
  shortSellHistory?: ShortSellRecord[];
  dataSource?: string;
  errorMessage?: string | null;
}

// 12. 8대 지표 및 퀀트 스코어 비즈니스 계산이 완료된 종목 상세 구조
export interface CalculatedStockDetail {
  shcode: string;
  name: string;
  industry: string;
  isHolding: boolean;
  type?: string;
  holdingQuantity?: number;
  holdingAvgPrice?: number;
  closePrice: number;
  psy: number | null;
  bbLower: number | null;
  ma5: number | null;
  ma20: number | null;
  ma60: number | null;
  volumeRatio: number | null;
  macdHist: number | null;
  rsi: number | null;
  bullishDivergence: boolean | null;
  shortSellHistory: ShortSellRecord[];
  shortSignal: ShortSellSignalResult;
  conditions: Record<string, boolean>;
  score: number;
  isFullyMatched: boolean;
  dataSource?: string;
  errorMessage?: string | null;
}

// 13. 스크리너 종합 결과 StockItem 구조
export interface StockItem {
  id?: number;
  batchId?: string;
  shcode: string;
  name: string;
  industry: string;
  isHolding?: boolean;
  type?: string;
  quantity?: number;
  avgPrice?: number;
  holdingQuantity?: number;
  holdingAvgPrice?: number;
  closePrice: number;
  psy?: number | null;
  bbLower?: number | null;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
  volumeRatio?: number | null;
  macdHist?: number | null;
  rsi?: number | null;
  bullishDivergence?: boolean | null;
  shortSellingStatus?: string;
  shortSellingConfidence?: string;
  shortSellingSummary?: string;
  shortAvgPrice?: number | null;
  shortVolume?: number | null;
  shortSellMetrics?: {
    balanceRatioDiff: number;
    priceDiffRate: number;
    volumeDiffRate: number;
  } | null;
  changeRate?: number;
  score: number;
  isFullyMatched: boolean;
  shortSellHistory?: ShortSellRecord[];
  dataSource?: string;
  createdAt: string;
}

// 14. 시장 베이시스 및 선물/옵션 지표 구조
export interface MarketBasisInfo {
  basis: number;
  basisStatus: string;
  futuresPrice: number;
  kospi200Index: number;
  oi: number;
  programNetBuy: number;
  vkospi: number;
  updatedAt: string;
}

// 15. LS증권 상위 상승 유망 업종 타입 (t8424 / t1531)
export interface TopSectorInfo {
  code: string;
  name: string;
  rate: number;
}

// 16. Claude AI 시장 정밀 진단 결과 타입
export interface AiMarketAnalysisInfo {
  content: string;
  createdAt: string;
}

// 17. 스크리너 API 통신 응답 타입
export interface ScreenerApiResponse {
  success: boolean;
  timestamp: string;
  source: string;
  error?: string | null;
  oldData: StockItem[];
  newData: StockItem[];
  marketBasis?: MarketBasisInfo | null;
  topSectors?: TopSectorInfo[];
  bottomSectors?: TopSectorInfo[];
}

// 18. 종목 상세 스토어(useStockDetailStore) 상태 아이템 인터페이스
export interface StockDetailStateItem {
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
  shortSellHistory?: ShortSellRecord[];
  psy?: number | null;
  rsi?: number | null;
  macdHist?: number | null;
  volumeRatio?: number | null;
  bbLower?: number | null;
  generatedReport?: string;
  generatedReportAt?: string;
  updatedAt?: string;
  cachedTimestamp?: number;
}

// 19. 포트폴리오/보유종목(usePortfolioStore) 상태 아이템 인터페이스
export interface HoldingItem {
  id?: number;
  shcode: string;
  name: string;
  industry: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  trailingRate?: number;
  updatedAt: string;
  candles?: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}
