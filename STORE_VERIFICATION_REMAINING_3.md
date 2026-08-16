# 나머지 3개 Store 검증 보고서

## 📊 종합 평가

| Store | 점수 | 평가 |
|-------|------|------|
| useScreenerStore.ts | 85/100 | ✅ 양호 |
| useStockDetailStore.ts | 90/100 | ✅ 우수 |
| useWatchlistStore.ts | 83/100 | ✅ 양호 |

---

# 1️⃣ useScreenerStore.ts

## 📊 **종합 평가: 85/100점 (양호)**

### ✅ **강점**

#### 1. **SSOT 패턴 준수**
```typescript
// useScreenerStore.ts:20-40
getters: {
  lastUpdated: () => {
    const rawStore = useLSStockRawStore(); // ✅ 원천 스토어 참조
    return rawStore.lastUpdated || '';
  },
  marketBasis: () => {
    const rawStore = useLSStockRawStore();
    return rawStore.marketBasis;
  },
  topSectors: () => {
    const rawStore = useLSStockRawStore();
    return rawStore.topSectors;
  }
}
```
- ✅ 데이터 중복 없음
- ✅ 단일 진실 출처 원칙 준수

#### 2. **재계산 로직 분리**
```typescript
// useScreenerStore.ts:123-170
recalculateFromRaw() {
  const rawStore = useLSStockRawStore();
  
  // 원천 데이터를 Composable(calculateQuantIndicators)로 8대 지표 계산
  const calculatedItems = rawStore.rawStockList.map(item => {
    const quantResult = calculateQuantIndicators({ /* ... */ });
    return {
      ...item,
      shortSellingStatus: isEtf ? 'ETF/ETN (공매도 t1927 제외 종목)' : quantResult.shortSignal.label,
      score: quantResult.score,
      isFullyMatched: quantResult.isFullyMatched
    };
  });

  this.newData = calculatedItems;
}
```
- ✅ 순수 함수 사용 (부작용 없음)
- ✅ Composable 재사용

#### 3. **파생 데이터 자동 계산**
```typescript
// useScreenerStore.ts:46-80
getters: {
  has85PlusMatched: (state) => {
    const portfolioStore = usePortfolioStore();
    const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode)); // ✅ Set 사용
    return state.newData.some(item => 
      !item.isHolding && 
      item.type !== 'holding' && 
      !holdingShcodes.has(item.shcode) && // ✅ O(1) 조회
      item.isFullyMatched
    );
  },
  matchedCount: (state) => { /* 동일 패턴 */ },
  topBuyRecommendations: (state) => {
    const portfolioStore = usePortfolioStore();
    const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode));
    
    const watchlistOnly = state.newData.filter(item => 
      !item.isHolding && item.type !== 'holding' && !holdingShcodes.has(item.shcode)
    );

    return [...watchlistOnly].sort((a, b) => b.score - a.score).slice(0, 3); // ✅ Top 3
  }
}
```
- ✅ Set 사용으로 성능 최적화
- ✅ 명확한 필터링 로직

### ⚠️ **문제점**

#### 1. **중복된 Set 생성 (성능 이슈)**
```typescript
// useScreenerStore.ts:49, 55, 62
// 3개 Getter에서 동일한 Set을 각각 생성
const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode));
```

**권장 개선**:
```typescript
getters: {
  holdingShcodesSet: (state) => {
    const portfolioStore = usePortfolioStore();
    return new Set(portfolioStore.holdings.map(h => h.shcode)); // ✅ 1회 생성
  },
  has85PlusMatched: (state) => {
    return state.newData.some(item => 
      !item.isHolding && 
      item.type !== 'holding' && 
      !this.holdingShcodesSet.has(item.shcode) && // ✅ 재사용
      item.isFullyMatched
    );
  }
}
```

#### 2. **ETF 판별 로직 중복**
```typescript
// useScreenerStore.ts:134
const etfKeywords = ['KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'];
```
- ⚠️ useWatchlistStore.ts에도 동일한 로직 존재
- 권장: 공통 유틸 함수로 추출

### 📊 **평가 상세**

| 항목 | 점수 | 평가 |
|------|------|------|
| SSOT 패턴 | 95/100 | ✅ 완벽 |
| Getters 성능 | 80/100 | ⚠️ Set 중복 생성 |
| 재계산 로직 | 90/100 | ✅ 우수 |
| 오류 처리 | 85/100 | ✅ 양호 |
| 코드 중복 | 80/100 | ⚠️ ETF 로직 중복 |

---

# 2️⃣ useStockDetailStore.ts

