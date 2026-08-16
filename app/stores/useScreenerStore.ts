import { defineStore } from 'pinia';
import type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo } from '../../utils/types/lsSecurities';
import { calculateQuantIndicators } from '../composables/useQuantIndicatorCalculator';
import { useLSStockRawStore } from './useLSStockRawStore';
import { usePortfolioStore } from './usePortfolioStore';

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
    sourceProvider: () => {
      const rawStore = useLSStockRawStore();
      return rawStore.sourceProvider || 'LS증권 Open API (openapi.ls-sec.co.kr)';
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
    isRefreshing: (state) => {
      const rawStore = useLSStockRawStore();
      return state.isRefreshing || rawStore.isLoading;
    },

    // Pinia Getters: 클라이언트 연산 및 파생 데이터 자동 계산
    has85PlusMatched: (state) => {
      if (!state.newData || state.newData.length === 0) return false;
      const portfolioStore = usePortfolioStore();
      const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode));
      return state.newData.some(item => !item.isHolding && item.type !== 'holding' && !holdingShcodes.has(item.shcode) && item.isFullyMatched);
    },
    matchedCount: (state) => {
      if (!state.newData || state.newData.length === 0) return 0;
      const portfolioStore = usePortfolioStore();
      const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode));
      return state.newData.filter(item => !item.isHolding && item.type !== 'holding' && !holdingShcodes.has(item.shcode) && item.isFullyMatched).length;
    },
    topBuyRecommendations: (state) => {
      if (!state.newData || state.newData.length === 0) return [];
      const portfolioStore = usePortfolioStore();
      const holdingShcodes = new Set(portfolioStore.holdings.map(h => h.shcode));

      // 보유종목(isHolding, type === 'holding', portfolioStore.holdings에 존재하는 종목) 100% 엄격 제외
      const watchlistOnly = state.newData.filter(item => 
        !item.isHolding && item.type !== 'holding' && !holdingShcodes.has(item.shcode)
      );

      return [...watchlistOnly].sort((a, b) => b.score - a.score).slice(0, 3);
    },
    bottomDecliningStocks: (state) => {
      if (!state.newData || state.newData.length === 0) return [];
      return [...state.newData]
        .sort((a, b) => {
          const rateA = typeof a.changeRate === 'number' ? a.changeRate : (a.score - 100);
          const rateB = typeof b.changeRate === 'number' ? b.changeRate : (b.score - 100);
          return rateA - rateB;
        })
        .slice(0, 5);
    },
    oldRecordTime: (state) => {
      if (state.oldData && state.oldData.length > 0 && state.oldData[0]?.createdAt) {
        return state.oldData[0].createdAt;
      }
      return '이전 분석 기록 없음';
    }
  },

  actions: {
    async loadInitial(forceRefresh = false) {
      const rawStore = useLSStockRawStore();
      await rawStore.fetchRawStockData(forceRefresh);

      if (rawStore.errorMessage) {
        this.errorMessage = rawStore.errorMessage;
      }

      // 원천 데이터를 가져와 클라이언트 컴포저블 연산 적용
      this.recalculateFromRaw();
    },

    async refreshScreener() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      this.errorMessage = null;

      try {
        const rawStore = useLSStockRawStore();
        await rawStore.fetchRawStockData(true);

        if (rawStore.errorMessage) {
          this.errorMessage = rawStore.errorMessage;
        }

        this.recalculateFromRaw();
      } catch (err: any) {
        console.error('Screener refresh error:', err);
        this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 스크리닝 데이터 호출 중 오류가 발생했습니다.';
      } finally {
        this.isRefreshing = false;
      }
    },

    recalculateFromRaw() {
      const rawStore = useLSStockRawStore();
      if (!rawStore.rawStockList || rawStore.rawStockList.length === 0) return;

      if (this.newData && this.newData.length > 0) {
        this.oldData = [...this.newData];
      }

      // 원천 데이터를 Composable(calculateQuantIndicators)로 8대 지표 및 숏커버링 계산
      const calculatedItems = rawStore.rawStockList.map(item => {
        const etfKeywords = ['KODEX', 'TIGER', 'ACE', 'SOL', 'RISE', 'KoAct', 'PLUS', 'HANARO', 'WOORI', 'UNICORN', 'TIMEFOLIO', 'HERO', 'KBSTAR', 'ARIRANG', 'ETF', 'ETN'];
        const isEtf = (item.industry || '').includes('ETF') || (item.industry || '').includes('ETN') || etfKeywords.some(k => (item.name || '').includes(k));

        const quantResult = calculateQuantIndicators({
          shcode: item.shcode,
          name: item.name,
          industry: item.industry,
          isHolding: !!item.isHolding,
          holdingQuantity: item.holdingQuantity ?? item.quantity,
          holdingAvgPrice: item.holdingAvgPrice ?? item.avgPrice,
          closePrice: item.closePrice,
          psy: item.psy ?? null,
          bbLower: item.bbLower ?? null,
          ma5: item.ma5 ?? null,
          ma20: item.ma20 ?? null,
          ma60: item.ma60 ?? null,
          volumeRatio: item.volumeRatio ?? null,
          macdHist: item.macdHist ?? null,
          rsi: item.rsi ?? null,
          bullishDivergence: item.bullishDivergence ?? null,
          shortSellHistory: item.shortSellHistory || [],
          dataSource: item.dataSource || 'LS증권 Open API'
        });

        return {
          ...item,
          shortSellingStatus: isEtf ? 'ETF/ETN (공매도 t1927 제외 종목)' : (quantResult.shortSignal.label || item.shortSellingStatus || '판단 보류'),
          score: quantResult.score,
          isFullyMatched: quantResult.isFullyMatched
        };
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
