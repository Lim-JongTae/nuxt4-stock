import { defineStore } from 'pinia';
import type { 
  StockItem, 
  ScreenerApiResponse, 
  MarketBasisInfo, 
  TopSectorInfo 
} from '../../utils/types/lsSecurities';

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
    sourceProvider: 'LS증권 Open API (openapi.ls-sec.co.kr)',
    isLoading: false,
    errorMessage: null as string | null
  }),

  getters: {
    hasRawData: (state) => state.rawStockList.length > 0,
    rawStockMap: (state) => {
      const map = new Map<string, StockItem>();
      state.rawStockList.forEach(item => map.set(item.shcode, item));
      return map;
    },
    holdingsList: (state) => state.rawStockList.filter(item => item.isHolding),
    watchlistList: (state) => state.rawStockList.filter(item => !item.isHolding),
    totalPurchaseAmount: (state) => {
      return state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + ((item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
    },
    totalValuationAmount: (state) => {
      return state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + ((item.closePrice || item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
    },
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
      const purchase = state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + ((item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
      if (purchase === 0) return 0;
      const val = state.rawStockList
        .filter(item => item.isHolding)
        .reduce((sum, item) => sum + ((item.closePrice || item.holdingAvgPrice || item.avgPrice || 0) * (item.holdingQuantity || item.quantity || 0)), 0);
      return Math.round(((val - purchase) / purchase) * 10000) / 100;
    }
  },

  actions: {
    initFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith(RAW_CACHE_PREFIX) || k.startsWith('nuxt_updown_screener_') || k.startsWith('nuxt4_stock_screener_cache'))) {
            keys.push(k);
          }
        }

        const now = Date.now();
        const validKeys: string[] = [];
        for (const key of keys) {
          const val = localStorage.getItem(key);
          if (val) {
            try {
              const parsed = JSON.parse(val);
              if (parsed.cachedTimestamp && (now - parsed.cachedTimestamp > EXPIRATION_MS)) {
                localStorage.removeItem(key);
              } else {
                validKeys.push(key);
              }
            } catch (e) {
              localStorage.removeItem(key);
            }
          }
        }

        const todayKey = getTodayRawKey();
        const targetKey = localStorage.getItem(todayKey) ? todayKey : (validKeys.sort().pop() || todayKey);
        const saved = localStorage.getItem(targetKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          const stockList = parsed.rawStockList || parsed.newData;
          if (stockList && Array.isArray(stockList)) {
            this.rawStockList = stockList;
          }
          if (parsed.marketBasis) {
            this.marketBasis = parsed.marketBasis;
          }
          if (parsed.topSectors && Array.isArray(parsed.topSectors)) {
            this.topSectors = parsed.topSectors;
          }
          if (parsed.bottomSectors && Array.isArray(parsed.bottomSectors)) {
            this.bottomSectors = parsed.bottomSectors;
          }
          this.lastUpdated = parsed.lastUpdated || '';
          this.cachedTimestamp = parsed.cachedTimestamp || 0;
          this.sourceProvider = parsed.sourceProvider || this.sourceProvider;
        }
      } catch (e) {
        console.error('Failed to load raw stock cache from storage:', e);
      }
    },

    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        this.cachedTimestamp = Date.now();
        const todayKey = getTodayRawKey();
        localStorage.setItem(todayKey, JSON.stringify({
          rawStockList: this.rawStockList,
          marketBasis: this.marketBasis,
          topSectors: this.topSectors,
          bottomSectors: this.bottomSectors,
          lastUpdated: this.lastUpdated,
          cachedTimestamp: this.cachedTimestamp,
          sourceProvider: this.sourceProvider
        }));
      } catch (e) {
        console.error('Failed to save raw stock cache to storage:', e);
      }
    },

    async fetchRawStockData(forceRefresh = false) {
      this.initFromStorage();

      // LocalStorage 캐시가 존재하고 forceRefresh가 false이면 무조건 0ms 즉시 반환 (불필요한 로딩 전면 스킵)
      if (!forceRefresh && this.rawStockList && this.rawStockList.length > 0) {
        return;
      }

      if (inFlightFetchPromise) {
        return inFlightFetchPromise;
      }

      this.isLoading = true;
      this.errorMessage = null;

      inFlightFetchPromise = (async () => {
        try {
          const response = await $fetch<ScreenerApiResponse>('/api/screener', { method: 'POST' });

          if (response && response.success) {
            if (response.newData && response.newData.length > 0) {
              this.rawStockList = response.newData;
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
            this.lastUpdated = response.timestamp || new Date().toLocaleString('ko-KR');
            this.sourceProvider = response.source || this.sourceProvider;
            if (response.error) {
              this.errorMessage = response.error;
            }

            this.saveToStorage();
          }
        } catch (err: any) {
          console.error('LS Raw Stock fetch error:', err);
          this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 수집 중 오류가 발생했습니다.';
        } finally {
          this.isLoading = false;
          inFlightFetchPromise = null;
        }
      })();

      return inFlightFetchPromise;
    },

    async addStock(stockForm: { shcode: string; name: string; industry?: string; type: 'holding' | 'watchlist'; avgPrice?: number; quantity?: number }) {
      const cleanCode = stockForm.shcode.trim().replace(/^A/i, '');
      const isHolding = stockForm.type === 'holding';

      // 1. Pinia Store state 즉시 변경 (0ms UI 반영)
      const existingIdx = this.rawStockList.findIndex(s => s.shcode === cleanCode || s.shcode === `A${cleanCode}`);
      const newItem: StockItem = {
        shcode: cleanCode,
        name: stockForm.name.trim(),
        industry: stockForm.industry || '주요업종',
        isHolding,
        type: stockForm.type,
        holdingAvgPrice: Number(stockForm.avgPrice) || 0,
        holdingQuantity: Number(stockForm.quantity) || 0,
        avgPrice: Number(stockForm.avgPrice) || 0,
        quantity: Number(stockForm.quantity) || 0,
        closePrice: Number(stockForm.avgPrice) || 0,
        score: 0,
        isFullyMatched: false
      };

      if (existingIdx !== -1) {
        this.rawStockList[existingIdx] = { ...this.rawStockList[existingIdx], ...newItem };
      } else {
        this.rawStockList.push(newItem);
      }

      this.saveToStorage();

      // 2. Store action에서 SQLite DB 수정 연동
      try {
        await $fetch('/api/stocks', {
          method: 'POST',
          body: stockForm
        });
      } catch (err: any) {
        console.error('Store addStock DB sync error:', err);
        throw err;
      }
    },

    async updateStock(shcode: string, stockForm: { shcode: string; name: string; industry?: string; type: 'holding' | 'watchlist'; avgPrice?: number; quantity?: number }) {
      const cleanCode = shcode.trim().replace(/^A/i, '');
      const isHolding = stockForm.type === 'holding';

      // 1. Pinia Store state 즉시 수정
      const idx = this.rawStockList.findIndex(s => s.shcode === cleanCode || s.shcode === `A${cleanCode}`);
      if (idx !== -1) {
        const item = this.rawStockList[idx]!;
        item.name = stockForm.name.trim();
        if (stockForm.industry) item.industry = stockForm.industry;
        item.isHolding = isHolding;
        item.type = stockForm.type;
        item.holdingAvgPrice = Number(stockForm.avgPrice) || 0;
        item.holdingQuantity = Number(stockForm.quantity) || 0;
        item.avgPrice = Number(stockForm.avgPrice) || 0;
        item.quantity = Number(stockForm.quantity) || 0;
      }

      this.saveToStorage();

      // 2. Store action에서 SQLite DB 수정 연동
      try {
        await $fetch(`/api/stocks/${cleanCode}`, {
          method: 'PUT',
          body: stockForm
        });
      } catch (err: any) {
        console.error('Store updateStock DB sync error:', err);
        throw err;
      }
    },

    async deleteStock(shcode: string) {
      const cleanCode = shcode.trim().replace(/^A/i, '');

      // 1. Pinia Store state 즉시 제거
      this.rawStockList = this.rawStockList.filter(s => s.shcode !== cleanCode && s.shcode !== `A${cleanCode}`);
      this.saveToStorage();

      // 2. Store action에서 SQLite DB 삭제 연동
      try {
        await $fetch(`/api/stocks/${cleanCode}`, {
          method: 'DELETE'
        });
      } catch (err: any) {
        console.error('Store deleteStock DB sync error:', err);
        throw err;
      }
    }
  }
});
