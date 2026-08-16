# usePortfolioStore.ts 검증 보고서

## 📊 종합 평가: 82/100점 (양호)

---

## 1️⃣ **아키텍처 분석**

### 📌 **의존성 구조**

```typescript
// usePortfolioStore.ts:3-4
import { useLSStockRawStore } from './useLSStockRawStore';
import { useScreenerStore } from './useScreenerStore';

// Getters에서 다른 스토어 참조
getters: {
  totalPurchaseAmount: (state) => {
    const rawStore = useLSStockRawStore();        // ✅ 원천 스토어 참조
    const list = state.holdings.length > 0 
      ? state.holdings 
      : rawStore.holdingsList;                    // ✅ Fallback
  }
}
```

**의존성 그래프**:
```
usePortfolioStore
    ├── useLSStockRawStore (SSOT)
    └── useScreenerStore (시세 데이터)
```

**평가**:
- ✅ SSOT 패턴 준수
- ✅ Fallback 체인 구현
- ⚠️ 순환 참조 가능성 (useScreenerStore도 usePortfolioStore 참조 시)

---

## 2️⃣ **State 분석**

```typescript
// usePortfolioStore.ts:7-14
state: () => ({
  holdings: [] as HoldingItem[],              // ✅ 보유종목 목록
  isLoading: false,                           // ✅ 로딩 상태
  selectedStockForAi: null as string | null,  // ✅ AI 분석 대상
  aiAnalysisResult: '',                       // ✅ AI 분석 결과
  isAiAnalyzing: false,                       // ✅ AI 분석 중
  errorMessage: null as string | null         // ✅ 오류 메시지
})
```

**평가**:
- ✅ 타입 안전성 확보
- ✅ 상태 분리 명확
- ✅ 오류 처리 상태 포함

---

## 3️⃣ **Getters 검증**

### ✅ **총 매수금액 (totalPurchaseAmount)**

```typescript
// usePortfolioStore.ts:17-25
totalPurchaseAmount: (state) => {
  const rawStore = useLSStockRawStore();
  const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList; // ✅ Fallback
  return list.reduce((sum, item) => {
    const price = Number(item.avgPrice ?? (item as any).holdingAvgPrice) || 0; // ⚠️ any 타입
    const qty = Number(item.quantity ?? (item as any).holdingQuantity) || 0;
    return sum + (price * qty);
  }, 0);
}
```

**검증 결과**:
- ✅ Fallback 체인 (avgPrice → holdingAvgPrice → 0)
- ✅ 0 나눗셈 방지
- ⚠️ `(item as any)` 타입 단언 사용 (타입 안전성 저하)
- ✅ reduce 로직 정확

**예시 계산**:
```
삼성전자: 70,000원 × 10주 = 700,000원
SK하이닉스: 120,000원 × 5주 = 600,000원
총 매수금액 = 1,300,000원 ✅
```

### ⚠️ **총 평가금액 (totalValuationAmount) - 복잡도 높음**

```typescript
// usePortfolioStore.ts:26-43
totalValuationAmount: (state) => {
  const rawStore = useLSStockRawStore();
  const screenerStore = useScreenerStore();    // ⚠️ 추가 의존성
  const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList;

  return list.reduce((sum, item) => {
    const rawStock = rawStore.rawStockMap.get(item.shcode);
    const screenerStock = screenerStore.newData.find(s => s.shcode === item.shcode); // ⚠️ O(n)
    
    // 복잡한 Fallback 체인
    const livePrice = (rawStock?.closePrice && rawStock.closePrice > 0)
      ? rawStock.closePrice                    // 1순위: rawStore 실시간가
      : (screenerStock?.closePrice && screenerStock.closePrice > 0)
        ? screenerStock.closePrice             // 2순위: screenerStore 실시간가
        : (Number(item.currentPrice) > 0 
          ? Number(item.currentPrice) 
          : Number((item as any).holdingAvgPrice || item.avgPrice)) || 0; // 3순위: 평균단가

    const qty = Number(item.quantity ?? (item as any).holdingQuantity) || 0;
    return sum + (livePrice * qty);
  }, 0);
}
```

**문제점**:
1. ⚠️ **성능 이슈**: `screenerStore.newData.find()` → O(n²) 복잡도
   - holdings 10개 × screenerStore.newData 100개 = 1,000번 순회
2. ⚠️ **복잡한 Fallback**: 3단계 조건문 (가독성 저하)
3. ⚠️ **타입 안전성**: `(item as any)` 사용

