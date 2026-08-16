import { defineStore } from 'pinia';
import { useLSStockRawStore } from './useLSStockRawStore';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';

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
      if (typeof window === 'undefined') return;
      try {
        const now = Date.now();
        const validDailyKeys: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(WATCHLIST_KEY_PREFIX) || key.startsWith('nuxt4_watchlist_cache'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.cachedTimestamp && now - parsed.cachedTimestamp > EXPIRATION_MS) {
                  localStorage.removeItem(key);
                } else if (key.startsWith(WATCHLIST_KEY_PREFIX)) {
                  validDailyKeys.push(key);
                }
              } catch (e) {
                localStorage.removeItem(key);
              }
            }
          }
        }

        const todayKey = getTodayWatchlistKey();
        const targetKey = localStorage.getItem(todayKey) ? todayKey : (validDailyKeys.sort().pop() || todayKey);
        const saved = localStorage.getItem(targetKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            this.items = parsed;
          }
        }
      } catch (e) {
        console.error('Failed to load watchlist cache from storage:', e);
      }
    },

    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        const todayKey = getTodayWatchlistKey();
        const payload = JSON.stringify(
          this.items.map(item => ({
            ...item,
            cachedTimestamp: Date.now()
          }))
        );
        localStorage.setItem(todayKey, payload);
      } catch (e) {
        console.error('Failed to save watchlist cache to storage:', e);
      }
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
      this.errorMessage = null;
      try {
        const rawStore = useLSStockRawStore();
        await rawStore.fetchRawStockData(true);

        if (rawStore.rawStockList && rawStore.rawStockList.length > 0) {
          const etfKeywords = ['KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'];

          rawStore.rawStockList.forEach(sc => {
            const isEtf = (sc.industry || '').includes('ETF') || (sc.industry || '').includes('ETN') || etfKeywords.some(k => (sc.name || '').includes(k));
            const quantResult = calculateQuantIndicators({
              shcode: sc.shcode,
              name: sc.name,
              industry: sc.industry,
              isHolding: !!sc.isHolding,
              holdingQuantity: sc.holdingQuantity ?? sc.quantity,
              holdingAvgPrice: sc.holdingAvgPrice ?? sc.avgPrice,
              closePrice: sc.closePrice,
              psy: sc.psy ?? null,
              bbLower: sc.bbLower ?? null,
              ma5: sc.ma5 ?? null,
              ma20: sc.ma20 ?? null,
              ma60: sc.ma60 ?? null,
              volumeRatio: sc.volumeRatio ?? null,
              macdHist: sc.macdHist ?? null,
              rsi: sc.rsi ?? null,
              bullishDivergence: sc.bullishDivergence ?? null,
              shortSellHistory: sc.shortSellHistory || [],
              dataSource: sc.dataSource || 'LS증권 Open API'
            });

            const shortSellingStatus = isEtf ? 'ETF/ETN (공매도 t1927 제외 종목)' : (quantResult.shortSignal.label || sc.shortSellingStatus || '판단 보류');
            const score = quantResult.score;

            const idx = this.items.findIndex(it => it.shcode === sc.shcode);
            if (idx !== -1) {
              const it = this.items[idx]!;
              it.currentPrice = sc.closePrice || it.currentPrice;
              it.psy = sc.psy ?? it.psy;
              it.volumeRatio = sc.volumeRatio ?? it.volumeRatio;
              it.shortSellingStatus = shortSellingStatus;
              it.score = score;
              it.updatedAt = rawStore.lastUpdated;
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
    }
  }
});
