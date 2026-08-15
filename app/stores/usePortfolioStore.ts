import { defineStore } from 'pinia';

export interface HoldingItem {
  id?: number;
  shcode: string;
  name: string;
  industry: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  trailingRate?: number;
  updatedAt: string;
  candles?: Array<{
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

export const usePortfolioStore = defineStore('portfolio', {
  state: () => ({
    holdings: [] as HoldingItem[],
    isLoading: false,
    selectedStockForAi: null as string | null,
    aiAnalysisResult: '',
    isAiAnalyzing: false,
    errorMessage: null as string | null
  }),

  getters: {
    totalPurchaseAmount: (state) => {
      return state.holdings.reduce((sum, item) => sum + ((Number(item.avgPrice) || 0) * (Number(item.quantity) || 0)), 0);
    },
    totalValuationAmount: (state) => {
      return state.holdings.reduce((sum, item) => {
        const price = (Number(item.currentPrice) > 0 ? Number(item.currentPrice) : Number(item.avgPrice)) || 0;
        const qty = Number(item.quantity) || 0;
        return sum + (price * qty);
      }, 0);
    },
    totalPnlAmount(): number {
      return this.totalValuationAmount - this.totalPurchaseAmount;
    },
    totalPnlRate(): number {
      if (this.totalPurchaseAmount === 0) return 0;
      return Math.round((this.totalPnlAmount / this.totalPurchaseAmount) * 10000) / 100;
    },
    // Alias getters for DashboardView compatibility
    totalInvested(): number {
      return this.totalPurchaseAmount;
    },
    totalEvaluated(): number {
      return this.totalValuationAmount;
    },
    totalProfitLoss(): number {
      return this.totalPnlAmount;
    },
    totalProfitRate(): number {
      return this.totalPnlRate;
    }
  },

  actions: {
    async fetchHoldings(forceRefresh = false) {
      if (!forceRefresh && this.holdings.length > 0) return;
      this.isLoading = true;
      this.errorMessage = null;
      try {
        const data = await $fetch<HoldingItem[]>(`/api/holdings?ts=${Date.now()}`);
        if (data && Array.isArray(data)) {
          this.holdings = data.map(h => ({
            ...h,
            quantity: Number(h.quantity) || 0,
            avgPrice: Number(h.avgPrice) || 0,
            currentPrice: Number(h.currentPrice) > 0 ? Number(h.currentPrice) : (Number(h.avgPrice) || 0)
          }));
        }
      } catch (err: any) {
        console.error('Fetch holdings error:', err);
        this.errorMessage = err.statusMessage || err.message || '보유 종목 데이터를 불러오는 데 실패했습니다.';
      } finally {
        this.isLoading = false;
      }
    },
    // 실시간 시세와 목표·손절가를 LS증권 API 로 갱신
    async refreshPrices() {
      this.isLoading = true;
      this.errorMessage = null;
      try {
        const data = await $fetch<any>('/api/holdings/price');
        if (data && Array.isArray(data)) {
          data.forEach((p: any) => {
            const idx = this.holdings.findIndex(h => h.shcode === p.shcode);
            if (idx !== -1 && this.holdings[idx]) {
              const h = this.holdings[idx];
              h.currentPrice = Number(p.currentPrice) || h.currentPrice || h.avgPrice;
              h.targetPrice = Number(p.targetPrice) || h.targetPrice;
              h.stopLossPrice = Number(p.stopLossPrice) || h.stopLossPrice;
              h.trailingRate = p.trailingRate;
              h.updatedAt = p.updatedAt;
            }
          });
        }
      } catch (err: any) {
        console.error('Refresh prices error:', err);
        this.errorMessage = err.statusMessage || err.message || '실시간 시세 갱신에 실패했습니다.';
      } finally {
        this.isLoading = false;
      }
    },

    async runAiDiagnosis(stockName: string) {
      this.selectedStockForAi = stockName;
      this.isAiAnalyzing = true;
      this.aiAnalysisResult = '';
      this.errorMessage = null;

      try {
        const res = await $fetch<{ success: boolean; result: string }>('/api/ai/analyze', {
          method: 'POST',
          body: { prompt: `${stockName} 보유 종목의 손익률 및 시세 수급 기반 AI 대응 전략을 제시해 주세요.` }
        });
        if (res && res.result) {
          this.aiAnalysisResult = res.result;
        }
      } catch (err: any) {
        console.error('AI diagnosis error:', err);
        this.errorMessage = err.statusMessage || err.message || 'AI 진단 중 오류가 발생했습니다.';
      } finally {
        this.isAiAnalyzing = false;
      }
    }
  }
});