**권장 개선**:
```typescript
totalValuationAmount: (state) => {
  const rawStore = useLSStockRawStore();
  const screenerStore = useScreenerStore();
  
  // ✅ 성능 최적화: Map으로 O(1) 조회
  const screenerMap = new Map(
    screenerStore.newData.map(s => [s.shcode, s])
  );
  
  const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList;

  return list.reduce((sum, item) => {
    // ✅ 가독성 개선: 함수 추출
    const livePrice = this.getLivePrice(item, rawStore, screenerMap);
    const qty = Number(item.quantity ?? item.holdingQuantity) || 0;
    return sum + (livePrice * qty);
  }, 0);
},

// ✅ 헬퍼 함수 추가
getLivePrice(item: HoldingItem, rawStore: any, screenerMap: Map<string, any>): number {
  const rawStock = rawStore.rawStockMap.get(item.shcode);
  if (rawStock?.closePrice && rawStock.closePrice > 0) {
    return rawStock.closePrice;
  }
  
  const screenerStock = screenerMap.get(item.shcode);
  if (screenerStock?.closePrice && screenerStock.closePrice > 0) {
    return screenerStock.closePrice;
  }
  
  return Number(item.currentPrice) || Number(item.avgPrice) || 0;
}
```

### ✅ **총 손익 (totalPnlAmount)**

```typescript
// usePortfolioStore.ts:44-46
totalPnlAmount(): number {
  return this.totalValuationAmount - this.totalPurchaseAmount;
}
```

**평가**:
- ✅ 단순 명확
- ✅ 다른 Getter 재사용 (중복 계산 없음)

### ✅ **총 수익률 (totalPnlRate)**

```typescript
// usePortfolioStore.ts:47-50
totalPnlRate(): number {
  if (this.totalPurchaseAmount === 0) return 0; // ✅ 0 나눗셈 방지
  return Math.round((this.totalPnlAmount / this.totalPurchaseAmount) * 10000) / 100;
}
```

**평가**:
- ✅ 0 나눗셈 방지
- ✅ 소수점 2자리 반올림
- ✅ 정확한 퍼센트 계산

**예시 계산**:
```
평가금액: 1,375,000원
매수금액: 1,300,000원
손익: 75,000원
수익률 = (75,000 / 1,300,000) × 100 = 5.77% ✅
```

### ℹ️ **Alias Getters (호환성)**

```typescript
// usePortfolioStore.ts:51-63
// Alias getters for DashboardView compatibility
totalInvested(): number {
  return this.totalPurchaseAmount;
},
totalEvaluated(): number {
  return this.totalValuationAmount;
},
totalProfitLoss(): number {
  return this.totalPnlAmount;
},
totalProfitRate(): number {
  return this.totalPnlRate;
}
```

**평가**:
- ✅ 레거시 호환성 유지
- ⚠️ 중복 Getter (불필요한 오버헤드)
- ℹ️ 향후 DashboardView 리팩토링 시 제거 권장

---

## 4️⃣ **Actions 검증**

### ⚠️ **fetchHoldings - 보유종목 조회**

```typescript
// usePortfolioStore.ts:67-118
async fetchHoldings(forceRefresh = false) {
  if (!forceRefresh && this.holdings.length > 0) return; // ✅ 캐시 체크

  this.isLoading = true;
  this.errorMessage = null;

  try {
    const rawStore = useLSStockRawStore();
    const screenerStore = useScreenerStore();
    
    // ⚠️ 의존성 로딩 (추가 지연 가능)
    if (!rawStore.hasRawData) {
      await screenerStore.loadInitial(false);
    }

    // ✅ API 호출
    const data = await $fetch<HoldingItem[]>(`/api/holdings?ts=${Date.now()}`);
    
    if (data && Array.isArray(data) && data.length > 0) {
      // ✅ 실시간가 병합
      this.holdings = data.map(h => {
        const rawStock = rawStore.rawStockMap.get(h.shcode);
        const screenerStock = screenerStore.newData.find(s => s.shcode === h.shcode); // ⚠️ O(n)
        
        const livePrice = (rawStock?.closePrice && rawStock.closePrice > 0)
          ? rawStock.closePrice
          : (screenerStock?.closePrice && screenerStock.closePrice > 0)
            ? screenerStock.closePrice
            : (Number(h.currentPrice) > 0 ? Number(h.currentPrice) : Number(h.avgPrice));

        return {
          ...h,
          quantity: Number(h.quantity) || 0,
          avgPrice: Number(h.avgPrice) || 0,
          currentPrice: Number(livePrice) > 0 ? Number(livePrice) : (Number(h.avgPrice) || 0)
        };
      });
    } else if (rawStore.holdingsList && rawStore.holdingsList.length > 0) {
      // ✅ Fallback: rawStore에서 로드
      this.holdings = rawStore.holdingsList.map(h => ({
        shcode: h.shcode,
        name: h.name,
        industry: h.industry || '주요보유',
        quantity: h.holdingQuantity ?? h.quantity ?? 0,
        avgPrice: h.holdingAvgPrice ?? h.avgPrice ?? 0,
        currentPrice: h.closePrice || h.holdingAvgPrice || h.avgPrice || 0,
        targetPrice: h.targetPrice || 0,
        stopLossPrice: h.stopLossPrice || 0,
        trailingRate: 2.5,
        updatedAt: rawStore.lastUpdated || new Date().toLocaleString('ko-KR')
      }));
    }
  } catch (err: any) {
    console.error('Fetch holdings error:', err);
    this.errorMessage = err.statusMessage || err.message || '보유 종목 데이터를 불러오는 데 실패했습니다.';
  } finally {
    this.isLoading = false;
  }
}
```

