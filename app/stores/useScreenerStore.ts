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
  shortSellingStatus?: string;
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
    sourceProvider: 'LS증권 Open API (openapi.ls-sec.co.kr)',
    errorMessage: null as string | null
  }),

  getters: {
    has85PlusMatched: (state) => {
      if (!state.newData || state.newData.length === 0) return false;
      return state.newData.some(item => item.score >= 85 || item.isFullyMatched);
    },
    matchedCount: (state) => state.newData.filter(item => item.isFullyMatched || item.score >= 85).length,
    topBuyRecommendations: (state) => {
      if (!state.newData || state.newData.length === 0) return [];
      // 85점 이상 유무 상관없이 최고 점수 순 상위 3개 나열
      return [...state.newData].sort((a, b) => b.score - a.score).slice(0, 3);
    },
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
      this.errorMessage = null;
      try {
        const response = await $fetch<{
          success: boolean;
          timestamp: string;
          source: string;
          error?: string | null;
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
          if (response.error) {
            this.errorMessage = response.error;
          }
        }
      } catch (err: any) {
        console.error('Screener refresh error:', err);
        this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 스크리닝 데이터 호출 중 오류가 발생했습니다.';
      } finally {
        this.isRefreshing = false;
      }
    }
  }
});