## 📊 **종합 평가: 90/100점 (우수)**

### ✅ **강점**

#### 1. **효율적인 캐싱 전략**
```typescript
// useStockDetailStore.ts:18
state: () => ({
  stockCache: {} as Record<string, StockDetailStateItem>, // ✅ 종목별 개별 캐싱
})
```
- ✅ 종목별 독립적 캐싱 (개별 만료 가능)
- ✅ 5일 보존 정책

#### 2. **캐시 유효성 검증**
```typescript
// useStockDetailStore.ts:89-100
getStockCache(shcode: string): StockDetailStateItem | null {
  const cleanCode = String(shcode).trim().replace(/^A/i, '');
  const item = this.stockCache[cleanCode];
  if (!item) return null;

  // ✅ 만료 시 자동 제거
  if (item.cachedTimestamp && Date.now() - item.cachedTimestamp > EXPIRATION_MS) {
    delete this.stockCache[cleanCode];
    this.saveToStorage();
    return null;
  }
  return item;
}
```
- ✅ Lazy 만료 처리
- ✅ 자동 정리

#### 3. **낙관적 업데이트 + 영구 저장**
```typescript
// useStockDetailStore.ts:114-143
async fetchAndCacheStock(shcode: string, forceRefresh = false): Promise<StockDetailStateItem | null> {
  const cleanCode = String(shcode).trim().replace(/^A/i, '');
  
  // ✅ 1. 캐시 히트 시 즉시 반환 (0ms)
  if (!forceRefresh) {
    const cached = this.getStockCache(cleanCode);
    if (cached) return cached;
  }

  this.isFetching = true;

  try {
    // ✅ 2. API 호출
    const res = await $fetch<{ success: boolean; data: any }>(`/api/stock/${cleanCode}`);
    if (res && res.success && res.data) {
      const calculatedData = calculateQuantIndicators(res.data);
      // ✅ 3. 캐시 업데이트
      this.updateStockCache(cleanCode, calculatedData);
      return calculatedData;
    }
  } catch (err: any) {
    console.error('Fetch and cache stock error:', err);
    this.errorMessage = err.statusMessage || err.message || 'LS증권 API 수집 실패';
  } finally {
    this.isFetching = false;
  }
  
  // ✅ 4. 실패 시에도 기존 캐시 반환
  return this.getStockCache(cleanCode);
}
```
- ✅ 캐시 우선 전략
- ✅ 실패 시 Fallback

#### 4. **AI 보고서 저장**
```typescript
// useStockDetailStore.ts:146-156
saveAiReport(shcode: string, reportText: string) {
  const cleanCode = String(shcode).trim().replace(/^A/i, '');
  const existing = this.stockCache[cleanCode] || { 
    shcode: cleanCode, 
    name: cleanCode, 
    industry: '기타', 
    closePrice: 0, 
    isHolding: false, 
    score: 0, 
    isFullyMatched: false, 
    conditions: {} 
  };
  this.stockCache[cleanCode] = {
    ...existing,
    generatedReport: reportText,
    generatedReportAt: new Date().toLocaleString('ko-KR'),
    cachedTimestamp: Date.now()
  };
  this.saveToStorage();
}
```
- ✅ 기존 데이터 유지
- ✅ AI 보고서 영구 저장

### ⚠️ **문제점**

#### 1. **initFromStorage 복잡도**
```typescript
// useStockDetailStore.ts:25-75
initFromStorage() {
  // ... 59줄의 복잡한 로직
  Object.keys(parsed).forEach((key) => {
    const item = parsed[key];
    if (item && item.cachedTimestamp && now - item.cachedTimestamp > EXPIRATION_MS) {
      delete parsed[key]; // ✅ 개별 만료 처리
      hasExpired = true;
    }
  });
}
```
- ⚠️ 너무 긴 함수 (59줄)
- 권장: 헬퍼 함수 분리

#### 2. **saveAiReport의 기본값**
```typescript
// useStockDetailStore.ts:148
const existing = this.stockCache[cleanCode] || { 
  shcode: cleanCode, 
  name: cleanCode, // ⚠️ name이 종목코드
  industry: '기타', 
  closePrice: 0, 
  /* ... */
};
```
- ⚠️ 종목 정보 없이 AI 보고서만 저장 시 부정확한 기본값
- 권장: 종목 정보 먼저 로드 후 AI 보고서 저장

### 📊 **평가 상세**

