import { defineStore } from 'pinia';
import { useLSStockRawStore } from './useLSStockRawStore';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';
import { isEtfOrEtn, arrayToMap, safeLocalStorageSet, safeLocalStorageGet, sanitizeShcode } from '../../utils/stockUtils';

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

const WATCHLIST_KEY_PREFIX = 'nuxt_watchlist_cache_';
const EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5일 보존 정책 (주식 거래일 1주일 기준)

function getTodayWatchlistKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${WATCHLIST_KEY_PREFIX}${year}-${month}-${day}`;
}

export const useWatchlistStore = defineStore('watchlist', {
  state: () => ({
    items: [] as WatchItem[],
    isLoading: false,
    errorMessage: null as string | null,
    isInitialized: false
  }),

  actions: {
    initFromStorage() {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(WATCHLIST_KEY_PREFIX)) {
          keys.push(k);
        }
      }

      const now = Date.now();
      for (const key of keys) {
        const cached = safeLocalStorageGet<{ items: WatchItem[]; cachedTimestamp: number }>(key);
        if (cached?.cachedTimestamp && now - cached.cachedTimestamp > EXPIRATION_MS) {
          localStorage.removeItem(key);
        }
      }

      const todayKey = getTodayWatchlistKey();
      const todayData = safeLocalStorageGet<{ items: WatchItem[]; cachedTimestamp: number }>(todayKey);

      if (todayData && todayData.items && Array.isArray(todayData.items)) {
        this.items = todayData.items;
      } else {
        const validKeys = keys.filter(k => {
          const cached = safeLocalStorageGet<{ cachedTimestamp: number }>(k);
          return cached?.cachedTimestamp && now - cached.cachedTimestamp <= EXPIRATION_MS;
        }).sort();

        if (validKeys.length > 0) {
          const latestKey = validKeys[validKeys.length - 1];
          const latestData = safeLocalStorageGet<{ items: WatchItem[] }>(latestKey);
          if (latestData?.items && Array.isArray(latestData.items)) {
            this.items = latestData.items;
          }
        }
      }
    },

    saveToStorage() {
      const todayKey = getTodayWatchlistKey();
      const data = {
        items: this.items,
        cachedTimestamp: Date.now()
      };
      safeLocalStorageSet(todayKey, data);
    },

    async loadInitial(forceRefresh = false) {
      if (!this.isInitialized) {
        this.initFromStorage();
        this.isInitialized = true;
      }

      if (!forceRefresh && this.items.length > 0) {
        return;
      }

      await this.refresh();
    },

    async refresh() {
      this.isLoading = true;
      try {
        const rawStore = useLSStockRawStore();
        await rawStore.fetchRawStockData(true);

        if (rawStore.rawStockList && rawStore.rawStockList.length > 0) {
          // ✅ 성능 최적화: Map으로 O(1) 조회
          const itemsMap = arrayToMap(this.items);

          rawStore.rawStockList.forEach(sc => {
            // ✅ 유틸 함수 사용: ETF 판별
            const isEtf = isEtfOrEtn(sc.name, sc.industry);

            const quantResult = calculateQuantIndicators({
              shcode: sc.shcode,
              name: sc.name,
              industry: sc.industry || '주요업종',
              closePrice: sc.closePrice || 0,
              psy: sc.psy,
              bbLower: sc.bbLower,
              ma5: sc.ma5,
              ma20: sc.ma20,
              ma60: sc.ma60,
              volumeRatio: sc.volumeRatio,
              macdHist: sc.macdHist,
              rsi: sc.rsi,
              bullishDivergence: sc.bullishDivergence,
              shortSellHistory: sc.shortSellHistory || []
            });

            const shortSellingStatus = isEtf
              ? 'ETF/ETN (공매도 t1927 제외 종목)'
              : quantResult.shortSignal.label;
            const score = quantResult.score;

            const existing = itemsMap.get(sc.shcode);
            if (existing) {
              existing.currentPrice = sc.closePrice || existing.currentPrice;
              existing.psy = sc.psy ?? existing.psy;
              existing.volumeRatio = sc.volumeRatio;
              existing.shortSellingStatus = shortSellingStatus;
              existing.score = score;
              existing.updatedAt = rawStore.lastUpdated;
            } else {
              this.items.push({
                shcode: sc.shcode,
                name: sc.name,
                industry: sc.industry || '주요업종',
                currentPrice: sc.closePrice || 0,
                psy: sc.psy,
                volumeRatio: sc.volumeRatio,
                shortSellingStatus,
                score,
                updatedAt: rawStore.lastUpdated
              });
            }
          });
          this.saveToStorage();
        }
      } catch (err: any) {
        console.error('watchlist refresh error:', err);
        this.errorMessage = err.message || 'LS증권 실시간 시세 및 8대 지표 갱신 실패';
      } finally {
        this.isLoading = false;
      }
    },

    async removeItem(shcode: string) {
      const cleanCode = sanitizeShcode(shcode);
      this.items = this.items.filter(it => it.shcode !== cleanCode);
      this.saveToStorage();

      try {
        await $fetch(`/api/watchlist/${cleanCode}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Remove watchlist item error:', err);
      }
    }
  }
});