**평가**:
- ✅ 캐시 체크 (forceRefresh)
- ✅ Fallback 체인 (API → rawStore)
- ✅ 실시간가 병합
- ⚠️ **성능 이슈**: `screenerStore.newData.find()` → O(n²)
- ⚠️ **복잡도 높음**: 중첩된 조건문 과다
- ✅ 오류 처리 완비

### ✅ **refreshPrices - 실시간 시세 갱신**

```typescript
// usePortfolioStore.ts:120-144
async refreshPrices() {
  this.isLoading = true;
  this.errorMessage = null;
  
  try {
    const data = await $fetch<any>('/api/holdings/price');
    if (data && Array.isArray(data)) {
      data.forEach((p: any) => {
        const idx = this.holdings.findIndex(h => h.shcode === p.shcode); // ⚠️ O(n)
        if (idx !== -1 && this.holdings[idx]) {
          const h = this.holdings[idx];
          h.currentPrice = Number(p.currentPrice) || h.currentPrice || h.avgPrice;
          h.targetPrice = Number(p.targetPrice) || h.targetPrice;
          h.stopLossPrice = Number(p.stopLossPrice) || h.stopLossPrice;
          h.trailingRate = p.trailingRate;
          h.updatedAt = p.updatedAt;
        }
      });
    }
  } catch (err: any) {
    console.error('Refresh prices error:', err);
    this.errorMessage = err.statusMessage || err.message || '실시간 시세 갱신에 실패했습니다.';
  } finally {
    this.isLoading = false;
  }
}
```

**평가**:
- ✅ 오류 처리 완비
- ✅ Fallback 값 유지
- ⚠️ **성능 이슈**: `findIndex` 매번 호출 → O(n²)
- ⚠️ **타입 안전성**: `any` 타입 사용

**권장 개선**:
```typescript
async refreshPrices() {
  this.isLoading = true;
  this.errorMessage = null;
  
  try {
    const data = await $fetch<any>('/api/holdings/price');
    if (data && Array.isArray(data)) {
      // ✅ Map으로 O(1) 조회
      const holdingsMap = new Map(
        this.holdings.map((h, idx) => [h.shcode, idx])
      );
      
      data.forEach((p: any) => {
        const idx = holdingsMap.get(p.shcode);
        if (idx !== undefined && this.holdings[idx]) {
          const h = this.holdings[idx];
          h.currentPrice = Number(p.currentPrice) || h.currentPrice || h.avgPrice;
          h.targetPrice = Number(p.targetPrice) || h.targetPrice;
          h.stopLossPrice = Number(p.stopLossPrice) || h.stopLossPrice;
          h.trailingRate = p.trailingRate;
          h.updatedAt = p.updatedAt;
        }
      });
    }
  } catch (err: any) {
    console.error('Refresh prices error:', err);
    this.errorMessage = err.statusMessage || err.message || '실시간 시세 갱신에 실패했습니다.';
  } finally {
    this.isLoading = false;
  }
}
```

### ✅ **runAiDiagnosis - AI 진단**

```typescript
// usePortfolioStore.ts:146-166
async runAiDiagnosis(stockName: string) {
  this.selectedStockForAi = stockName;
  this.isAiAnalyzing = true;
  this.aiAnalysisResult = '';
  this.errorMessage = null;

  try {
    const res = await $fetch<{ success: boolean; result: string }>('/api/ai/analyze', {
      method: 'POST',
      body: { prompt: `${stockName} 보유 종목의 손익률 및 시세 수급 기반 AI 대응 전략을 제시해 주세요.` }
    });
    if (res && res.result) {
      this.aiAnalysisResult = res.result;
    }
  } catch (err: any) {
    console.error('AI diagnosis error:', err);
    this.errorMessage = err.statusMessage || err.message || 'AI 진단 중 오류가 발생했습니다.';
  } finally {
    this.isAiAnalyzing = false;
  }
}
```