| 항목 | 점수 | 평가 |
|------|------|------|
| 캐싱 전략 | 95/100 | ✅ 우수 |
| 캐시 유효성 검증 | 95/100 | ✅ 우수 |
| API 호출 최적화 | 90/100 | ✅ 우수 |
| 오류 처리 | 90/100 | ✅ 우수 |
| 코드 복잡도 | 80/100 | ⚠️ initFromStorage 긴 함수 |

---

# 3️⃣ useWatchlistStore.ts

## 📊 **종합 평가: 83/100점 (양호)**

### ✅ **강점**

#### 1. **WatchItem 타입 정의**
```typescript
// useWatchlistStore.ts:5-22
export interface WatchItem {
  shcode: string;
  name: string;
  industry: string;
  type?: 'holding' | 'watchlist';
  quantity?: number;
  avgPrice?: number;
  currentPrice: number;
  psy?: number | null;
  volumeRatio?: number | null;
  shortSellingStatus?: string;
  score?: number;
  targetPrice?: number;
  stopLossPrice?: number;
  trailingRate?: number;
  updatedAt: string;
  cachedTimestamp?: number;
}
```
- ✅ 명확한 타입 정의
- ✅ 선택적 필드 구분

#### 2. **초기화 플래그**
```typescript
// useWatchlistStore.ts:40
state: () => ({
  items: [] as WatchItem[],
  isLoading: false,
  errorMessage: null as string | null,
  isInitialized: false // ✅ 중복 초기화 방지
})

// useWatchlistStore.ts:100-111
async loadInitial(forceRefresh = false) {
  if (!this.isInitialized) {
    this.initFromStorage();
    this.isInitialized = true; // ✅ 플래그 설정
  }

  if (!forceRefresh && this.items.length > 0) {
    return;
  }

  await this.refresh();
}
```
- ✅ 중복 초기화 방지
- ✅ 명확한 생명주기

#### 3. **실시간 업데이트**
```typescript
// useWatchlistStore.ts:113-180
async refresh() {
  this.isLoading = true;
  try {
    const rawStore = useLSStockRawStore();
    await rawStore.fetchRawStockData(true); // ✅ 강제 새로고침

    rawStore.rawStockList.forEach(sc => {
      const quantResult = calculateQuantIndicators({ /* ... */ });
      
      const idx = this.items.findIndex(it => it.shcode === sc.shcode);
      if (idx !== -1) {
        // ✅ 기존 항목 업데이트
        const it = this.items[idx]!;
        it.currentPrice = sc.closePrice || it.currentPrice;
        it.psy = sc.psy ?? it.psy;
        it.score = quantResult.score;
        // ...
      } else {
        // ✅ 신규 항목 추가
        this.items.push({ /* ... */ });
      }
    });
    
    this.saveToStorage();
  } finally {
    this.isLoading = false;
  }
}
```
- ✅ 기존 데이터 보존 (Fallback)
- ✅ 실시간 지표 반영

### ⚠️ **문제점**

#### 1. **O(n²) 성능 이슈**
```typescript
// useWatchlistStore.ts:149
rawStore.rawStockList.forEach(sc => {
  const idx = this.items.findIndex(it => it.shcode === sc.shcode); // ⚠️ O(n)
});
```
- ⚠️ rawStockList 100개 × items 50개 = 5,000번 순회

**권장 개선**:
```typescript
async refresh() {
  const rawStore = useLSStockRawStore();
  await rawStore.fetchRawStockData(true);

  // ✅ Map으로 변환 (O(n))
  const itemsMap = new Map(this.items.map(it => [it.shcode, it]));

  rawStore.rawStockList.forEach(sc => {
    const quantResult = calculateQuantIndicators({ /* ... */ });
    
    const existing = itemsMap.get(sc.shcode); // ✅ O(1)
    if (existing) {
      existing.currentPrice = sc.closePrice || existing.currentPrice;
      existing.score = quantResult.score;
      // ...
    } else {
      this.items.push({ /* ... */ });
    }
  });
  
  this.saveToStorage();
}
```

#### 2. **ETF 판별 로직 중복**
```typescript
// useWatchlistStore.ts:121
const etfKeywords = ['KODEX', 'TIGER', /* ... */];
```
- ⚠️ useScreenerStore.ts와 동일 (중복)
- 권장: 공통 유틸로 추출

#### 3. **삭제 기능 없음**
```typescript
// useWatchlistStore.ts
// ⚠️ items에서 종목 제거 기능 없음
```
- ⚠️ 사용자가 관심종목을 제거할 방법 없음
- 권장: `removeItem(shcode: string)` 추가

### 📊 **평가 상세**

