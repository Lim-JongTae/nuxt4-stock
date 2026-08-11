import { defineStore } from 'pinia';

export interface StockItem {
  id?: number;
  batchId?: string;
  shcode: string;
  name: string;
  industry: string;
  closePrice: number;
  psy: number;
  bbLower: number;
  ma5: number;
  ma20: number;
  ma60: number;
  volumeRatio: number;
  macdHist: number;
  rsi: number;
  bullishDivergence: boolean;
  score: number; // 0~100 퀀트 점수
  isFullyMatched: boolean;
  createdAt: string;
}

export const useScreenerStore = defineStore('screener', {
  state: () => ({
    oldData: [] as StockItem[],
    newData: [] as StockItem[],
    isRefreshing: false,
    lastUpdated: '',
    sourceProvider: 'LS증권 Open API (openapi.ls-sec.co.kr)'
  }),

  getters: {
    matchedCount: (state) => state.newData.filter(item => item.isFullyMatched).length,
    topBuyRecommendations: (state) => state.newData.filter(item => item.score >= 85 || item.isFullyMatched).slice(0, 3),
    oldRecordTime: (state) => {
      if (state.oldData && state.oldData.length > 0 && state.oldData[0]?.createdAt) {
        return state.oldData[0].createdAt;
      }
      return '이전 분석 기록 없음';
    }
  },

  actions: {
    async refreshScreener() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      try {
        const response = await $fetch<{
          success: boolean;
          timestamp: string;
          source: string;
          oldData: StockItem[];
          newData: StockItem[];
        }>('/api/screener', { method: 'POST' });

        if (response && response.success) {
          if (response.newData && response.newData.length > 0) {
            this.newData = response.newData;
          }
          if (response.oldData && response.oldData.length > 0) {
            this.oldData = response.oldData;
          }
          this.lastUpdated = response.timestamp || new Date().toLocaleString('ko-KR');
          this.sourceProvider = response.source || this.sourceProvider;
        }
      } catch (err) {
        console.error('Screener refresh warning:', err);
      } finally {
        this.isRefreshing = false;
      }
    }
  }
});
