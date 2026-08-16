import { defineStore } from 'pinia';
import type { HoldingItem } from '../../utils/types/lsSecurities';
import { useLSStockRawStore } from './useLSStockRawStore';
import { useScreenerStore } from './useScreenerStore';
import { getLivePrice, arrayToMap, arrayToIndexMap, sanitizeShcode } from '../../utils/stockUtils';

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
      const rawStore = useLSStockRawStore();
      const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList;
      return list.reduce((sum, item) => {
        const price = Number(item.avgPrice ?? item.holdingAvgPrice) || 0;
        const qty = Number(item.quantity ?? item.holdingQuantity) || 0;
        return sum + (price * qty);
      }, 0);
    },

    totalValuationAmount: (state) => {
      const rawStore = useLSStockRawStore();
      const screenerStore = useScreenerStore();
      const list = state.holdings.length > 0 ? state.holdings : rawStore.holdingsList;

      // ✅ 성능 최적화: Map으로 O(1) 조회
      const screenerMap = arrayToMap(screenerStore.newData);

      return list.reduce((sum, item) => {
        const cleanCode = sanitizeShcode(item.shcode);
        const rawStock = rawStore.rawStockMap.get(cleanCode);
        const screenerStock = screenerMap.get(cleanCode);

        // ✅ 유틸 함수 사용: 4단계 Fallback을 1줄로
        const livePrice = getLivePrice(item, rawStock, screenerStock);
        const qty = Number(item.quantity ?? item.holdingQuantity) || 0;
        return sum + (livePrice * qty);
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
        const rawStore = useLSStockRawStore();
        const screenerStore = useScreenerStore();

        if (!rawStore.hasRawData) {
          await screenerStore.loadInitial(false);
        }

        const data = await $fetch<HoldingItem[]>(`/api/holdings?ts=${Date.now()}`);

        if (data && Array.isArray(data) && data.length > 0) {
          // ✅ 성능 최적화: Map으로 O(1) 조회
          const screenerMap = arrayToMap(screenerStore.newData);

          this.holdings = data.map(h => {
            const rawStock = rawStore.rawStockMap.get(h.shcode);
            const screenerStock = screenerMap.get(h.shcode);

            // ✅ 유틸 함수 사용
            const livePrice = getLivePrice(h, rawStock, screenerStock);

            return {
              ...h,
              quantity: Number(h.quantity) || 0,
              avgPrice: Number(h.avgPrice) || 0,
              currentPrice: Number(livePrice) > 0 ? Number(livePrice) : (Number(h.avgPrice) || 0)
            };
          });
        } else if (rawStore.holdingsList && rawStore.holdingsList.length > 0) {
          this.holdings = rawStore.holdingsList.map(h => ({
            shcode: h.shcode,
            name: h.name,
            industry: h.industry || '주요보유',
            quantity: h.holdingQuantity ?? h.quantity ?? 0,
            avgPrice: h.holdingAvgPrice ?? h.avgPrice ?? 0,
            currentPrice: h.closePrice || h.holdingAvgPrice || h.avgPrice || 0,
            targetPrice: h.targetPrice || 0,
            stopLossPrice: h.stopLossPrice || 0,
            trailingRate: 2.5,
            updatedAt: rawStore.lastUpdated || new Date().toLocaleString('ko-KR')
          }));
        }
      } catch (err: any) {
        console.error('Fetch holdings error:', err);
        this.errorMessage = err.statusMessage || err.message || '보유 종목 데이터를 불러오는 데 실패했습니다.';
      } finally {
        this.isLoading = false;
      }
    },

    async refreshPrices() {
      this.isLoading = true;
      this.errorMessage = null;

      try {
        const data = await $fetch<any>('/api/holdings/price');
        if (data && Array.isArray(data)) {
          // ✅ 성능 최적화: Map으로 O(n²) → O(n)
          const holdingsMap = arrayToIndexMap(this.holdings);

          data.forEach((p: any) => {
            const idx = holdingsMap.get(p.shcode);
            if (idx !== undefined && this.holdings[idx]) {
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
