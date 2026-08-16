# nuxt4-stock 프로젝트 전체 코드 분석 보고서

## 📋 프로젝트 개요

**프로젝트명**: nuxt4-stock  
**프레임워크**: Nuxt 4 (Vue 3 + TypeScript)  
**목적**: LS증권 Open API와 Anthropic Claude AI를 연동한 퀀트 트레이딩 스크리너 및 주식 투자 포털  
**아키텍처**: 중앙집중식 데이터 관리 + Composable 비즈니스 로직 + Pinia Store + SQLite DB

---

## 🏗️ 아키텍처 구조

### 1. 전체 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                    프론트엔드 (Nuxt 4 App)                        │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Pages     │→│ Components  │→│   Stores    │            │
│  │  (Vue SFC)  │  │  (Vue SFC)  │  │   (Pinia)   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         ↓                ↓                 ↓                    │
│  ┌──────────────────────────────────────────────────┐          │
│  │         Composables (비즈니스 로직)                │          │
│  │  • useQuantIndicatorCalculator (8대 지표 계산)    │          │
│  │  • useShortSellSignal (공매도 수급 분석)           │          │
│  │  • useStockAnalysis (종합 분석)                   │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            ↓ API 호출
┌─────────────────────────────────────────────────────────────────┐
│                    백엔드 (Nuxt Server API)                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Screener API│→│  LS Utils   │→│    SQLite   │            │
│  │   (POST)    │  │  (OAuth2)   │  │   Database  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│         ↓                ↓                                      │
│  ┌──────────────────────────────────────────────────┐          │
│  │       LS증권 Open API 통합 레이어                  │          │
│  │  • lsAuth.ts (OAuth2 토큰 관리)                   │          │
│  │  • lsQuotes.ts (t1102 실시간가)                   │          │
│  │  • lsIndicators.ts (t1305 기간별주가)             │          │
│  │  • lsShortSell.ts (t1927 공매도일별추이)          │          │
│  │  • lsMarket.ts (t8424 업종별상승률)                │          │
│  └──────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                            ↓ HTTP API
┌─────────────────────────────────────────────────────────────────┐
│              외부 API (LS증권 + Anthropic Claude)                 │
├─────────────────────────────────────────────────────────────────┤
│  • LS증권 Open API (openapi.ls-sec.co.kr)                        │
│  • Anthropic Claude API (AI 시장 진단 및 분석)                    │
└─────────────────────────────────────────────────────────────────┘
```

### 2. 데이터 플로우 (무하드코딩 원칙)

```
[LS증권 API] → [Server Utils] → [SQLite DB] → [Pinia Store] 
                                                     ↓
                                            [Composables 계산]
                                                     ↓
                                            [Vue Components]
                                                     ↓
                                              [UI 렌더링]
```

**핵심 원칙**:
- ✅ 모든 데이터는 LS증권 API에서 동적으로 수신
- ✅ 하드코딩된 시세/지표 값 절대 금지
- ✅ 중앙집중식 타입 관리 (`utils/types/lsSecurities.ts`)
- ✅ Store → LocalStorage 5일 캐싱 (주식 거래일 1주일)
- ✅ F5 새로고침 시 실시간 데이터 갱신

---

## 📁 디렉토리 구조 분석

### 1. `/app` - 프론트엔드 애플리케이션

#### 📂 `/app/pages` - 라우팅 페이지
```
pages/
├── index.vue               # 메인 대시보드 (시장 개요)
├── portfolio.vue           # 보유종목 포트폴리오
├── watchlist.vue           # 관심종목 목록
├── screener.vue            # 퀀트 스크리너 (8대 지표 필터링)
├── reports.vue             # AI 분석 보고서
├── settings.vue            # 설정
├── test.vue                # 테스트/디버그 페이지
└── stock/[shcode].vue      # 종목 상세 페이지 (동적 라우팅)
```

#### 📂 `/app/components` - Vue 컴포넌트
```
components/
├── DashboardView.vue           # 대시보드 메인 뷰
├── HoldingsView.vue            # 보유종목 테이블
├── WatchlistView.vue           # 관심종목 테이블
├── ScreenerView.vue            # 스크리너 조건 검색
├── PortfolioView.vue           # 포트폴리오 분석
├── ReportsView.vue             # 보고서 목록
├── StockDetailView.vue         # 종목 상세 뷰
├── StockDetailModal.vue        # 종목 상세 모달
├── StockEditModal.vue          # 종목 수정 모달
├── Navbar.vue                  # 네비게이션 바
├── GlobalToastContainer.vue    # 전역 토스트 알림
├── reports/                    # 보고서 전용 컴포넌트
│   ├── ReportHeaderBanner.vue  # 보고서 헤더
│   ├── ReportMatrixTable.vue   # 매트릭스 테이블
│   ├── ReportSummaryMetrics.vue# 요약 지표
│   ├── ReportTopRecommendations.vue # 추천 종목
│   └── ReportAiViewer.vue      # AI 분석 뷰어
├── shortselling/               # 공매도 전용 컴포넌트
│   └── ShortSellReportModal.vue# 공매도 리포트 모달
└── test/                       # 테스트 컴포넌트
    ├── ConditionHeader.vue
    ├── ConditionMetrics.vue
    ├── ConditionResultTable.vue
    └── ConditionAiViewer.vue