**평가**:
- ✅ 상태 관리 정확
- ✅ 오류 처리 완비
- ✅ 타입 안전성 확보
- ℹ️ 프롬프트 하드코딩 (향후 템플릿화 권장)

---

## 5️⃣ **발견된 이슈**

### 🔴 **Critical - 성능 문제 (O(n²) 복잡도)**

**문제 1: Getter의 find 사용**
```typescript
// usePortfolioStore.ts:33
const screenerStock = screenerStore.newData.find(s => s.shcode === item.shcode);
```

**영향**:
- holdings 10개 × screenerStore.newData 100개 = 1,000번 순회
- Getter는 자주 호출됨 (렌더링마다)

**해결**:
```typescript
// 1회만 Map 생성
const screenerMap = new Map(
  screenerStore.newData.map(s => [s.shcode, s])
);

// O(1) 조회
const screenerStock = screenerMap.get(item.shcode);
```

**문제 2: refreshPrices의 findIndex**
```typescript
// usePortfolioStore.ts:128
data.forEach((p: any) => {
  const idx = this.holdings.findIndex(h => h.shcode === p.shcode); // O(n)
});
```

**영향**:
- data 10개 × holdings 10개 = 100번 순회

**해결**: (위에서 제시한 Map 사용)

### 🟡 **High - 타입 안전성 문제**

**문제: any 타입 단언**
```typescript
// usePortfolioStore.ts:21
const price = Number(item.avgPrice ?? (item as any).holdingAvgPrice) || 0;
```

**원인**:
- `HoldingItem` 타입이 `holdingAvgPrice`를 포함하지 않음
- 런타임에서만 존재하는 필드

**해결**:
```typescript
// 1. 타입 확장
interface ExtendedHoldingItem extends HoldingItem {
  holdingAvgPrice?: number;
  holdingQuantity?: number;
}

// 2. 타입 가드 함수
function hasHoldingFields(item: any): item is ExtendedHoldingItem {
  return 'holdingAvgPrice' in item || 'holdingQuantity' in item;
}

// 3. 사용
const price = hasHoldingFields(item)
  ? (item.avgPrice ?? item.holdingAvgPrice ?? 0)
  : (item.avgPrice ?? 0);
```

### 🟡 **High - Alias Getters 중복**

```typescript
// usePortfolioStore.ts:51-63
totalInvested(): number {
  return this.totalPurchaseAmount; // ⚠️ 불필요한 Getter
}
```

**문제**:
- 4개 Alias Getter가 메모리 차지
- 가독성 저하

**해결**:
- DashboardView를 리팩토링하여 원본 Getter 사용
- Alias 제거

### 🟢 **Medium - 복잡한 Fallback 체인**

```typescript
const livePrice = (rawStock?.closePrice && rawStock.closePrice > 0)
  ? rawStock.closePrice
  : (screenerStock?.closePrice && screenerStock.closePrice > 0)
    ? screenerStock.closePrice
    : (Number(item.currentPrice) > 0 
      ? Number(item.currentPrice) 
      : Number((item as any).holdingAvgPrice || item.avgPrice)) || 0;
```

**문제**:
- 4단계 삼항 연산자 (가독성 최악)
- 디버깅 어려움

**해결**:
```typescript
function getLivePrice(item: HoldingItem, rawStock: any, screenerStock: any): number {
  // 1순위: rawStore 실시간가
  if (rawStock?.closePrice && rawStock.closePrice > 0) {
    return rawStock.closePrice;
  }
  
  // 2순위: screenerStore 실시간가
  if (screenerStock?.closePrice && screenerStock.closePrice > 0) {
    return screenerStock.closePrice;
  }
  
  // 3순위: currentPrice
  if (Number(item.currentPrice) > 0) {
    return Number(item.currentPrice);
  }
  
  // 4순위: 평균단가
  return Number(item.avgPrice) || 0;
}
```

---

## 6️⃣ **성능 분석**

### ⚠️ **시간 복잡도**

| 작업 | 현재 | 개선 후 | 평가 |
|------|------|---------|------|
| totalValuationAmount (Getter) | O(n²) | O(n) | ⚠️ Critical |
| fetchHoldings | O(n²) | O(n) | ⚠️ High |
| refreshPrices | O(n²) | O(n) | ⚠️ High |
| runAiDiagnosis | O(1) | O(1) | ✅ |

