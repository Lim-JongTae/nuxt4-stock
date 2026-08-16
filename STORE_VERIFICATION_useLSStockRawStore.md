# useLSStockRawStore.ts 검증 보고서

## 📊 종합 평가: 88/100점 (우수)

---

## 1️⃣ **아키텍처 분석**

### 📌 **SSOT (Single Source of Truth) 패턴 구현**

```typescript
// useLSStockRawStore.ts:22-33
export const useLSStockRawStore = defineStore('lsStockRaw', {
  state: () => ({
    rawStockList: [] as StockItem[],           // ✅ 중앙 원천 데이터
    marketBasis: null as MarketBasisInfo | null,
    topSectors: [] as TopSectorInfo[],
    bottomSectors: [] as TopSectorInfo[],
    lastUpdated: '',
    cachedTimestamp: 0,
    sourceProvider: 'LS증권 Open API',
    isLoading: false,
    errorMessage: null as string | null
  })
});
```

**역할**:
- ✅ 모든 LS증권 API 데이터의 중앙 저장소
- ✅ 다른 스토어들이 이 스토어를 참조 (의존성 명확)
- ✅ LocalStorage 5일 캐싱 전략

---

## 2️⃣ **캐싱 전략 검증**

### ✅ **5일 보존 정책**

```typescript
// useLSStockRawStore.ts:10
const EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 432,000,000ms = 5일
```

**검증**:
- ✅ 5일 = 주식 거래일 1주일 (정확)
- ✅ 밀리초 단위 계산 정확

### ✅ **캐시 키 생성**

