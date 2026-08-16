# LS증권 공매도 데이터 수집 정확성 검증 보고서

## 🚨 **Critical 이슈 발견**

### 1️⃣ **공매도 데이터 부족 시 무조건 0점 처리**

**현재 코드 (server/api/screener/index.post.ts:142-166)**:
```typescript
let shortSellHistory: ShortSellRecord[] = liveData.shortSellHistory || [];

const shortSignal = classifyShortSellSignal(shortSellHistory, isEtfOrForeign);
const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" 
  || shortSignal.label === "매수세가 공매도 흡수 중";

const shortSignalScore = cond_short_signal ? (shortSignalScoreMap[shortSignal.confidence] ?? 5) : 0;
```

**문제점**:
- ✅ LS증권 t1927 API 호출 실패 시: `shortSellHistory = []`
- ⚠️ 빈 배열 → `classifyShortSellSignal()` → "판단 보류" → **0점**
- 🚨 **결과**: 공매도 데이터 없으면 **매수 신호 절대 발생 안 함** (최대 90점)

---

### 2️⃣ **isFullyMatched 조건에 공매도 미포함**

**현재 코드 (line 178)**:
```typescript
const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi;
```

**문제점**:
- ❌ **공매도 신호가 조건에 없음!**
- ✅ 7개 지표만 체크 (공매도 제외)
- 🤔 의도: 공매도는 선택 항목?

**영향**:
- 공매도 데이터 없어도 7/7 충족 시 `isFullyMatched = true`
- 그러나 score는 최대 90점 (100점 불가)

---

### 3️⃣ **공매도 API 호출 실패 처리 불완전**

**현재 코드 (server/utils/ls/lsShortSell.ts)**:
```typescript
export async function fetchLSShortSellTrend(token: string, shcode: string) {
  // ...
  } catch (e: any) {
    console.warn(`⚠️ [LS증권 공매도 수급 데이터 조합 실패 - ${shcode}]:`, e.message);
  }
  return null; // ⚠️ 실패 시 null 반환
}
```

**문제점**:
- API 실패 시 `null` 반환
- 호출부에서 `shortSellHistory: shortSellTrend || undefined`
- 결국 빈 배열로 처리됨

---

## ✅ **권장 해결 방안**

### **Option 1: 공매도 없이도 분석 가능하도록 (권장)**

공매도 데이터는 **보조 지표**로 취급하고, 없어도 매수 신호 가능하게:

```typescript
// server/api/screener/index.post.ts

// 공매도 신호 분류 (데이터 없으면 중립 처리)
const shortSignal = classifyShortSellSignal(shortSellHistory, isEtfOrForeign);
const cond_short_signal = shortSignal.label === "숏커버링(환매수) 유력" 
  || shortSignal.label === "매수세가 공매도 흡수 중";

// ✅ 개선: 공매도 데이터 없을 때 기본 점수 부여
let shortSignalScore = 0;
if (shortSellHistory.length === 0) {
  // 공매도 데이터 없으면 중립 점수 (5점)
  shortSignalScore = 5;
} else if (cond_short_signal) {
  shortSignalScore = shortSignalScoreMap[shortSignal.confidence] ?? 5;
} else if (shortSignal.label === "신규 공매도 유입") {
  // 악재 신호는 감점 (-5점)
  shortSignalScore = -5;
} else {
  // 판단 보류는 0점
  shortSignalScore = 0;
}

// 스코어 계산
let score = 0;
if (cond_psy) score += 15;
if (cond_bb) score += 15;
if (cond_ma_turn) score += 15;
if (cond_volume) score += 15;
if (cond_macd) score += 15;
if (cond_rsi) score += 10;
if (cond_divergence) score += 5;
score += shortSignalScore; // -5 ~ +10점

// ✅ 개선: isFullyMatched는 7대 기술적 지표만 체크
const isFullyMatched = cond_psy && cond_bb && cond_ma_turn && cond_volume && cond_macd && cond_rsi && cond_divergence;
```

**효과**:
- 공매도 데이터 없어도 최대 95점 가능
- 공매도 악재(-5점), 중립(+5점), 호재(+10점) 3단계
- 7대 기술적 지표 충족 시 매수 신호 발생

---

### **Option 2: 공매도 필수 (엄격 모드)**

공매도 데이터가 없으면 **분석 자체를 건너뛰기**:

```typescript
// server/api/screener/index.post.ts

const newBatch = candidateStocks
  .filter(s => {
    const liveData = stockLiveMap.get(s.shcode);
    // ✅ 공매도 데이터 필수
    return liveData?.shortSellHistory && liveData.shortSellHistory.length > 0;
  })
  .map(s => {
    // ... 기존 로직
  });

// ⚠️ 필터링된 종목만 반환
```

**효과**:
- 공매도 데이터 없는 종목은 제외
- 100% 정확한 데이터만 표시
- 단, 분석 가능한 종목 수 대폭 감소

---

### **Option 3: 공매도 데이터 수집 재시도**

API 실패 시 재시도 로직 추가:

```typescript
// server/utils/ls/lsShortSell.ts

export async function fetchLSShortSellTrend(token: string, shcode: string, maxRetries = 2) {
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // ... 기존 로직
      if (combinedRecords.length > 0) {
        return combinedRecords;
      }
    } catch (e: any) {
      lastError = e;
      console.warn(`⚠️ [LS증권 t1927 시도 ${attempt + 1}/${maxRetries} 실패 - ${shcode}]:`, e.message);
      
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000)); // 1초 대기 후 재시도
      }
    }
  }

  console.error(`🚨 [LS증권 t1927 최종 실패 - ${shcode}]:`, lastError?.message);
  return null;
}
```

---

## 📊 **SK하이닉스 사례 분석**

**증상**: "공매도 분석이 안 됨"

**가능한 원인**:
1. LS증권 t1927 API에서 SK하이닉스(000660) 데이터 미제공
2. API Rate Limit 초과로 호출 실패
3. 네트워크 타임아웃
4. 잘못된 종목코드 (A000660 vs 000660)

**확인 방법**:
```bash
# 서버 터미널에서 로그 확인
⚠️ [LS증권 t1927 공매도일별추이 API 수신 실패 - 000660]
```

---

## 🎯 **즉시 적용 권장사항**

### **추천: Option 1 (공매도 선택 항목화)**

**이유**:
1. ✅ 7대 기술적 지표만으로도 충분히 신뢰 가능
2. ✅ 공매도 데이터 없어도 매수 신호 발생
3. ✅ 분석 가능한 종목 수 최대화
4. ✅ 공매도는 추가 정보로 활용

**적용 방법**:
- 공매도 없으면 중립 점수 +5점
- isFullyMatched는 7개 지표만 체크
- 공매도 악재는 감점(-5점)

---

어떤 옵션으로 수정할까요?
1. **Option 1**: 공매도 선택 항목 (권장)
2. **Option 2**: 공매도 필수 (엄격)
3. **Option 3**: 재시도 로직 추가
4. **기타**: 다른 제안

답변해 주시면 즉시 수정하겠습니다! 🚀