**예시 계산**:
```
holdings: 10개
screenerStore.newData: 100개

현재: 10 × 100 = 1,000번 순회
개선 후: 100 (Map 생성) + 10 (조회) = 110번 순회

성능 향상: 약 9배 ✅
```

---

## 7️⃣ **최종 평가**

### ✅ **정확성 점수**

| 항목 | 점수 | 평가 |
|------|------|------|
| Getters 계산 정확성 | 95/100 | ✅ 재무 계산 정확 |
| 타입 안전성 | 70/100 | ⚠️ any 타입 과다 사용 |
| 성능 | 60/100 | ⚠️ O(n²) 복잡도 |
| 오류 처리 | 95/100 | ✅ 완비 |
| 코드 가독성 | 75/100 | ⚠️ 복잡한 중첩 조건문 |
| 아키텍처 | 85/100 | ✅ SSOT 패턴 준수 |
| Fallback 전략 | 90/100 | ✅ 다단계 Fallback |
| **종합 평가** | **82/100** | ✅ **양호** |

---

## 8️⃣ **권장 개선사항 우선순위**

### 🔴 **Priority 1 (Critical)**
1. ✅ **O(n²) 성능 이슈 해결**
   - `totalValuationAmount` Getter에서 Map 사용
   - `refreshPrices` Action에서 Map 사용
   - 예상 소요: 2시간
   - **성능 향상: 약 9배**

### 🟡 **Priority 2 (High)**
2. ✅ **타입 안전성 개선**
   - `any` 타입 제거
   - 타입 가드 또는 인터페이스 확장
   - 예상 소요: 1.5시간

3. ✅ **복잡한 Fallback 로직 함수 추출**
   - `getLivePrice()` 헬퍼 함수 생성
   - 가독성 향상
   - 예상 소요: 1시간

### 🟢 **Priority 3 (Medium)**
4. ⚠️ **Alias Getters 제거**
   - DashboardView 리팩토링 후 제거
   - 예상 소요: 1시간

5. ⚠️ **AI 프롬프트 템플릿화**
   - 하드코딩된 프롬프트 → 설정 파일로 분리
   - 예상 소요: 30분

---

## 9️⃣ **개선 코드 예시**

### ✅ **성능 최적화된 totalValuationAmount**

```typescript
totalValuationAmount: (state) => {
  const rawStore = useLSStockRawStore();
  const screenerStore = useScreenerStore();
  
  // ✅ 1회만 Map 생성
  const screenerMap = new Map(
    screenerStore.newData.map(s => [s.shcode, s])
  );
  
  const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList;

  return list.reduce((sum, item) => {
    const rawStock = rawStore.rawStockMap.get(item.shcode);
    const screenerStock = screenerMap.get(item.shcode); // ✅ O(1)
    
    // ✅ 가독성 개선
    const livePrice = getLivePrice(item, rawStock, screenerStock);
    const qty = Number(item.quantity ?? item.holdingQuantity) || 0;
    return sum + (livePrice * qty);
  }, 0);
}
```

### ✅ **헬퍼 함수**

```typescript
function getLivePrice(
  item: HoldingItem, 
  rawStock: any, 
  screenerStock: any
): number {
  if (rawStock?.closePrice && rawStock.closePrice > 0) {
    return rawStock.closePrice;
  }
  
  if (screenerStock?.closePrice && screenerStock.closePrice > 0) {
    return screenerStock.closePrice;
  }
  
  if (Number(item.currentPrice) > 0) {
    return Number(item.currentPrice);
  }
  
  return Number(item.avgPrice) || 0;
}
```

---

## 🎯 **결론**

### ✅ **usePortfolioStore.ts는 82% 정확하고 양호합니다.**

**강점**:
- ✅ 재무 계산 정확
- ✅ SSOT 패턴 준수
- ✅ 다단계 Fallback 전략
- ✅ 오류 처리 완비

**약점**:
- ⚠️ O(n²) 성능 이슈 (18점 감점)
- ⚠️ 타입 안전성 저하 (any 과다 사용)
- ⚠️ 복잡한 중첩 조건문

**종합**:
프로덕션 환경에서 사용 가능하지만, **성능 최적화(Map 사용)**가 필수입니다. 종목 수가 증가하면 성능 저하가 심각해질 수 있습니다.

개선사항을 적용하면 **95점 이상**의 완성도에 도달할 수 있습니다! 🚀