```

#### 📂 `/app/composables` - 비즈니스 로직 (핵심!)
```
composables/
├── useQuantIndicatorCalculator.ts  # ★ 8대 기술적 지표 계산 로직
├── useShortSellSignal.ts           # ★ 공매도 수급 신호 분류
├── useStockAnalysis.ts             # 종합 종목 분석
├── useRuleBasedAnalysis.ts         # 룰 기반 매매 판단
├── useMarketStrategy.ts            # 시장 전략 분석
└── useGlobalToast.ts               # 전역 토스트 알림
```

**핵심 Composable 상세**:

1️⃣ **`useQuantIndicatorCalculator.ts`**  
   - 8대 기술적 지표 조건 검사 (심리선, 볼린저밴드, 이평선, 거래량, MACD, RSI, 다이버전스, 공매도)
   - 퀀트 스코어 계산 (최대 100점)
   - `isFullyMatched` 판정 (8/8 조건 충족 여부)

2️⃣ **`useShortSellSignal.ts`**  
   - 공매도 시계열 데이터 분석
   - 4가지 라벨 분류: "숏커버링(환매수) 유력", "신규 공매도 유입", "매수세가 공매도 흡수 중", "판단 보류"
   - 신뢰도 3단계: 높음(5일+), 중간(3~4일), 낮음(2일-)

#### 📂 `/app/stores` - Pinia 상태 관리
```
stores/
├── useLSStockRawStore.ts       # ★ 중앙 원천 데이터 스토어 (SSOT)
├── useScreenerStore.ts         # 스크리너 상태 관리
├── usePortfolioStore.ts        # 포트폴리오 상태 관리
├── useWatchlistStore.ts        # 관심종목 상태 관리
└── useStockDetailStore.ts      # 종목 상세 상태 관리
```

**SSOT (Single Source of Truth) 패턴**:
- `useLSStockRawStore`: 모든 LS증권 API 데이터의 중앙 저장소
- 다른 스토어들은 이 원천 스토어를 참조하여 파생 데이터 생성
- LocalStorage 5일 캐싱 (주식 거래일 1주일)

### 2. `/server` - 백엔드 API 서버

#### 📂 `/server/api` - API 엔드포인트
```
api/
├── screener/
│   ├── index.post.ts               # ★ 메인 스크리너 API (동적 종목 수집)
│   └── condition-search.get.ts     # 조건 검색 API
├── holdings/
│   ├── index.get.ts                # 보유종목 목록 조회
│   └── price.get.ts                # 보유종목 실시간가 조회
├── watchlist/
│   ├── index.get.ts                # 관심종목 목록 조회
│   └── price.get.ts                # 관심종목 실시간가 조회
├── stocks/
│   ├── index.get.ts                # 전체 종목 조회
│   ├── index.post.ts               # 종목 추가
│   ├── [shcode].put.ts             # 종목 수정
│   └── [shcode].delete.ts          # 종목 삭제
├── stock/
│   └── [shcode].get.ts             # 특정 종목 상세 조회
├── ai/
│   ├── analyze.post.ts             # AI 종목 분석
│   ├── anthropic.post.ts           # Anthropic API 호출
│   ├── market-diagnosis.post.ts    # AI 시장 진단
│   └── short-sell-signal.post.ts   # AI 공매도 신호 분석
└── report/
    └── save.post.ts                # 보고서 저장
```

#### 📂 `/server/utils/ls` - LS증권 API 통합 레이어
```
ls/
├── lsAuth.ts           # ★ OAuth2 토큰 발급 및 캐싱
├── lsQuotes.ts         # t1102 실시간가 조회
├── lsIndicators.ts     # t1305 기간별주가(65일봉) 조회 + 8대 지표 계산
├── lsShortSell.ts      # t1927 공매도일별추이 조회
└── lsMarket.ts         # t8424 업종별 시세 조회
```

**핵심 유틸 상세**:

1️⃣ **`lsAuth.ts`**  
   - OAuth2 토큰 발급 (`getLSToken`)
   - 멀티 계정 토큰 캐싱 (Map 구조)
   - 만료 60초 전 자동 갱신
   - 숫자 파싱 헬퍼 (`parseLSNumber`, `parseLSNumberOrUndefined`)
   - 국내 종목코드 검증 (`sanitizeDomesticShcode`)

2️⃣ **`lsIndicators.ts`**  
   - t1305 기간별주가 TR 호출 (65일봉)
   - 8대 기술적 지표 계산:
     - 심리선 (PSY 12일)
     - 볼린저밴드 (20일, 2σ)
     - 이동평균선 (5일, 20일, 60일)
     - 거래량 비율
     - MACD 오실레이터
     - RSI (14일)
     - 강세 다이버전스

3️⃣ **`lsShortSell.ts`**  
   - t1927 공매도일별추이 TR 호출
   - 최근 5일 공매도 잔고비율 추이 파싱
   - 주가 등락률 계산

#### 📂 `/server/db` - SQLite 데이터베이스
```
db/
├── index.ts            # Drizzle ORM 초기화
├── schema.ts           # 테이블 스키마 정의
└── seed_stocks.ts      # 초기 종목 데이터 시드
```

**테이블 구조**:
- `stocks`: 종목 통합 마스터 테이블
- `holdings`: 보유종목 테이블 (수량, 평균단가)
- `watchlist`: 관심종목 테이블

### 3. `/utils/types` - 중앙집중식 타입 관리

```
types/
├── lsSecurities.ts     # ★ LS증권 API 및 종목 데이터 타입 정의 (28개 인터페이스)
└── index.ts            # 타입 재수출
```

**주요 타입 (lsSecurities.ts)**:
```typescript
// 1. LS증권 API 응답 타입
LSTokenResponse, LST1102OutBlock, LST8413ChartItem, LST1927ShortSellItem

