import { defineStore } from 'pinia';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';

export interface ShortSellRecord {
  date: string;
  price: number;
  volume: number;
  shortAvgPrice?: number;
  balanceRatio?: number;
}

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

const DETAIL_KEY_PREFIX = 'nuxt4_stock_detail_';
const EXPIRATION_MS = 15 * 24 * 60 * 60 * 1000; // 15일 보존 정책

function getTodayDetailKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${DETAIL_KEY_PREFIX}${year}-${month}-${day}`;
}

export const useStockDetailStore = defineStore('stockDetail', {
  state: () => ({
    stockCache: {} as Record<string, StockDetailStateItem>,
    isFetching: false,
    errorMessage: null as string | null
  }),

  actions: {
    // 1. LocalStorage에서 종목 상세 캐시 불러오기 (1일 1개 보존 & 15일 이상 경과 데이터만 자동 정리)
    initFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const now = Date.now();
        const validDailyKeys: string[] = [];

        // 15일 이상 경과된 과거 일별 키만 자동 삭제
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(DETAIL_KEY_PREFIX) || key.startsWith('nuxt4_stock_detail_cache'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.cachedTimestamp && now - parsed.cachedTimestamp > EXPIRATION_MS) {
                  localStorage.removeItem(key); // 15일 초과 시에만 삭제
                } else if (key.startsWith(DETAIL_KEY_PREFIX)) {
                  validDailyKeys.push(key);
                }
              } catch (e) {
                localStorage.removeItem(key);
              }
            }
          }
        }

        const todayKey = getTodayDetailKey();
        const targetKey = localStorage.getItem(todayKey) ? todayKey : (validDailyKeys.sort().pop() || todayKey);
        const saved = localStorage.getItem(targetKey);

        if (saved) {
          const parsed = JSON.parse(saved) || {};
          let hasExpired = false;

          Object.keys(parsed).forEach((key) => {
            const item = parsed[key];
            if (item && item.cachedTimestamp && now - item.cachedTimestamp > EXPIRATION_MS) {
              delete parsed[key];
              hasExpired = true;
            }
          });

          this.stockCache = parsed;
          if (hasExpired) {
            this.saveToStorage();
          }
        }
      } catch (e) {
        console.error('Failed to load stock detail cache:', e);
      }
    },

    // 2. LocalStorage에 당일 1일 1개 덮어쓰기 저장
    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        const todayKey = getTodayDetailKey();
        localStorage.setItem(todayKey, JSON.stringify(this.stockCache));
      } catch (e) {
        console.error('Failed to save stock detail cache:', e);
      }
    },

    // 3. 특정 종목 캐시 데이터 가져오기 (15일 유효성 검사 - 15일 이상 자동 제거)
    getStockCache(shcode: string): StockDetailStateItem | null {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      const item = this.stockCache[cleanCode];
      if (!item) return null;

      if (item.cachedTimestamp && Date.now() - item.cachedTimestamp > EXPIRATION_MS) {
        delete this.stockCache[cleanCode];
        this.saveToStorage();
        return null;
      }
      return item;
    },

    // 4. 종목 데이터 업데이트 및 LocalStorage 15일 보존
    updateStockCache(shcode: string, data: StockDetailStateItem) {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      this.stockCache[cleanCode] = {
        ...data,
        cachedTimestamp: Date.now(),
        updatedAt: new Date().toLocaleString('ko-KR')
      };
      this.saveToStorage();
    },

    // 5. API 중앙 수집, Pinia 스토어 갱신 & 15일 LocalStorage 보존
    async fetchAndCacheStock(shcode: string, forceRefresh = false): Promise<StockDetailStateItem | null> {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      
      // 1. [평상시] forceRefresh가 false이고 유효한 Pinia/LocalStorage 데이터가 있으면 0ms 즉시 반환 (API 토큰 아낌)
      if (!forceRefresh) {
        const cached = this.getStockCache(cleanCode);
        if (cached) return cached;
      }

      this.isFetching = true;
      this.errorMessage = null;

      try {
        // 2. [새로고침 요청 시 또는 데이터 미보유 시만] 중앙 통신 API 호출
        const res = await $fetch<{ success: boolean; data: any }>(`/api/stock/${cleanCode}`);
        if (res && res.success && res.data) {
          const calculatedData = calculateQuantIndicators(res.data);
          this.updateStockCache(cleanCode, calculatedData);
          return calculatedData;
        } else {
          this.errorMessage = '종목 상세 데이터를 불러오지 못했습니다.';
        }
      } catch (err: any) {
        console.error('Fetch and cache stock error:', err);
        this.errorMessage = err.statusMessage || err.message || 'LS증권 API 수집 실패';
      } finally {
        this.isFetching = false;
      }
      return this.getStockCache(cleanCode);
    },

    // 6. 생성된 AI 보고서 스토어 및 LocalStorage 저장
    saveAiReport(shcode: string, reportText: string) {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      const existing = this.stockCache[cleanCode] || { shcode: cleanCode, name: cleanCode, industry: '기타', closePrice: 0, isHolding: false, score: 0, isFullyMatched: false, conditions: {} };
      this.stockCache[cleanCode] = {
        ...existing,
        generatedReport: reportText,
        generatedReportAt: new Date().toLocaleString('ko-KR'),
        cachedTimestamp: Date.now()
      };
      this.saveToStorage();
    }
  }
});