```typescript
// useLSStockRawStore.ts:12-18
function getTodayRawKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${RAW_CACHE_PREFIX}${year}-${month}-${day}`;
}
```

**예시**:
- `nuxt_ls_raw_data_2026-08-16`
- ✅ 날짜별로 고유한 키 생성
- ✅ padStart로 2자리 보장

### ✅ **초기화 및 만료 처리**

```typescript
// useLSStockRawStore.ts:76-131
initFromStorage() {
  // 1. localStorage에서 모든 캐시 키 수집
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(RAW_CACHE_PREFIX)) {
      keys.push(k);
    }
  }

  // 2. 만료된 캐시 제거
  const now = Date.now();
  for (const key of keys) {
    const val = localStorage.getItem(key);
    if (val) {
      const parsed = JSON.parse(val);
      if (parsed.cachedTimestamp && (now - parsed.cachedTimestamp > EXPIRATION_MS)) {
        localStorage.removeItem(key); // ✅ 5일 이상 경과 시 자동 삭제
      }
    }
  }

  // 3. 오늘 키 우선, 없으면 가장 최근 키 사용
  const todayKey = getTodayRawKey();
  const targetKey = localStorage.getItem(todayKey) ? todayKey : (validKeys.sort().pop() || todayKey);
}
```

**검증 결과**:
- ✅ 만료 로직 정확
- ✅ 오래된 캐시 자동 정리
- ✅ 오늘 데이터 우선 로드

---

## 3️⃣ **Getters 검증**

### ✅ **파생 데이터 자동 계산**

```typescript
// useLSStockRawStore.ts:35-73
getters: {
  // 1. 데이터 존재 여부
  hasRawData: (state) => state.rawStockList.length > 0, // ✅

  // 2. Map 변환 (O(1) 조회)
  rawStockMap: (state) => {
    const map = new Map<string, StockItem>();
    state.rawStockList.forEach(item => map.set(item.shcode, item));
    return map;
  }, // ✅

  // 3. 필터링
  holdingsList: (state) => state.rawStockList.filter(item => item.isHolding), // ✅
  watchlistList: (state) => state.rawStockList.filter(item => !item.isHolding), // ✅

  // 4. 재무 계산
  totalPurchaseAmount: (state) => { /* ... */ }, // ✅
  totalValuationAmount: (state) => { /* ... */ }, // ✅
  totalEvaluationProfit: (state) => { /* ... */ }, // ✅
  totalReturnRate: (state) => { /* ... */ }      // ✅
}
```

### 📊 **재무 계산 정확성 검증**

#### ✅ **총 매수금액 (totalPurchaseAmount)**
```typescript
// useLSStockRawStore.ts:44-48
totalPurchaseAmount: (state) => {
  return state.rawStockList
    .filter(item => item.isHolding)
    .reduce((sum, item) => sum + (
      (item.holdingAvgPrice || item.avgPrice || 0) * 
      (item.holdingQuantity || item.quantity || 0)
    ), 0);
}
```

**검증**:
- ✅ 보유종목만 필터링
- ✅ `평균단가 × 수량` 정확
- ✅ Fallback 체인 (holdingAvgPrice → avgPrice → 0)

**예시 계산**:
```
삼성전자: 70,000원 × 10주 = 700,000원
SK하이닉스: 120,000원 × 5주 = 600,000원
총 매수금액 = 1,300,000원 ✅
```

#### ✅ **총 평가금액 (totalValuationAmount)**
```typescript
// useLSStockRawStore.ts:49-53
totalValuationAmount: (state) => {
  return state.rawStockList
    .filter(item => item.isHolding)
    .reduce((sum, item) => sum + (
      (item.closePrice || item.holdingAvgPrice || item.avgPrice || 0) * 
      (item.holdingQuantity || item.quantity || 0)
    ), 0);
}
```

**검증**:
- ✅ 현재가(closePrice) 우선 사용
- ✅ 현재가 없으면 평균단가 사용 (안전 장치)
- ✅ `현재가 × 수량` 정확

**예시 계산**:
```
삼성전자: 75,000원 × 10주 = 750,000원
SK하이닉스: 125,000원 × 5주 = 625,000원
총 평가금액 = 1,375,000원 ✅
```

#### ✅ **총 평가손익 (totalEvaluationProfit)**
```typescript
// useLSStockRawStore.ts:54-62
totalEvaluationProfit: (state) => {
  const purchase = /* 매수금액 계산 */;
  const val = /* 평가금액 계산 */;
  return val - purchase;
}
```

**검증**:
- ✅ 평가금액 - 매수금액 = 손익
- ⚠️ 중복 계산 (totalPurchaseAmount와 동일 로직 반복)

**예시 계산**:
```
평가금액: 1,375,000원
매수금액: 1,300,000원
평가손익: +75,000원 ✅
```

#### ✅ **총 수익률 (totalReturnRate)**
```typescript
// useLSStockRawStore.ts:63-72
totalReturnRate: (state) => {
  const purchase = /* 매수금액 */;
  if (purchase === 0) return 0; // ✅ 0 나눗셈 방지
  const val = /* 평가금액 */;
  return Math.round(((val - purchase) / purchase) * 10000) / 100; // ✅ 소수점 2자리
}
```

**검증**:
- ✅ (평가금액 - 매수금액) / 매수금액 × 100
- ✅ 0 나눗셈 방지
- ✅ 소수점 2자리 반올림

**예시 계산**:
```
평가손익: 75,000원
매수금액: 1,300,000원
수익률 = (75,000 / 1,300,000) × 100 = 5.77% ✅
```

---

## 4️⃣ **Actions 검증**

### ✅ **fetchRawStockData - 데이터 수집**

```typescript
// useLSStockRawStore.ts:152-202
async fetchRawStockData(forceRefresh = false) {
  this.initFromStorage(); // ✅ 1. 캐시 로드

  // ✅ 2. 캐시 히트 시 즉시 반환 (0ms)
  if (!forceRefresh && this.rawStockList && this.rawStockList.length > 0) {
    return;
  }

  // ✅ 3. 중복 요청 방지 (In-Flight Request)
  if (inFlightFetchPromise) {
    return inFlightFetchPromise;
  }

  this.isLoading = true;
  this.errorMessage = null;

  inFlightFetchPromise = (async () => {
    try {
      // ✅ 4. API 호출
      const response = await $fetch<ScreenerApiResponse>('/api/screener', { method: 'POST' });

      if (response && response.success) {
        // ✅ 5. 상태 업데이트
        if (response.newData && response.newData.length > 0) {
          this.rawStockList = response.newData;
        }
        // ... 시장 데이터 업데이트

        // ✅ 6. LocalStorage 저장
        this.saveToStorage();
      }
    } catch (err: any) {
      this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 수집 중 오류가 발생했습니다.';
    } finally {
      this.isLoading = false;
      inFlightFetchPromise = null; // ✅ 7. In-Flight 플래그 해제
    }
  })();

  return inFlightFetchPromise;
}
```

**검증 결과**:
- ✅ 캐시 우선 전략 (0ms 로딩)
- ✅ 중복 요청 방지 (In-Flight Request Pattern)
- ✅ 오류 처리 완비
- ✅ finally 블록으로 상태 정리

### ✅ **addStock - 종목 추가**

```typescript
// useLSStockRawStore.ts:204-243
async addStock(stockForm) {
  const cleanCode = stockForm.shcode.trim().replace(/^A/i, ''); // ✅ 1. 종목코드 정제

  // ✅ 2. 낙관적 업데이트 (Optimistic Update)
  const existingIdx = this.rawStockList.findIndex(s => s.shcode === cleanCode);
  const newItem: StockItem = { /* ... */ };

  if (existingIdx !== -1) {
    this.rawStockList[existingIdx] = { ...this.rawStockList[existingIdx], ...newItem };
  } else {
    this.rawStockList.push(newItem);
  }

  this.saveToStorage(); // ✅ 3. LocalStorage 즉시 저장

  // ✅ 4. 서버 동기화
  try {
    await $fetch('/api/stocks', { method: 'POST', body: stockForm });
  } catch (err: any) {
    console.error('Store addStock DB sync error:', err);
    throw err; // ✅ 5. 오류 전파
  }
}
```

**검증 결과**:
- ✅ 낙관적 업데이트 (UI 즉시 반영)
- ✅ 종목코드 정제 (A 접두사 제거)
- ✅ 중복 검사 (기존 종목 업데이트)
- ✅ 서버 동기화
- ⚠️ 롤백 로직 없음 (서버 실패 시 클라이언트 상태가 불일치)

### ✅ **updateStock - 종목 수정**

```typescript
// useLSStockRawStore.ts:245-275
async updateStock(shcode, stockForm) {
  const cleanCode = shcode.trim().replace(/^A/i, '');

  // ✅ 1. Pinia Store 즉시 수정
  const idx = this.rawStockList.findIndex(s => s.shcode === cleanCode);
  if (idx !== -1) {
    const item = this.rawStockList[idx]!;
    item.name = stockForm.name.trim();
    // ... 기타 필드 업데이트
  }

  this.saveToStorage();

  // ✅ 2. 서버 동기화
  try {
    await $fetch(`/api/stocks/${cleanCode}`, { method: 'PUT', body: stockForm });
  } catch (err: any) {
    throw err;
  }
}
```

**검증 결과**:
- ✅ 낙관적 업데이트
- ✅ 서버 동기화
- ⚠️ 롤백 로직 없음

### ✅ **deleteStock - 종목 삭제**

```typescript
// useLSStockRawStore.ts:277-293
async deleteStock(shcode) {
  const cleanCode = shcode.trim().replace(/^A/i, '');

  // ✅ 1. Pinia Store 즉시 제거
  this.rawStockList = this.rawStockList.filter(s => s.shcode !== cleanCode);
  this.saveToStorage();

  // ✅ 2. 서버 동기화
  try {
    await $fetch(`/api/stocks/${cleanCode}`, { method: 'DELETE' });
  } catch (err: any) {
    throw err;
  }
}
```

**검증 결과**:
- ✅ 낙관적 업데이트
- ✅ filter로 안전하게 제거
- ✅ 서버 동기화
- ⚠️ 롤백 로직 없음

---

## 5️⃣ **발견된 이슈**

### 🔴 **Critical - 롤백 로직 부재**

```typescript
// 현재 구현
async addStock(stockForm) {
  // 1. 클라이언트 상태 변경
  this.rawStockList.push(newItem);
  this.saveToStorage();

  // 2. 서버 동기화
  await $fetch('/api/stocks', { method: 'POST', body: stockForm }); // ⚠️ 실패 시?
}
```

**문제**:
- 서버 요청 실패 시 클라이언트 상태만 변경됨
- 새로고침 후 데이터 불일치 발생

**권장 개선**:
```typescript
async addStock(stockForm) {
  const cleanCode = stockForm.shcode.trim().replace(/^A/i, '');
  const newItem: StockItem = { /* ... */ };

  // 1. 낙관적 업데이트
  const existingIdx = this.rawStockList.findIndex(s => s.shcode === cleanCode);
  const backup = existingIdx !== -1 ? { ...this.rawStockList[existingIdx] } : null;

  if (existingIdx !== -1) {
    this.rawStockList[existingIdx] = { ...this.rawStockList[existingIdx], ...newItem };
  } else {
    this.rawStockList.push(newItem);
  }

  this.saveToStorage();

  // 2. 서버 동기화
  try {
    await $fetch('/api/stocks', { method: 'POST', body: stockForm });
  } catch (err: any) {
    // ✅ 3. 롤백
    if (backup) {
      this.rawStockList[existingIdx!] = backup;
    } else {
      this.rawStockList = this.rawStockList.filter(s => s.shcode !== cleanCode);
    }
    this.saveToStorage();
    throw err;
  }
}
```

### 🟡 **High - Getter 중복 계산**

```typescript
// useLSStockRawStore.ts:54-72
totalEvaluationProfit: (state) => {
  const purchase = state.rawStockList
    .filter(item => item.isHolding)
    .reduce((sum, item) => sum + ((item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
  const val = state.rawStockList
    .filter(item => item.isHolding)
    .reduce((sum, item) => sum + ((item.closePrice || item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
  return val - purchase;
},
totalReturnRate: (state) => {
  const purchase = state.rawStockList /* 동일한 계산 반복 */;
  const val = state.rawStockList /* 동일한 계산 반복 */;
  return Math.round(((val - purchase) / purchase) * 10000) / 100;
}
```

**문제**:
- 동일한 계산을 3번 반복 (totalPurchaseAmount, totalValuationAmount, totalEvaluationProfit, totalReturnRate)
- 성능 저하 (종목 수 × 4번 순회)

**권장 개선**:
```typescript
totalEvaluationProfit: (state) => {
  return this.totalValuationAmount - this.totalPurchaseAmount; // ✅ Getter 재사용
},
totalReturnRate: (state) => {
  const purchase = this.totalPurchaseAmount; // ✅ Getter 재사용
  if (purchase === 0) return 0;
  return Math.round((this.totalEvaluationProfit / purchase) * 10000) / 100;
}
```

### 🟡 **High - LocalStorage 용량 제한 없음**

```typescript
// useLSStockRawStore.ts:133-150
saveToStorage() {
  try {
    localStorage.setItem(todayKey, JSON.stringify({
      rawStockList: this.rawStockList, // ⚠️ 크기 제한 없음
      // ...
    }));
  } catch (e) {
    console.error('Failed to save raw stock cache to storage:', e);
  }
}
```

**문제**:
- LocalStorage는 보통 5~10MB 제한
- 종목이 많으면 QuotaExceededError 발생 가능

**권장 개선**:
```typescript
saveToStorage() {
  try {
    const data = JSON.stringify({
      rawStockList: this.rawStockList,
      // ...
    });

    // ✅ 크기 체크 (5MB = 5,000,000 bytes)
    if (data.length > 5_000_000) {
      console.warn('Cache size exceeds 5MB, skipping save');
      return;
    }

    localStorage.setItem(todayKey, data);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'QuotaExceededError') {
      // ✅ 용량 초과 시 가장 오래된 캐시 삭제
      this.clearOldestCache();
      this.saveToStorage(); // 재시도
    } else {
      console.error('Failed to save raw stock cache to storage:', e);
    }
  }
}
```

### 🟢 **Medium - 레거시 캐시 키 정리**

```typescript
// useLSStockRawStore.ts:82
if (k && (k.startsWith(RAW_CACHE_PREFIX) 
       || k.startsWith('nuxt_updown_screener_') 
       || k.startsWith('nuxt4_stock_screener_cache'))) {
```

**문제**:
- 레거시 키 이름이 하드코딩됨
- 유지보수성 저하

**권장 개선**:
```typescript
const LEGACY_CACHE_PREFIXES = [
  'nuxt_updown_screener_',
  'nuxt4_stock_screener_cache'
];

// ...
if (k && (k.startsWith(RAW_CACHE_PREFIX) || LEGACY_CACHE_PREFIXES.some(prefix => k.startsWith(prefix)))) {
  keys.push(k);
}
```

### 🟢 **Medium - In-Flight Request 패턴 개선**

```typescript
// useLSStockRawStore.ts:20
let inFlightFetchPromise: Promise<void> | null = null; // ⚠️ 모듈 레벨 변수
```

**문제**:
- 모듈 레벨 변수는 HMR(Hot Module Replacement) 시 초기화 안 됨
- 여러 스토어 인스턴스 사이에 공유됨

**권장 개선**:
```typescript
export const useLSStockRawStore = defineStore('lsStockRaw', {
  state: () => ({
    // ...
    inFlightFetchPromise: null as Promise<void> | null // ✅ state로 이동
  }),

  actions: {
    async fetchRawStockData(forceRefresh = false) {
      if (this.inFlightFetchPromise) {
        return this.inFlightFetchPromise;
      }

      this.inFlightFetchPromise = (async () => {
        // ...
      })();

      return this.inFlightFetchPromise;
    }
  }
});
```

---

## 6️⃣ **성능 분석**

### ✅ **시간 복잡도**

| 작업 | 복잡도 | 평가 |
|------|--------|------|
| initFromStorage | O(n) | ✅ n = localStorage 키 수 |
| saveToStorage | O(m) | ✅ m = JSON.stringify 크기 |
| fetchRawStockData (캐시 히트) | O(1) | ✅ 즉시 반환 |
| fetchRawStockData (캐시 미스) | O(API) | ✅ 네트워크 의존 |
| addStock | O(n) | ✅ n = rawStockList 길이 |
| updateStock | O(n) | ✅ findIndex |
| deleteStock | O(n) | ✅ filter |
| Getters (재무 계산) | O(n × 4) | ⚠️ 중복 계산 |

### ⚠️ **개선 가능한 성능 이슈**

1. **Getter 중복 계산** (위에서 언급)
2. **rawStockMap Getter 매번 재생성**
   ```typescript
   rawStockMap: (state) => {
     const map = new Map<string, StockItem>(); // ⚠️ 매번 새로 생성
     state.rawStockList.forEach(item => map.set(item.shcode, item));
     return map;
   }
   ```
   - Pinia Getter는 캐싱되지만, 매 접근마다 재계산됨
   - 종목 수가 많으면 성능 저하

---

## 7️⃣ **보안 분석**

### ✅ **XSS 방지**
```typescript
const cleanCode = stockForm.shcode.trim().replace(/^A/i, ''); // ✅ 입력 정제
```
- ✅ 종목코드 정제
- ✅ Vue의 템플릿 자동 이스케이프

### ✅ **데이터 유효성 검증**
```typescript
if (response && response.success) {
  if (response.newData && response.newData.length > 0) { // ✅ 체크
    this.rawStockList = response.newData;
  }
}
```
- ✅ 응답 데이터 유효성 검증
- ✅ 빈 배열 체크

### ⚠️ **localStorage 보안**
- ⚠️ localStorage는 암호화되지 않음
- ⚠️ XSS 공격 시 데이터 유출 가능
- ℹ️ 민감 정보(비밀번호 등)는 저장 안 함 (OK)

---

## 8️⃣ **최종 평가**

### ✅ **정확성 점수**

| 항목 | 점수 | 평가 |
|------|------|------|
| 캐싱 전략 | 95/100 | ✅ 5일 보존, 만료 처리 완벽 |
| Getters 계산 | 90/100 | ✅ 재무 계산 정확, ⚠️ 중복 계산 |
| fetchRawStockData | 95/100 | ✅ In-Flight 패턴, 캐시 우선 |
| addStock/updateStock/deleteStock | 75/100 | ✅ 낙관적 업데이트, ⚠️ 롤백 없음 |
| 오류 처리 | 85/100 | ✅ try-catch 완비, ⚠️ 롤백 없음 |
| 성능 | 85/100 | ✅ 캐시 전략 우수, ⚠️ Getter 중복 |
| 보안 | 90/100 | ✅ 입력 정제, ⚠️ localStorage 한계 |
| 코드 품질 | 90/100 | ✅ 가독성 우수, ⚠️ 모듈 변수 |
| **종합 평가** | **88/100** | ✅ **우수** |

---

## 9️⃣ **권장 개선사항 우선순위**

### 🔴 **Priority 1 (Critical)**
1. ✅ **롤백 로직 추가**
   - addStock, updateStock, deleteStock에 서버 실패 시 롤백
   - 예상 소요: 2시간

### 🟡 **Priority 2 (High)**
2. ✅ **Getter 중복 계산 제거**
   - totalEvaluationProfit, totalReturnRate에서 다른 Getter 재사용
   - 예상 소요: 30분

3. ✅ **LocalStorage 용량 체크**
   - QuotaExceededError 처리
   - 예상 소요: 1시간

### 🟢 **Priority 3 (Medium)**
4. ⚠️ **In-Flight Request를 state로 이동**
   - 모듈 변수 → state 변수
   - 예상 소요: 30분

5. ⚠️ **레거시 캐시 키 상수화**
   - LEGACY_CACHE_PREFIXES 배열로 관리
   - 예상 소요: 15분

---

## 🎯 **결론**

### ✅ **useLSStockRawStore.ts는 88% 정확하고 우수합니다.**

**강점**:
- ✅ SSOT 패턴 완벽 구현
- ✅ 5일 캐싱 전략 정확
- ✅ In-Flight Request 패턴으로 중복 요청 방지
- ✅ 낙관적 업데이트로 빠른 UI 반응
- ✅ 재무 계산 로직 정확

**약점**:
- ⚠️ 롤백 로직 부재 (12점 감점)
- ⚠️ Getter 중복 계산 (성능 저하)
- ⚠️ LocalStorage 용량 제한 미고려

**종합**:
프로덕션 환경에서 사용 가능하지만, **롤백 로직 추가**가 필수입니다. 서버 장애 시 데이터 불일치가 발생할 수 있습니다.

개선사항을 적용하면 **95점 이상**의 완성도에 도달할 수 있습니다! 🚀