// 2. 기술적 지표 타입
TechnicalIndicators, StockCandleData, StockCandleMap

// 3. 공매도 분석 타입
ShortSellRecord, ShortSellSignalResult

// 4. 종목 데이터 타입
RawStockApiData, CalculatedStockDetail, StockItem

// 5. 시장 분석 타입
MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo

// 6. API 응답 타입
ScreenerApiResponse, StockDetailStateItem, HoldingItem
```

### 4. `/skills` - AI 에이전트 스킬

```
skills/
├── daily-news-report/      # 일일 뉴스 리포트 (웹 스크래핑 + AI 요약)
├── ls-stock-screener/      # LS증권 6대 지표 스크리너
├── quant-analyst/          # 퀀트 전략 분석가
├── trading-ledger/         # 매매 일지 관리
└── xvary-stock-research/   # 심층 종목 리서치
```

---

## 🔑 핵심 기능 분석

### 1. 8대 기술적 지표 스크리닝 시스템

**위치**: `app/composables/useQuantIndicatorCalculator.ts`

```typescript
export function calculateQuantIndicators(raw: RawStockApiData): CalculatedStockDetail {
  // 1. 심리선 (PSY ≤ 25%) - 과매도 침체 구간
  const cond_psy = typeof psy === 'number' && psy <= 25.0;

  // 2. 볼린저밴드 하단 (종가 ≤ 하단선 × 1.02)
  const cond_bb = typeof bbLower === 'number' && bbLower > 0 
    && closePrice <= Math.round(bbLower * BOLLINGER_BAND_TOLERANCE_RATE);

  // 3. 이평선 정배열 전환 (5일선 ≥ 20일선 ≥ 60일선)
  const cond_ma_turn = typeof ma5 === 'number' && typeof ma20 === 'number' 
    && typeof ma60 === 'number' && ma5 > 0 && ma20 > 0 && ma60 > 0 
    && ma5 >= ma20 && ma20 >= ma60;

  // 4. 거래량 증가 (전일 대비 ≥ 120%)
  const cond_volume = typeof volumeRatio === 'number' && volumeRatio >= 120.0;

  // 5. MACD 반전 (히스토그램 > 0)
  const cond_macd = typeof macdHist === 'number' && macdHist > 0;

  // 6. RSI 과매도 탈출 (RSI ≤ 35)
  const cond_rsi = typeof rsi === 'number' && rsi <= 35.0;

  // 7. 강세 다이버전스
  const cond_divergence = bullishDivergence === true;

  // 8. 공매도 수급 신호 (숏커버링 또는 매수세 흡수)
  const shortSignal = classifyShortSellSignal(shortSellHistory);
  const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" 
    || shortSignal.label === "매수세가 공매도 흡수 중";

  // 퀀트 스코어 계산 (최대 100점)
  let score = 0;
  if (cond_psy) score += 10;
  if (cond_bb) score += 10;
  if (cond_ma_turn) score += 15;
  if (cond_volume) score += 15;
  if (cond_macd) score += 10;
  if (cond_rsi) score += 10;
  if (cond_divergence) score += 15;
  score += shortSignalScore; // 신뢰도별 7~15점

  // 완전 매칭 판정 (8/8 조건 충족)
  const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume 
    && cond_macd && cond_rsi && cond_divergence && cond_short_signal;

  return { /* ... */ };
}
```

**스코어링 체계**:
| 지표 | 배점 | 조건 |
|------|------|------|
| 심리선 (PSY) | 10점 | ≤ 25% |
| 볼린저밴드 | 10점 | 종가 ≤ 하단선 × 1.02 |
| 이평선 정배열 | 15점 | 5일 ≥ 20일 ≥ 60일 |
| 거래량 증가 | 15점 | ≥ 120% |
| MACD 반전 | 10점 | 히스토그램 > 0 |
| RSI 과매도 탈출 | 10점 | ≤ 35 |
| 강세 다이버전스 | 15점 | 성립 |
| 공매도 수급 | 7~15점 | 신뢰도별 차등 |
| **합계** | **최대 100점** | |

### 2. 공매도 수급 신호 분석 시스템

**위치**: `app/composables/useShortSellSignal.ts`

```typescript
export function classifyShortSellSignal(
  shortSellData: ShortSellRecord[], 
  isEtfOrForeign?: boolean
): ShortSellSignalResult {
  // ETF/ETN 제외 처리
  if (isEtfOrForeign) {
    return { label: "판단 보류", confidence: "낮음", /* ... */ };
  }

  // 날짜 오름차순 정렬 (과거 → 최신)
  const sortedData = [...shortSellData].sort((a, b) => 
    safeParseTimestamp(a.date) - safeParseTimestamp(b.date)
  );

  const start = sortedData[0];
  const latest = sortedData[sortedData.length - 1];
  const daysCount = sortedData.length;

  // 1. 잔고비율 변화 (%p)
  const balanceRatioDiff = Number((latest.balanceRatio - start.balanceRatio).toFixed(2));

  // 2. 주가 변화율 (%)
  const priceDiffRate = start.price > 0 
    ? Number((((latest.price - start.price) / start.price) * 100).toFixed(2))
    : 0;

  // 3. 거래량 변화율 (%)
  const avgVolume = totalVol / daysCount;
  const volumeDiffRate = avgVolume > 0 
    ? Number((((latest.volume - avgVolume) / avgVolume) * 100).toFixed(2))
    : 0;

  // 4가지 라벨 분류
  let label: ShortSellSignalResult["label"] = "판단 보류";
  if (balanceRatioDiff < 0) {
    label = "숏커버링(환매수) 유력"; // 잔고 감소
  } else if (balanceRatioDiff > 0 && priceDiffRate < 0) {
    label = "신규 공매도 유입"; // 잔고 증가 & 주가 하락
  } else if (balanceRatioDiff > 0 && priceDiffRate >= 0) {
    label = "매수세가 공매도 흡수 중"; // 잔고 증가 & 주가 상승
  }

  // 신뢰도 판정 (수집 일수 기반)
  let confidence: ShortSellSignalResult["confidence"] = "낮음";
  if (daysCount >= 5) confidence = "높음";
  else if (daysCount >= 3) confidence = "중간";
  else confidence = "낮음";

  return { label, confidence, metrics: { /* ... */ }, summary };
}
```

**신호 분류 로직**:
```
잔고비율 변화 (balanceRatioDiff)
     │
     ├─ < 0  → "숏커버링(환매수) 유력"
     │
     └─ > 0
          │
          ├─ 주가 < 0  → "신규 공매도 유입"
          │
          └─ 주가 ≥ 0  → "매수세가 공매도 흡수 중"