| 항목 | 점수 | 평가 |
|------|------|------|
| 타입 정의 | 95/100 | ✅ 우수 |
| 초기화 로직 | 90/100 | ✅ 우수 |
| 실시간 업데이트 | 85/100 | ✅ 양호 |
| 성능 | 70/100 | ⚠️ O(n²) 이슈 |
| 기능 완성도 | 75/100 | ⚠️ 삭제 기능 없음 |

---

# 📊 **전체 Store 비교**

| Store | 점수 | 주요 강점 | 주요 약점 |
|-------|------|-----------|-----------|
| useLSStockRawStore | 88/100 | SSOT, 캐싱 | 롤백 로직 부재 |
| usePortfolioStore | 82/100 | 재무 계산 정확 | O(n²) 성능 |
| **useStockDetailStore** | **90/100** | **캐싱 전략 우수** | initFromStorage 복잡 |
| useScreenerStore | 85/100 | SSOT 패턴 | Set 중복 생성 |
| useWatchlistStore | 83/100 | 초기화 플래그 | O(n²) 성능 |

---

# 🔧 **통합 개선 권장사항**

## 🔴 **Priority 1 (Critical)**

### 1. **공통 ETF 판별 유틸 생성**
```typescript
// utils/stockUtils.ts
const ETF_KEYWORDS = [
  'KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 
  'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 
  'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'
];

export function isEtfOrEtn(name: string, industry?: string): boolean {
  if (industry && (industry.includes('ETF') || industry.includes('ETN'))) {
    return true;
  }
  return ETF_KEYWORDS.some(keyword => name.includes(keyword));
}
```

### 2. **useWatchlistStore 성능 최적화**
```typescript
// O(n²) → O(n)으로 개선
async refresh() {
  const rawStore = useLSStockRawStore();
  await rawStore.fetchRawStockData(true);

  const itemsMap = new Map(this.items.map(it => [it.shcode, it]));

  rawStore.rawStockList.forEach(sc => {
    const existing = itemsMap.get(sc.shcode);
    // ...
  });
}
```

## 🟡 **Priority 2 (High)**

### 3. **useScreenerStore Set 재사용**
```typescript
getters: {
  holdingShcodesSet: (state) => {
    const portfolioStore = usePortfolioStore();
    return new Set(portfolioStore.holdings.map(h => h.shcode));
  },
  has85PlusMatched: (state) => {
    return state.newData.some(item => 
      !this.holdingShcodesSet.has(item.shcode) && item.isFullyMatched
    );
  }
}
```

### 4. **useWatchlistStore 삭제 기능 추가**
```typescript
actions: {
  async removeItem(shcode: string) {
    const cleanCode = shcode.trim().replace(/^A/i, '');
    this.items = this.items.filter(it => it.shcode !== cleanCode);
    this.saveToStorage();
    
    // 서버 동기화
    try {
      await $fetch(`/api/watchlist/${cleanCode}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Remove watchlist item error:', err);
    }
  }
}
```

## 🟢 **Priority 3 (Medium)**

### 5. **useStockDetailStore initFromStorage 리팩토링**
```typescript
// 헬퍼 함수 분리
function cleanExpiredCache(cache: Record<string, any>, now: number): boolean {
  let hasExpired = false;
  Object.keys(cache).forEach((key) => {
    const item = cache[key];
    if (item?.cachedTimestamp && now - item.cachedTimestamp > EXPIRATION_MS) {
      delete cache[key];
      hasExpired = true;
    }
  });
  return hasExpired;
}

initFromStorage() {
  // ...
  const hasExpired = cleanExpiredCache(parsed, now);
  // ...
}
```

---

# 🎯 **최종 종합 평가**

## ✅ **전체 Store 시스템: 86/100점 (양호~우수)**

### 강점
- ✅ SSOT 패턴 일관성 유지
- ✅ 5일 캐싱 전략 일관적 적용
- ✅ Composable 재사용으로 로직 중복 최소화
- ✅ 오류 처리 완비

### 개선 필요
- ⚠️ O(n²) 성능 이슈 (usePortfolioStore, useWatchlistStore)
- ⚠️ ETF 판별 로직 중복 (useScreenerStore, useWatchlistStore)
- ⚠️ 롤백 로직 부재 (useLSStockRawStore)

### 권장 조치
1. **공통 유틸 함수 생성** (ETF 판별, getLivePrice 등)
2. **Map 사용으로 성능 최적화** (모든 find/findIndex → Map.get)
3. **롤백 로직 추가** (서버 실패 시 클라이언트 원복)

**전체 개선 후 예상 점수: 93~95/100점** 🚀
