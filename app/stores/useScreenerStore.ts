import { defineStore } from 'pinia';
import type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo } from '../../utils/types/lsSecurities';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';
import { useLSStockRawStore } from './useLSStockRawStore';
import { usePortfolioStore } from './usePortfolioStore';
import { isEtfOrEtn } from '../../utils/stockUtils';

export type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo };

export const useScreenerStore = defineStore('screener', {
  state: () => ({
    oldData: [] as StockItem[],
    newData: [] as StockItem[],
    aiMarketAnalysis: null as AiMarketAnalysisInfo | null,
    isRefreshing: false,
    isAiAnalyzing: false,
    errorMessage: null as string | null
  }),

  getters: {
    // 단일 진실 출처 (SSOT): 중앙 원천 스토어의 수집 시각 및 데이터 참조
    lastUpdated: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.lastUpdated || '';
    },
    oldRecordTime: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.lastUpdated ? `${rawStore.lastUpdated} (이전 수집분)` : '이전 수집 데이터';
    },
    sourceProvider: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.sourceProvider || 'LS증권 Open API';
    },
    marketBasis: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.marketBasis;
    },
    topSectors: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.topSectors;
    },
    bottomSectors: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.bottomSectors;
    },

    holdingShcodesSet: () => {
      const portfolioStore = usePortfolioStore();
      return new Set(portfolioStore.holdings.map(h => h.shcode));
    },

    has85PlusMatched: (state) => {
      const screenerStore = useScreenerStore();
      const holdingShcodes = screenerStore.holdingShcodesSet;

      return state.newData.some(item =>
        !item.isHolding &&
        item.type !== 'holding' &&
        !holdingShcodes.has(item.shcode) &&
        item.isFullyMatched
      );
    },

    matchedCount: (state) => {
      const screenerStore = useScreenerStore();
      const holdingShcodes = screenerStore.holdingShcodesSet;

      return state.newData.filter(item =>
        !item.isHolding &&
        item.type !== 'holding' &&
        !holdingShcodes.has(item.shcode) &&
        item.isFullyMatched
      ).length;
    },

    topBuyRecommendations: (state) => {
      const screenerStore = useScreenerStore();
      const holdingShcodes = screenerStore.holdingShcodesSet;

      const watchlistOnly = state.newData.filter(item =>
        !item.isHolding &&
        item.type !== 'holding' &&
        !holdingShcodes.has(item.shcode)
      );

      return [...watchlistOnly].sort((a, b) => b.score - a.score).slice(0, 3);
    },

    portfolioSummary: (state) => {
      const rawStore = useLSStockRawStore();
      return {
        totalPurchase: rawStore.totalPurchaseAmount || 0,
        totalValuation: rawStore.totalValuationAmount || 0,
        totalProfit: rawStore.totalEvaluationProfit || 0,
        totalRate: rawStore.totalReturnRate || 0
      };
    }
  },

  actions: {
    async initFromStorage(forceRefresh = false) {
      await this.loadInitial(forceRefresh);
    },

    async loadInitial(forceRefresh = false) {
      this.isRefreshing = true;
      try {
        const rawStore = useLSStockRawStore();

        if (!rawStore.hasRawData || forceRefresh) {
          await rawStore.fetchRawStockData(forceRefresh);
        }

        if (rawStore.hasRawData) {
          this.recalculateFromRaw();
        }
      } finally {
        this.isRefreshing = false;
      }
    },

    async refreshScreener(forceRefresh = true) {
      await this.loadInitial(forceRefresh);
    },

    recalculateFromRaw() {
      const rawStore = useLSStockRawStore();

      console.log('🔄 [useScreenerStore] recalculateFromRaw 호출:', {
        rawStockListCount: rawStore.rawStockList?.length || 0,
        sample: JSON.parse(JSON.stringify(rawStore.rawStockList?.[0] || {}))
      });

      if (!rawStore.rawStockList || rawStore.rawStockList.length === 0) {
        this.newData = [];
        console.warn('⚠️ rawStockList가 비어있음');
        return;
      }

      const calculatedItems = rawStore.rawStockList.map(item => {
        // ✅ 유틸 함수 사용: ETF 판별
        const isEtf = isEtfOrEtn(item.name, item.industry);

        const quantResult = calculateQuantIndicators({
          shcode: item.shcode,
          name: item.name,
          industry: item.industry,
          isHolding: item.isHolding,
          holdingQuantity: item.holdingQuantity,
          holdingAvgPrice: item.holdingAvgPrice,
          closePrice: item.closePrice,
          previousClosePrice: item.previousClosePrice,
          psy: item.psy,
          bbLower: item.bbLower,
          ma5: item.ma5,
          ma20: item.ma20,
          ma60: item.ma60,
          volumeRatio: item.volumeRatio,
          macdHist: item.macdHist,
          rsi: item.rsi,
          bullishDivergence: item.bullishDivergence,
          shortSellHistory: item.shortSellHistory || [],
          dataSource: item.dataSource,
          errorMessage: item.errorMessage || null
        });

        const shortSellingStatus = isEtf
          ? 'ETF/ETN (공매도 t1927 제외 종목)'
          : quantResult.shortSignal.label;

        return {
          ...item,
          shortSellingStatus,
          score: quantResult.score,
          isFullyMatched: quantResult.isFullyMatched,
          conditions: quantResult.conditions
        };
      });

      console.log('✅ [useScreenerStore] newData 업데이트:', {
        count: calculatedItems.length,
        sample: JSON.parse(JSON.stringify(calculatedItems[0] || {}))
      });

      this.newData = calculatedItems;

      if (!this.oldData || this.oldData.length === 0) {
        this.oldData = [...calculatedItems];
      }
    },

    async runAiMarketDiagnosis() {
      if (this.isAiAnalyzing) return;
      this.isAiAnalyzing = true;
      try {
        const rawStore = useLSStockRawStore();
        const res = await $fetch<{ success: boolean; result: AiMarketAnalysisInfo }>('/api/ai/market-diagnosis', {
          method: 'POST',
          body: {
            topSectors: rawStore.topSectors,
            matchedStocks: this.newData.filter(s => s.isFullyMatched),
            marketBasis: rawStore.marketBasis
          }
        });
        if (res && res.success && res.result) {
          this.aiMarketAnalysis = res.result;
        }
      } catch (err: any) {
        console.error('AI market diagnosis error:', err);
      } finally {
        this.isAiAnalyzing = false;
      }
    }
  }
});