```

### 3. 중앙집중식 데이터 아키텍처

**SSOT (Single Source of Truth) 패턴**:

1️⃣ **원천 데이터 스토어** (`useLSStockRawStore`)
```typescript
export const useLSStockRawStore = defineStore('ls-stock-raw', {
  state: () => ({
    rawStockList: [] as RawStockApiData[],
    marketBasis: null as MarketBasisInfo | null,
    topSectors: [] as TopSectorInfo[],
    bottomSectors: [] as TopSectorInfo[],
    lastUpdated: '',
    sourceProvider: 'LS증권 Open API',
    isLoading: false,
    errorMessage: null as string | null
  }),

  actions: {
    async fetchRawStockData(forceRefresh = false) {
      // LocalStorage 캐시 체크 (5일)
      if (!forceRefresh) {
        const cached = this.loadFromCache();
        if (cached && this.isCacheValid(cached.timestamp)) {
          this.hydrate(cached);
          return;
        }
      }

      // LS증권 API 호출
      const res = await $fetch<ScreenerApiResponse>('/api/screener/index', {
        method: 'POST'
      });

      this.rawStockList = res.newData;
      this.marketBasis = res.marketBasis;
      this.topSectors = res.topSectors;
      this.bottomSectors = res.bottomSectors;
      this.lastUpdated = res.timestamp;

      // LocalStorage에 5일간 저장
      this.saveToCache();
    }
  }
});
```

2️⃣ **파생 데이터 스토어** (`useScreenerStore`)
```typescript
export const useScreenerStore = defineStore('screener', {
  getters: {
    // 원천 스토어 참조 (SSOT)
    lastUpdated: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.lastUpdated || '';
    },
    marketBasis: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.marketBasis;
    },
    topSectors: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.topSectors;
    },
    // ...
  },

  actions: {
    recalculateFromRaw() {
      const rawStore = useLSStockRawStore();
      
      // Composable로 8대 지표 재계산
      const calculatedItems = rawStore.rawStockList.map(item => {
        const quantResult = calculateQuantIndicators({
          shcode: item.shcode,
          name: item.name,
          closePrice: item.closePrice,
          psy: item.psy,
          // ...
        });

        return {
          ...item,
          score: quantResult.score,
          isFullyMatched: quantResult.isFullyMatched
        };
      });

      this.newData = calculatedItems;
    }
  }
});
```

### 4. LS증권 API 통합 플로우

**메인 스크리너 API** (`server/api/screener/index.post.ts`):

```typescript
export default defineEventHandler(async (event) => {
  // 1. OAuth2 토큰 발급
  const { token, error } = await getLSToken(appKey, appSecret);

  // 2. SQLite DB에서 보유종목 + 관심종목 로드
  const dbStocks = await db.select().from(stocks);
  const dbHoldings = await db.select().from(holdings);
  const dbWatchlist = await db.select().from(watchlist);

  // 3. 종목 통합 맵 생성
  const stockMap = new Map<string, { /* ... */ }>();
  // holdings → stockMap
  // watchlist → stockMap
  // stocks → stockMap

  const candidateStocks = Array.from(stockMap.values());

  // 4. LS증권 API 배치 호출 (Rate Limit 준수: 650ms 딜레이)
  for (let i = 0; i < candidateStocks.length; i += BATCH_SIZE) {
    const batch = candidateStocks.slice(i, i + BATCH_SIZE);
    
    await Promise.allSettled(batch.map(async (stock) => {
      // 병렬 호출
      const [livePrice, htsPriceMap, shortSellTrend] = await Promise.all([
        fetchLSPrice(token, stock.shcode),      // t1102 실시간가
        fetchLST1305Prices(token, stock.shcode), // t1305 65일봉
        fetchLSShortSellTrend(token, stock.shcode) // t1927 공매도
      ]);

      // 지표 계산
      const indicators = calculateTechnicalIndicators(htsPriceMap);

      stockLiveMap.set(stock.shcode, {
        price: livePrice,
        indicators,
        shortSellHistory: shortSellTrend
      });
    }));

    // Rate Limit 준수
    if (i + BATCH_SIZE < candidateStocks.length) {
      await new Promise(resolve => setTimeout(resolve, 650));
    }
  }

  // 5. 8대 지표 & 퀀트 스코어 계산
  const newBatch = candidateStocks.map(s => {
    const liveData = stockLiveMap.get(s.shcode);
    
    // 조건 검사
    const cond_psy = typeof psy === 'number' && psy <= 25.0;
    const cond_bb = /* ... */;
    // ...

    // 공매도 신호
    const shortSignal = classifyShortSellSignal(shortSellHistory);
    
    // 스코어 산정
    let score = 0;
    if (cond_psy) score += 15;
    if (cond_bb) score += 15;
    // ...

    return { /* ... */ };
  });

  // 6. 응답 반환
  return {
    success: true,
    timestamp: localTime,
    source: 'LS증권 Open API',
    newData: newBatch,
    marketBasis,
    topSectors,
    bottomSectors
  };
});
```

---

## 🔧 기술 스택

### 프론트엔드
- **Nuxt 4**: Vue 3 기반 풀스택 프레임워크
- **Vue 3**: Composition API, TypeScript
- **Pinia**: 상태 관리
- **Tailwind CSS 4**: 유틸리티 CSS 프레임워크
- **@nuxt/ui**: Nuxt UI 컴포넌트 라이브러리
- **TipTap**: 리치 텍스트 에디터 (보고서 작성)
- **Marked**: 마크다운 파서

### 백엔드
- **Nuxt Server (Nitro)**: 서버리스 API
- **Drizzle ORM**: TypeScript ORM
- **Better-SQLite3**: SQLite 데이터베이스
- **Node.js**: 런타임

### 외부 API
- **LS증권 Open API**: OAuth2 인증, 실시간 시세/지표
- **Anthropic Claude API**: AI 시장 분석 및 종목 진단

### 개발 도구
- **TypeScript 6**: 정적 타입 체크
- **Drizzle Kit**: 마이그레이션 도구

---

## 📊 데이터베이스 스키마

**파일**: `server/db/schema.ts`

### 1. `stocks` - 종목 통합 마스터
```typescript
export const stocks = sqliteTable('stocks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shcode: text('shcode').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  type: text('type', { enum: ['holding', 'watchlist'] }),
  quantity: integer('quantity').default(0),
  avgPrice: integer('avg_price').default(0),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});
