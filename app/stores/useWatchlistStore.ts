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
}

export const useWatchlistStore = defineStore('watchlist', {
  state: () => ({
    items: [] as WatchItem[],
    isLoading: false,
    errorMessage: null as string | null,
  }),
  actions: {
    /** 초기 로드 – SQLite DB (stocks 테이블) 기반 */
    async loadInitial() {
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
          
          // 실시간 시세 및 8대 지표 자동으로 갱신
          await this.refresh();
        }
      } catch (err: any) {
        console.error('watchlist loadInitial error:', err);
        this.errorMessage = err.message || 'Watchlist 초기 로드 실패';
      } finally {
        this.isLoading = false;
      }
    },
    /** 실시간 시세 및 LS증권 8대 지표 (심리선, 거래량수급 등) 갱신 */
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
              // 새로 스크리너에서 감지된 종목이 있을 경우 추가
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
        }
      } catch (err: any) {
        console.error('watchlist refresh error:', err);
        this.errorMessage = err.message || 'LS증권 실시간 시세 및 8대 지표 갱신 실패';
      } finally {
        this.isLoading = false;
      }
    },
  },
});
