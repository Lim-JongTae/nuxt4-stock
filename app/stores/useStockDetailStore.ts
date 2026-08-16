import { defineStore } from 'pinia';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';
import type { ShortSellRecord, StockDetailStateItem } from '../../utils/types/lsSecurities';
import { sanitizeShcode, safeLocalStorageSet, safeLocalStorageGet } from '../../utils/stockUtils';
import { useLSStockRawStore } from './useLSStockRawStore';

const DETAIL_KEY_PREFIX = 'nuxt_stock_detail_';
const EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5일 보존 정책 (주식 거래일 1주일 기준)

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
    initFromStorage() {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(DETAIL_KEY_PREFIX)) {
          keys.push(k);
        }
      }

      const now = Date.now();
      let hasExpired = false;

      for (const key of keys) {
        const cached = safeLocalStorageGet<Record<string, StockDetailStateItem>>(key);
        if (cached) {
          const cleanedCache = this.cleanExpiredItems(cached, now);

          if (Object.keys(cleanedCache).length !== Object.keys(cached).length) {
            hasExpired = true;
            if (Object.keys(cleanedCache).length > 0) {
              safeLocalStorageSet(key, cleanedCache);
            } else {
              localStorage.removeItem(key);
            }
          }

          Object.assign(this.stockCache, cleanedCache);
        }
      }

      const todayKey = getTodayDetailKey();
      const todayData = safeLocalStorageGet<Record<string, StockDetailStateItem>>(todayKey);

      if (todayData && Object.keys(todayData).length > 0) {
        Object.assign(this.stockCache, todayData);
      }
    },

    cleanExpiredItems(cache: Record<string, StockDetailStateItem>, now: number): Record<string, StockDetailStateItem> {
      const cleaned: Record<string, StockDetailStateItem> = {};
      Object.keys(cache).forEach((key) => {
        const item = cache[key];
        if (item && (!item.cachedTimestamp || now - item.cachedTimestamp <= EXPIRATION_MS)) {
          cleaned[key] = item;
        }
      });
      return cleaned;
    },

    saveToStorage() {
      const todayKey = getTodayDetailKey();
      safeLocalStorageSet(todayKey, this.stockCache);
    },

    getStockCache(shcode: string): StockDetailStateItem | null {
      const cleanCode = sanitizeShcode(shcode);
      const item = this.stockCache[cleanCode];
      if (!item) return null;

      if (item.cachedTimestamp && Date.now() - item.cachedTimestamp > EXPIRATION_MS) {
        delete this.stockCache[cleanCode];
        this.saveToStorage();
        return null;
      }
      return item;
    },

    updateStockCache(shcode: string, data: StockDetailStateItem) {
      const cleanCode = sanitizeShcode(shcode);
      this.stockCache[cleanCode] = {
        ...data,
        cachedTimestamp: Date.now()
      };
      this.saveToStorage();
    },

    async fetchAndCacheStock(shcode: string, forceRefresh = false): Promise<StockDetailStateItem | null> {
      const cleanCode = sanitizeShcode(shcode);

      if (!forceRefresh) {
        const cached = this.getStockCache(cleanCode);
        if (cached) return cached;
      }

      this.isFetching = true;

      try {
        const res = await $fetch<{ success: boolean; data: any }>(`/api/stock/${cleanCode}`);
        if (res && res.success && res.data) {
          const calculatedData = calculateQuantIndicators(res.data);
          this.updateStockCache(cleanCode, calculatedData);
          return calculatedData;
        }
      } catch (err: any) {
        console.error('Fetch and cache stock error:', err);
        this.errorMessage = err.statusMessage || err.message || 'LS증권 API 수집 실패';
      } finally {
        this.isFetching = false;
      }
      return this.getStockCache(cleanCode);
    },

    saveAiReport(shcode: string, reportText: string) {
      const cleanCode = sanitizeShcode(shcode);
      const rawStore = useLSStockRawStore();
      const rawStock = rawStore.rawStockMap.get(cleanCode);

      const existing = this.stockCache[cleanCode] || {
        shcode: cleanCode,
        name: rawStock?.name || cleanCode,
        industry: rawStock?.industry || '기타',
        closePrice: rawStock?.closePrice || 0,
        isHolding: rawStock?.isHolding || false,
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
  }
});
