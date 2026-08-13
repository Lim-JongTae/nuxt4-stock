import { defineStore } from 'pinia';

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
  updatedAt?: string;
  cachedTimestamp?: number;
}

const STOCK_DETAIL_STORAGE_KEY = 'nuxt4_stock_detail_cache_v2';
const EXPIRATION_MS = 15 * 24 * 60 * 60 * 1000; // 15일 보존 정책

export const useStockDetailStore = defineStore('stockDetail', {
  state: () => ({
    stockCache: {} as Record<string, StockDetailStateItem>,
    isFetching: false,
    errorMessage: null as string | null
  }),

  actions: {
    // 1. LocalStorage에서 종목 상세 캐시 불러오기 (15일 초과 데이터 자동 정리)
    initFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const saved = localStorage.getItem(STOCK_DETAIL_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) || {};
          const now = Date.now();
          let hasExpired = false;

          Object.keys(parsed).forEach((key) => {
            const item = parsed[key];
            if (item && item.cachedTimestamp && now - item.cachedTimestamp > EXPIRATION_MS) {
              delete parsed[key]; // 15일 경과 항목 자동 폐기
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

    // 2. LocalStorage에 종목 상세 캐시 저장
    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        localStorage.setItem(STOCK_DETAIL_STORAGE_KEY, JSON.stringify(this.stockCache));
      } catch (e) {
        console.error('Failed to save stock detail cache:', e);
      }
    },

    // 3. 특정 종목 캐시 데이터 가져오기 (30일 유효성 검사)
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

    // 4. 종목 데이터 업데이트 및 LocalStorage 30일 보존
    updateStockCache(shcode: string, data: StockDetailStateItem) {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      this.stockCache[cleanCode] = {
        ...data,
        cachedTimestamp: Date.now(),
        updatedAt: new Date().toLocaleString('ko-KR')
      };
      this.saveToStorage();
    },

    // 5. API 실시간 수집 및 캐시/스토어 업데이트
    async fetchAndCacheStock(shcode: string): Promise<StockDetailStateItem | null> {
      const cleanCode = String(shcode).trim().replace(/^A/i, '');
      this.isFetching = true;
      this.errorMessage = null;

      try {
        const res = await $fetch<{ success: boolean; data: StockDetailStateItem }>(`/api/stock/${cleanCode}`);
        if (res && res.success && res.data) {
          this.updateStockCache(cleanCode, res.data);
          return res.data;
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
    }
  }
});
