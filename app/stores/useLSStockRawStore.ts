import { defineStore } from 'pinia';
import type {
  StockItem,
  ScreenerApiResponse,
  MarketBasisInfo,
  TopSectorInfo
} from '../../utils/types/lsSecurities';

import { safeLocalStorageSet } from '../../utils/stockUtils';

const RAW_CACHE_PREFIX = 'nuxt_ls_raw_data_';
const EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5일 보존 정책 (주식 거래일 1주일 기준)

function getTodayRawKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${RAW_CACHE_PREFIX}${year}-${month}-${day}`;
}

let inFlightFetchPromise: Promise<void> | null = null;

export const useLSStockRawStore = defineStore('lsStockRaw', {
  state: () => ({
    rawStockList: [] as StockItem[],
    marketBasis: null as MarketBasisInfo | null,
    topSectors: [] as TopSectorInfo[],
    bottomSectors: [] as TopSectorInfo[],
    lastUpdated: '',
    cachedTimestamp: 0,
    sourceProvider: 'LS증권 Open API',
    isLoading: false,
    errorMessage: null as string | null
  }),

  getters: {
    hasRawData: (state) => state.rawStockList.length > 0,

    rawStockMap: (state) => {
      const map = new Map<string, StockItem>();
      state.rawStockList.forEach(item => {
        if (!item.shcode) return;
        const cleanCode = item.shcode.trim().replace(/^A/i, '');
        map.set(item.shcode, item);
        map.set(cleanCode, item);
        map.set(`A${cleanCode}`, item);
      });
      return map;
    },

    holdingsList: (state) => state.rawStockList.filter(item => item.isHolding),

    watchlistList: (state) => state.rawStockList.filter(item => !item.isHolding),

    totalPurchaseAmount: (state) => {
      return state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + (
          (item.holdingAvgPrice || item.avgPrice || 0) *
          (item.holdingQuantity || item.quantity || 0)
        ), 0);
    },

    totalValuationAmount: (state) => {
      return state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + (
          (item.closePrice || item.holdingAvgPrice || item.avgPrice || 0) *
          (item.holdingQuantity || item.quantity || 0)
        ), 0);
    },

    // ✅ 성능 최적화: Getter 재사용으로 O(n × 4) 중복 순회 제거
    totalEvaluationProfit(): number {
      return this.totalValuationAmount - this.totalPurchaseAmount;
    },

    totalReturnRate(): number {
      const purchase = this.totalPurchaseAmount;
      if (purchase === 0) return 0;
      return Math.round(((this.totalValuationAmount - purchase) / purchase) * 10000) / 100;
    }
  },

  actions: {
    initFromStorage() {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith(RAW_CACHE_PREFIX)
               || k.startsWith('nuxt_updown_screener_')
               || k.startsWith('nuxt4_stock_screener_cache'))) {
          keys.push(k);
        }
      }

      const now = Date.now();
      for (const key of keys) {
        try {
          const val = localStorage.getItem(key);
          if (val) {
            const parsed = JSON.parse(val);
            if (parsed.cachedTimestamp && (now - parsed.cachedTimestamp > EXPIRATION_MS)) {
              localStorage.removeItem(key);
            }
          }
        } catch {}
      }

      const todayKey = getTodayRawKey();
      const validKeys = keys.filter(k => {
        try {
          const val = localStorage.getItem(k);
          if (val) {
            const parsed = JSON.parse(val);
            return parsed.cachedTimestamp && (now - parsed.cachedTimestamp <= EXPIRATION_MS);
          }
        } catch {}
        return false;
      }).sort();

      const targetKey = localStorage.getItem(todayKey) ? todayKey : (validKeys.pop() || todayKey);

      try {
        const cached = localStorage.getItem(targetKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.rawStockList && Array.isArray(parsed.rawStockList) && parsed.rawStockList.length > 0) {
            this.rawStockList = parsed.rawStockList;
            this.marketBasis = parsed.marketBasis || null;
            this.topSectors = parsed.topSectors || [];
            this.bottomSectors = parsed.bottomSectors || [];
            this.lastUpdated = parsed.lastUpdated || '';
            this.cachedTimestamp = parsed.cachedTimestamp || 0;
            this.sourceProvider = parsed.sourceProvider || 'LS증권 Open API';
          }
        }
      } catch (e) {
        console.error('Failed to init from storage:', e);
      }
    },

    saveToStorage() {
      const todayKey = getTodayRawKey();
      safeLocalStorageSet(todayKey, {
        rawStockList: this.rawStockList,
        marketBasis: this.marketBasis,
        topSectors: this.topSectors,
        bottomSectors: this.bottomSectors,
        lastUpdated: this.lastUpdated,
        cachedTimestamp: Date.now(),
        sourceProvider: this.sourceProvider
      });
    },

    async fetchRawStockData(forceRefresh = false) {
      // 1. Storage에서 기존 데이터 빠른 복원 (0ms 초기 UI 표시)
      this.initFromStorage();

      if (!forceRefresh && inFlightFetchPromise) {
        return inFlightFetchPromise;
      }

      this.isLoading = true;
      this.errorMessage = null;

      inFlightFetchPromise = (async () => {
        try {
          const response = await $fetch<ScreenerApiResponse>(`/api/screener?ts=${Date.now()}`, {
            method: 'POST',
            headers: { 'Cache-Control': 'no-cache' }
          });

          if (response && response.success) {
            if (response.newData && response.newData.length > 0) {
              this.rawStockList = [...response.newData];
            }
            if (response.marketBasis) {
              this.marketBasis = response.marketBasis;
            }
            if (response.topSectors) {
              this.topSectors = response.topSectors;
            }
            if (response.bottomSectors) {
              this.bottomSectors = response.bottomSectors;
            }
            if (response.timestamp) {
              this.lastUpdated = response.timestamp;
            }
            if (response.source) {
              this.sourceProvider = response.source;
            }

            this.saveToStorage();

            // ✅ 시세 수집 완료 후 Screener 및 Portfolio 실시간 시세 동기화
            try {
              const screenerStore = useScreenerStore();
              screenerStore.recalculateFromRaw();

              const portfolioStore = usePortfolioStore();
              portfolioStore.syncLivePrices();
            } catch {}
          } else if (response && response.error) {
            this.errorMessage = response.error;
          }
        } catch (err: any) {
          this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 수집 중 오류가 발생했습니다.';
        } finally {
          this.isLoading = false;
          inFlightFetchPromise = null;
        }
      })();

      return inFlightFetchPromise;
    },

    async addStock(stockForm: { shcode: string; name: string; industry: string; type: 'holding' | 'watchlist'; quantity?: number; avgPrice?: number }) {
      const cleanCode = stockForm.shcode.trim().replace(/^A/i, '');

      // ✅ 백업: 롤백을 위한 원본 데이터 저장
      const existingIdx = this.rawStockList.findIndex(s => s.shcode === cleanCode || s.shcode === `A${cleanCode}`);
      const existingItem = existingIdx !== -1 ? this.rawStockList[existingIdx] : null;
      const backup: StockItem | null = existingItem ? { ...existingItem } : null;
      const listBackup = [...this.rawStockList];

      // 1. Pinia Store state 즉시 추가 (낙관적 업데이트)
      const newItem: StockItem = {
        shcode: cleanCode,
        name: stockForm.name.trim(),
        industry: stockForm.industry.trim(),
        type: stockForm.type,
        quantity: Number(stockForm.quantity) || 0,
        avgPrice: Number(stockForm.avgPrice) || 0,
        closePrice: 0,
        isHolding: stockForm.type === 'holding',
        holdingQuantity: stockForm.type === 'holding' ? (Number(stockForm.quantity) || 0) : undefined,
        holdingAvgPrice: stockForm.type === 'holding' ? (Number(stockForm.avgPrice) || 0) : undefined,
        score: 0,
        isFullyMatched: false,
        createdAt: new Date().toISOString()
      };

      if (existingIdx !== -1 && existingItem) {
        this.rawStockList[existingIdx] = { ...existingItem, ...newItem };
      } else {
        this.rawStockList.push(newItem);
      }

      this.saveToStorage();

      // 2. Store action에서 SQLite DB 추가 연동
      try {
        await $fetch('/api/stocks', {
          method: 'POST',
          body: stockForm
        });
      } catch (err: any) {
        // ✅ 롤백: 서버 실패 시 원본 상태로 복구
        console.error('Store addStock DB sync error - Rolling back:', err);

        if (backup && existingIdx !== -1) {
          // 기존 종목 업데이트였던 경우: 원본으로 복구
          this.rawStockList[existingIdx] = backup;
        } else {
          // 신규 종목 추가였던 경우: 전체 리스트 복구
          this.rawStockList = listBackup;
        }

        this.saveToStorage();
        throw err;
      }
    },

    async updateStock(shcode: string, stockForm: { name: string; industry: string; type: 'holding' | 'watchlist'; quantity?: number; avgPrice?: number }) {
      const cleanCode = shcode.trim().replace(/^A/i, '');

      // ✅ 백업: 롤백을 위한 원본 데이터 저장
      const idx = this.rawStockList.findIndex(s => s.shcode === cleanCode || s.shcode === `A${cleanCode}`);
      const targetItem = this.rawStockList[idx];
      if (idx === -1 || !targetItem) {
        throw new Error(`종목을 찾을 수 없습니다: ${cleanCode}`);
      }

      const backup: StockItem = { ...targetItem };

      // 1. Pinia Store state 즉시 수정 (낙관적 업데이트)
      const item = targetItem;
      item.name = stockForm.name.trim();
      item.industry = stockForm.industry.trim();
      item.type = stockForm.type;
      item.quantity = Number(stockForm.quantity) || 0;
      item.avgPrice = Number(stockForm.avgPrice) || 0;
      item.isHolding = stockForm.type === 'holding';
      if (stockForm.type === 'holding') {
        item.holdingQuantity = Number(stockForm.quantity) || 0;
        item.holdingAvgPrice = Number(stockForm.avgPrice) || 0;
      } else {
        item.holdingQuantity = undefined;
        item.holdingAvgPrice = undefined;
      }

      this.saveToStorage();

      // 2. Store action에서 SQLite DB 수정 연동
      try {
        await $fetch(`/api/stocks/${cleanCode}`, {
          method: 'PUT',
          body: stockForm
        });
      } catch (err: any) {
        // ✅ 롤백: 서버 실패 시 원본 상태로 복구
        console.error('Store updateStock DB sync error - Rolling back:', err);
        this.rawStockList[idx] = backup;
        this.saveToStorage();
        throw err;
      }
    },

    async deleteStock(shcode: string) {
      const cleanCode = shcode.trim().replace(/^A/i, '');

      // ✅ 백업: 롤백을 위한 원본 데이터 저장
      const listBackup = [...this.rawStockList];

      // 1. Pinia Store state 즉시 제거 (cleanCode 기준 완전 필터링)
      this.rawStockList = this.rawStockList.filter(s => {
        const itemClean = (s.shcode || '').trim().replace(/^A/i, '');
        return itemClean !== cleanCode;
      });

      // ✅ 2. LocalStorage의 모든 과거/현재 캐시 키에서 삭제 대상 종목 완전 영구 소멸
      try {
        const keysToClean: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(RAW_CACHE_PREFIX) || k.startsWith('nuxt_watchlist_cache_') || k.startsWith('nuxt_updown_screener_') || k.startsWith('nuxt4_stock_screener_cache'))) {
            keysToClean.push(k);
          }
        }

        keysToClean.forEach(key => {
          try {
            const raw = localStorage.getItem(key);
            if (raw) {
              const parsed = JSON.parse(raw);
              let modified = false;
              if (parsed.rawStockList && Array.isArray(parsed.rawStockList)) {
                parsed.rawStockList = parsed.rawStockList.filter((s: any) => (s.shcode || '').trim().replace(/^A/i, '') !== cleanCode);
                modified = true;
              }
              if (parsed.items && Array.isArray(parsed.items)) {
                parsed.items = parsed.items.filter((s: any) => (s.shcode || '').trim().replace(/^A/i, '') !== cleanCode);
                modified = true;
              }
              if (modified) {
                localStorage.setItem(key, JSON.stringify(parsed));
              }
            }
          } catch {}
        });
      } catch {}

      this.saveToStorage();

      // 3. 파생 스토어 (screenerStore 및 watchlistStore) state에서도 즉시 제거
      try {
        const screenerStore = useScreenerStore();
        screenerStore.newData = screenerStore.newData.filter(s => (s.shcode || '').trim().replace(/^A/i, '') !== cleanCode);
        screenerStore.oldData = screenerStore.oldData.filter(s => (s.shcode || '').trim().replace(/^A/i, '') !== cleanCode);

        const watchlistStore = useWatchlistStore();
        watchlistStore.items = watchlistStore.items.filter(it => (it.shcode || '').trim().replace(/^A/i, '') !== cleanCode);
        watchlistStore.saveToStorage();
      } catch {}

      // 4. Store action에서 SQLite DB 삭제 연동
      try {
        await $fetch(`/api/stocks/${cleanCode}`, {
          method: 'DELETE'
        });
      } catch (err: any) {
        // ✅ 롤백: 서버 실패 시 원본 상태로 복구
        console.error('Store deleteStock DB sync error - Rolling back:', err);
        this.rawStockList = listBackup;
        this.saveToStorage();
        throw err;
      }
    }
  }
});
