import { defineStore } from 'pinia';

export interface WatchItem {
  shcode: string;
  name: string;
  industry: string;  
  quantity?: number; // 보유 종목인 경우
  avgPrice?: number;  // 실시간 가격 및 동적 가격
  currentPrice: number;
  targetPrice?: number;
  stopLossPrice?: number;
  trailingRate?: number;
  updatedAt: string;
}

export const useWatchlistStore = defineStore('watchlist', {
  state: () => ({
    items: [] as WatchItem[],
    isLoading: false,
    errorMessage: null as string | null,
  }),
  actions: {
    /** 초기 로드 – DB(보유) + watchlist.json(관심 종목) */
    async loadInitial() {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        // 1️⃣ 보유 종목 (holdings) 가져오기
        const holdings = await $fetch<WatchItem[]>('/api/holdings?ts=' + Date.now());
        // 2️⃣ 관심 종목 리스트 (public/watchlist.json) 로드
        const watchlistJson = await $fetch<any>('/watchlist.json');
        const interest = Array.isArray(watchlistJson) ? watchlistJson : [];
        const interestItems: WatchItem[] = interest.map((i: any) => ({
          shcode: i.shcode,
          name: i.name,
          industry: i.industry,
          quantity: undefined,
          avgPrice: undefined,
          currentPrice: 0,
          targetPrice: undefined,
          stopLossPrice: undefined,
          trailingRate: undefined,
          updatedAt: '',
        }));
        this.items = [...holdings, ...interestItems];
      } catch (err: any) {
        console.error('watchlist loadInitial error:', err);
        this.errorMessage = err.message || 'Watchlist 초기 로드 실패';
      } finally {
        this.isLoading = false;
      }
    },
    /** 실시간 시세 갱신 */
    async refresh() {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        const data = await $fetch<any>('/api/watchlist/price');
        let itemsToUpdate: any[] = [];
        if (Array.isArray(data)) {
          itemsToUpdate = data;
        } else if (data && (Array.isArray(data.holdings) || Array.isArray(data.watchlist))) {
          itemsToUpdate = [...(data.holdings || []), ...(data.watchlist || [])];
        }
        itemsToUpdate.forEach((p: any) => {
          const idx = this.items.findIndex((it) => it.shcode === p.shcode);
          if (idx !== -1) {
            const it = this.items[idx]!;
            it.currentPrice = p.currentPrice ?? it.currentPrice;
            it.targetPrice = p.targetPrice ?? it.targetPrice;
            it.stopLossPrice = p.stopLossPrice ?? it.stopLossPrice;
            it.trailingRate = p.trailingRate ?? it.trailingRate;
            it.updatedAt = p.updatedAt ?? it.updatedAt;
          }
        });
      } catch (err: any) {
        console.error('watchlist refresh error:', err);
        this.errorMessage = err.message || '실시간 시세 갱신 실패';
      } finally {
        this.isLoading = false;
      }
    },
  },
});
