import { defineStore } from 'pinia';

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

const WATCHLIST_KEY_PREFIX = 'nuxt4_watchlist_cache_';
const EXPIRATION_MS = 15 * 24 * 60 * 60 * 1000; // 15일 보존 정책

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
    // 1. LocalStorage에서 관심종목 시세 캐시 로드 (15일 보존)
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
                  localStorage.removeItem(key); // 15일 초과 시 자동 삭제
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

    // 2. LocalStorage에 당일 관심종목 캐시 저장
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

    // 3. 초기 로드 (forceRefresh가 false이고 스토어/캐시 데이터가 있으면 API 통신 0회, 0ms 즉시 반환!)
    async loadInitial(forceRefresh = false) {
      if (!this.isInitialized) {
        this.initFromStorage();
        this.isInitialized = true;
      }

      // 평상시 페이지 이동 시: forceRefresh=false이고 기존 스토어/캐시 데이터가 있으면 API 호출 금지!
      if (!forceRefresh && this.items.length > 0) {
        return;
      }

      this.isLoading = true;
      this.errorMessage = null;

      try {
        const res = await $fetch<any>('/api/stocks?ts=' + Date.now());
        if (res && res.success && res.data && Array.isArray(res.data.all)) {
          this.items = res.data.all.map((item: any) => ({
            shcode: item.shcode,
            name: item.name,
            industry: item.industry || '주요업종',
            type: item.type,
            quantity: item.type === 'holding' ? item.quantity : undefined,
            avgPrice: item.type === 'holding' ? item.avgPrice : undefined,
            currentPrice: 0,
            psy: null,
            volumeRatio: null,
            shortSellingStatus: '',
            score: 0,
            targetPrice: undefined,
            stopLossPrice: undefined,
            updatedAt: item.updatedAt || '',
          }));
          
          // 실시간 시세 및 8대 지표 갱신 후 LocalStorage 저장
          await this.refresh();
        }
      } catch (err: any) {
        console.error('watchlist loadInitial error:', err);
        this.errorMessage = err.message || 'Watchlist 초기 로드 실패';
      } finally {
        this.isLoading = false;
      }
    },

    // 4. 실시간 시세 및 8대 지표 갱신
    async refresh() {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        const response = await $fetch<any>('/api/screener', { method: 'POST' });
        if (response && response.success && Array.isArray(response.newData)) {
          response.newData.forEach((sc: any) => {
            const idx = this.items.findIndex(it => it.shcode === sc.shcode);
            if (idx !== -1) {
              const it = this.items[idx]!;
              it.currentPrice = sc.closePrice || it.currentPrice;
              it.psy = sc.psy ?? it.psy;
              it.volumeRatio = sc.volumeRatio ?? it.volumeRatio;
              it.shortSellingStatus = sc.shortSellingStatus || it.shortSellingStatus;
              it.score = sc.score ?? it.score;
              it.updatedAt = sc.createdAt || new Date().toLocaleString('ko-KR');
            } else {
              this.items.push({
                shcode: sc.shcode,
                name: sc.name,
                industry: sc.industry || '주요업종',
                currentPrice: sc.closePrice || 0,
                psy: sc.psy,
                volumeRatio: sc.volumeRatio,
                shortSellingStatus: sc.shortSellingStatus,
                score: sc.score,
                updatedAt: sc.createdAt || new Date().toLocaleString('ko-KR')
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