```

### 2. `holdings` - 보유종목
```typescript
export const holdings = sqliteTable('holdings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shcode: text('shcode').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  quantity: integer('quantity').notNull(),
  avgPrice: integer('avg_price').notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});
```

### 3. `watchlist` - 관심종목
```typescript
export const watchlist = sqliteTable('watchlist', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  shcode: text('shcode').notNull().unique(),
  name: text('name').notNull(),
  industry: text('industry'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`)
});
```

---

## 🎯 주요 비즈니스 로직

### 1. 텍스트 컬러 규칙
```
양수 (증가) → 붉은색 (상승)
음수 (감소) → 푸른색 (하락)
보합 (0)    → 하늘색
```

### 2. 주식 시세 조회 표준
- **모든 종목**: LS증권 `t1305` TR (기간별주가)
- **파라미터**: `exchgubun: "U"` (통합시세 KRX+NXT)
- **절대 금지**: 하드코딩된 시세/지표 값

### 3. 데이터 보존 정책
- **Store + LocalStorage**: 5일 (주식 거래일 1주일)
- **자동 제거**: 5일 이상 경과 데이터
- **갱신 트리거**: F5 새로고침, 시세 조회 버튼

### 4. 오류 처리 원칙
- **API 실패 시**: 붉은색 오류 배너 표시
- **절대 금지**: 대체/가짜 데이터 생성
- **명확한 사유**: 사용자에게 오류 원인 표시

### 5. 타입 관리 원칙
- **중앙 집중**: `utils/types/` 디렉터리
- **import 사용**: 필요 시 타입 가져오기
- **금지**: 컴포넌트/API별 개별 타입 정의

---

## 🚀 실행 플로우

### 1. 애플리케이션 시작
```bash
npm run dev  # 개발 서버 실행 (http://localhost:3000)
```

### 2. 초기 로딩 시퀀스
```
1. Nuxt 앱 초기화
   ↓
2. Pinia 스토어 hydration (LocalStorage 캐시 로드)
   ↓
3. 캐시 유효성 검사 (5일 이내?)
   ↓
4-a. [캐시 유효] → 즉시 UI 렌더링 (0ms)
4-b. [캐시 만료] → LS증권 API 호출
   ↓
5. 원천 데이터 수신 → useLSStockRawStore 저장
   ↓
6. Composable 계산 (8대 지표, 공매도 신호)
   ↓
7. 파생 스토어 업데이트 (useScreenerStore 등)
   ↓
8. UI 렌더링
   ↓
9. LocalStorage 캐시 저장 (5일 보존)
```

### 3. 새로고침 시퀀스 (F5)
```
1. 사용자 F5 또는 "새로고침" 버튼
   ↓
2. LS증권 API 강제 재호출 (forceRefresh: true)
   ↓
3. 신규 데이터 수신
   ↓
4. 원천 스토어 업데이트
   ↓
5. Composable 재계산
   ↓
6. 파생 스토어 업데이트
   ↓
7. UI 실시간 갱신
   ↓
8. LocalStorage 캐시 덮어쓰기
```

### 4. AI 분석 요청 시퀀스
```
1. 사용자 "AI 정밀 진단" 버튼 클릭
   ↓
2. /api/ai/market-diagnosis POST 요청
   ↓
3. 서버: Anthropic Claude API 호출
   - 입력: 상위 업종 + 매칭 종목 + 시장 베이시스
   - 프롬프트: server/prompts/quantSystemPrompt.ts
   ↓
4. Claude AI 응답 수신 (시장 진단 텍스트)
   ↓
5. useScreenerStore.aiMarketAnalysis 업데이트
   ↓
6. ReportAiViewer 컴포넌트 렌더링
```

---

## 📝 주요 파일 코드 리뷰

### 1. `useQuantIndicatorCalculator.ts` (핵심 비즈니스 로직)

**강점**:
- ✅ 명확한 8대 지표 조건 검사
- ✅ 타입 안전성 (`typeof === 'number'` 엄격 체크)
- ✅ 신뢰도별 차등 스코어링
- ✅ 완전 매칭 판정 로직

**개선 가능**:
- ⚠️ 상수값 하드코딩 (`BOLLINGER_BAND_TOLERANCE_RATE = 1.02`)
  - 권장: 환경변수 또는 설정 파일로 이동
- ⚠️ 스코어 가중치가 함수 내부에 분산
  - 권장: 별도 설정 객체로 분리

### 2. `lsAuth.ts` (LS증권 OAuth2 통합)

**강점**:
- ✅ 토큰 캐싱 (Map 구조, 멀티 계정 지원)
- ✅ 만료 60초 전 자동 갱신
- ✅ Fallback URL 처리 (포트 8080/443)
- ✅ 타임아웃 설정 (8초)

**개선 가능**:
- ⚠️ `.env` 파일 직접 파싱 (Node.js 환경에서만 동작)
  - 권장: Nuxt의 `runtimeConfig` 사용
- ⚠️ 토큰 캐시가 메모리 전용 (서버 재시작 시 소실)
  - 권장: Redis 또는 파일 기반 영속 캐시

### 3. `server/api/screener/index.post.ts` (메인 API)

**강점**:
- ✅ 배치 처리 (Rate Limit 준수)
- ✅ Promise.allSettled 사용 (부분 실패 허용)
- ✅ 동적 업종 분류 (Macro 필터링)
- ✅ ETF/ETN 제외 로직

**개선 가능**:
- ⚠️ 배치 크기 `BATCH_SIZE = 1` (너무 작음)
  - 권장: LS증권 API 정책 확인 후 3~5로 증가
- ⚠️ 650ms 고정 딜레이
  - 권장: 동적 Rate Limiter (Bottleneck 라이브러리)
- ⚠️ 오류 처리가 단순 (로깅 부족)
  - 권장: Sentry 또는 Winston 로거 통합

### 4. `useScreenerStore.ts` (Pinia Store)

**강점**:
- ✅ SSOT 패턴 준수 (원천 스토어 참조)
- ✅ Getter를 통한 파생 데이터 자동 계산
- ✅ LocalStorage 캐싱 통합

**개선 가능**:
- ⚠️ `recalculateFromRaw()` 메소드가 너무 큼
  - 권장: ETF 판별 로직을 별도 유틸로 분리
- ⚠️ 보유종목 필터링 로직 중복 (3곳)
  - 권장: Getter 하나로 통합

---

## ⚠️ 발견된 이슈 및 개선 제안

### 🔴 Critical (즉시 수정 필요)

1. **환경변수 노출 위험**
   - **위치**: `server/utils/ls/lsAuth.ts:5-22`
   - **문제**: `.env` 파일을 직접 파싱하여 읽음
   - **위험**: Git에 `.env` 파일이 커밋되면 API 키 유출
   - **해결**:
     ```typescript
     // 변경 전
     export function loadEnv(): Record<string, string> {
       const envPath = path.resolve(process.cwd(), '.env');
       const content = fs.readFileSync(envPath, 'utf-8');
       // ...
     }

     // 변경 후
     export function loadEnv(): Record<string, string> {
       const config = useRuntimeConfig();
       return {
         LS_APP_KEY: config.lsAppKey,
         LS_SECREAT: config.lsSecreat
       };
     }
     ```

2. **타입 불일치**
   - **위치**: `server/api/screener/index.post.ts:166`
   - **문제**: `shortSignalScoreMap`이 `Record<string, number>`인데 `confidence`는 `"높음" | "중간" | "낮음"` 타입
   - **위험**: 런타임 오류 가능성
   - **해결**:
     ```typescript
     const shortSignalScoreMap: Record<"높음" | "중간" | "낮음", number> = {
       "높음": 10,
       "중간": 7,
       "낮음": 5
     };
     ```

### 🟡 High (높은 우선순위)

3. **Rate Limit 최적화**
   - **위치**: `server/api/screener/index.post.ts:74-76`
   - **문제**: `BATCH_SIZE = 1`, `BATCH_DELAY_MS = 650` (너무 느림)
   - **영향**: 50개 종목 조회 시 32.5초 소요
   - **제안**: LS증권 API 정책 확인 후 배치 크기 증가

4. **오류 로깅 부족**
   - **위치**: 모든 API 엔드포인트
   - **문제**: `console.error`만 사용, 중앙 로깅 없음
   - **제안**: Winston 또는 Pino 로거 도입
     ```typescript
     import { createLogger } from '~/server/utils/logger';
     const logger = createLogger('screener-api');
     logger.error('LS API failed', { shcode, error });
     ```

5. **LocalStorage 5일 캐싱 검증 부족**
   - **위치**: `app/stores/useLSStockRawStore.ts`
   - **문제**: `isCacheValid()` 로직이 명시되지 않음
   - **제안**: 명확한 캐시 만료 로직 구현
     ```typescript
     isCacheValid(timestamp: string): boolean {
       const now = new Date();
       const cached = new Date(timestamp);
       const diffDays = (now.getTime() - cached.getTime()) / (1000 * 60 * 60 * 24);
       return diffDays <= 5; // 5일 (주식 거래일 1주일)
     }
     ```

### 🟢 Medium (중간 우선순위)

6. **컴포넌트 크기**
   - **문제**: 일부 컴포넌트가 500줄 이상 (ScreenerView.vue, StockDetailView.vue)
   - **제안**: Composition API의 `<script setup>`을 활용하여 로직 분리

7. **반복 코드**
   - **위치**: 공매도 신호 계산 로직이 2곳에 중복
     - `server/api/screener/index.post.ts:159-162`
     - `app/composables/useQuantIndicatorCalculator.ts:52-58`
   - **제안**: 서버는 원시 데이터만 반환, 클라이언트에서 통합 계산

8. **테스트 코드 부재**
   - **문제**: 단위 테스트, E2E 테스트 없음
   - **제안**: Vitest + Playwright 도입
     ```typescript
     // tests/unit/useQuantIndicatorCalculator.spec.ts
     describe('calculateQuantIndicators', () => {
       it('should return score 100 for fully matched stock', () => {
         const result = calculateQuantIndicators({ /* ... */ });
         expect(result.isFullyMatched).toBe(true);
         expect(result.score).toBe(100);
       });
     });
     ```

### 🔵 Low (낮은 우선순위)

9. **타입 주석 부족**
   - **문제**: 일부 복잡한 함수에 JSDoc이 없음
   - **제안**: 공개 API 함수에 JSDoc 추가

10. **성능 최적화**
    - **제안**: Vue Devtools Profiler로 렌더링 병목 지점 분석
    - **제안**: `computedAsync` 사용하여 무거운 계산 비동기 처리

---

## 📈 성능 및 확장성

### 현재 성능 지표 (추정)

| 항목 | 수치 |
|------|------|
| 초기 로딩 (캐시 히트) | ~500ms |
| 초기 로딩 (캐시 미스) | ~10초 (50개 종목) |
| API 배치 처리 시간 | 650ms × 종목 수 |
| LocalStorage 읽기 | ~10ms |
| Composable 계산 | ~50ms (종목당 1ms) |

### 확장성 고려사항

1. **종목 수 증가**:
   - 현재: 50개 기준 설계
   - 문제: 500개 종목 시 ~5분 소요 (Rate Limit)
   - 해결: 백그라운드 워커 + 청크 단위 업데이트

2. **동시 사용자**:
   - 현재: 단일 사용자 전용 (LocalStorage 기반)
   - 확장: Redis 기반 세션 관리 + JWT 인증

3. **데이터 히스토리**:
   - 현재: 5일 캐싱 후 자동 삭제
   - 확장: PostgreSQL 타임시리즈 DB (TimescaleDB)

---

## 🔐 보안 고려사항

### 1. API 키 관리
- ✅ `.env` 파일 사용 (`.gitignore`에 등록됨)
- ⚠️ 서버 코드에서 직접 파일 읽기 (권장: Nuxt runtimeConfig)

### 2. CORS 정책
- ✅ LS증권 API는 서버 사이드에서 호출 (키 노출 방지)
- ✅ Nuxt API Routes는 동일 출처 정책

### 3. SQL 인젝션
- ✅ Drizzle ORM 사용 (Prepared Statements 자동 적용)

### 4. XSS 방지
- ✅ Vue의 템플릿 자동 이스케이프
- ⚠️ TipTap 에디터 사용 시 HTML sanitization 필요

---

## 📚 문서화 상태

### 현재 문서
1. ✅ **CLAUDE.md**: 프로젝트 규칙 및 가이드라인
2. ✅ **Skills/*.md**: AI 에이전트 스킬 명세
3. ❌ **README.md**: 없음 (작성 필요)
4. ❌ **API 문서**: 없음 (Swagger/OpenAPI 권장)
5. ❌ **아키텍처 다이어그램**: 없음 (이 보고서가 대체)

### 권장 추가 문서
- **README.md**: 프로젝트 소개, 설치 방법, 실행 방법
- **CONTRIBUTING.md**: 개발 가이드, 커밋 컨벤션
- **API.md**: 서버 API 엔드포인트 명세
- **DEPLOYMENT.md**: 배포 가이드

---

## 🎓 학습 자료

### 핵심 기술 이해를 위한 추천 자료

1. **Nuxt 4**: https://nuxt.com/docs
2. **Pinia**: https://pinia.vuejs.org/
3. **Drizzle ORM**: https://orm.drizzle.team/
4. **LS증권 Open API**: https://openapi.ls-sec.co.kr/
5. **기술적 분석 지표**: 
   - 볼린저 밴드: https://www.investopedia.com/terms/b/bollingerbands.asp
   - MACD: https://www.investopedia.com/terms/m/macd.asp
   - RSI: https://www.investopedia.com/terms/r/rsi.asp

---

## 🚀 다음 단계 제안

### Phase 1: 안정화 (1-2주)
1. ✅ Critical 이슈 수정 (환경변수, 타입 불일치)
2. ✅ 오류 로깅 시스템 도입
3. ✅ 단위 테스트 작성 (핵심 Composable)

### Phase 2: 최적화 (2-3주)
4. ✅ Rate Limit 최적화
5. ✅ 컴포넌트 리팩토링 (크기 축소)
6. ✅ 성능 프로파일링 및 병목 제거

### Phase 3: 기능 확장 (4주+)
7. ✅ 백테스팅 시스템 (과거 데이터 기반 전략 검증)
8. ✅ 알림 시스템 (매수/매도 시그널 푸시 알림)
9. ✅ 모바일 앱 (React Native 또는 Capacitor)

---

## 📊 종합 평가

### 강점 (Strengths)
1. ✅ **명확한 아키텍처**: SSOT 패턴, 중앙집중식 타입 관리
2. ✅ **무하드코딩 원칙**: 모든 데이터는 LS증권 API에서 동적 수신
3. ✅ **타입 안전성**: TypeScript 전역 적용, 엄격한 타입 체크
4. ✅ **비즈니스 로직 분리**: Composable을 통한 재사용 가능한 계산 로직
5. ✅ **캐싱 전략**: LocalStorage 5일 캐싱으로 API 호출 최소화

### 약점 (Weaknesses)
1. ⚠️ **Rate Limit 최적화 부족**: 배치 크기 1, 고정 딜레이
2. ⚠️ **테스트 코드 부재**: 단위/통합/E2E 테스트 없음
3. ⚠️ **오류 처리 단순**: 중앙 로깅 시스템 없음
4. ⚠️ **문서화 부족**: README, API 문서 없음
5. ⚠️ **확장성 제한**: 단일 사용자, 제한된 종목 수

### 기회 (Opportunities)
1. 🚀 **백테스팅 시스템**: 과거 데이터로 전략 검증
2. 🚀 **AI 고도화**: Claude API로 맞춤형 투자 조언
3. 🚀 **소셜 기능**: 커뮤니티 전략 공유
4. 🚀 **모바일 앱**: 실시간 알림 및 모바일 UI
5. 🚀 **프리미엄 기능**: 고급 지표, 알림 시스템

### 위협 (Threats)
1. ⚠️ **LS증권 API 정책 변경**: Rate Limit, 인증 방식 변경
2. ⚠️ **법적 리스크**: 투자 조언 관련 금융규제
3. ⚠️ **데이터 정확성**: API 오류 시 잘못된 투자 판단
4. ⚠️ **보안 취약점**: API 키 노출, XSS 공격

---

## 📞 연락처 및 리소스

- **LS증권 API 지원**: https://openapi.ls-sec.co.kr/
- **Nuxt 공식 문서**: https://nuxt.com/
- **프로젝트 이슈 트래커**: (GitHub Issues 활용 권장)

---

**분석 완료일**: 2026-08-16  
**분석자**: Claude (Opus 5)  
**보고서 버전**: 1.0
