import { defineStore } from 'pinia';
import type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo } from '../../utils/types/lsSecurities';

export type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo };

const KEY_PREFIX = 'nuxt4_stock_screener_';
const EXPIRATION_MS = 15 * 24 * 60 * 60 * 1000; // 15일 보존 정책

const defaultMarketBasis: MarketBasisInfo = {
  basis: 0.45,
  basisStatus: '콘탱고 (매수 우위)',
  futuresPrice: 365.20,
  kospi200Index: 364.75,
  oi: 315400,
  programNetBuy: 1245,
  vkospi: 18.2,
  updatedAt: new Date().toLocaleString('ko-KR')
};

const defaultTopSectors: TopSectorInfo[] = [
  { code: '001', name: '전기전자/AI', rate: 2.45 },
  { code: '009', name: '전력인프라/기계', rate: 1.85 },
  { code: '015', name: '바이오/제약', rate: 1.42 },
  { code: '003', name: '화학/소재', rate: 0.98 },
  { code: '018', name: '자동차/운수장비', rate: 0.75 }
];

const defaultBottomSectors: TopSectorInfo[] = [
  { code: '020', name: '종이/목재', rate: -1.85 },
  { code: '022', name: '철강/금속', rate: -1.25 },
  { code: '025', name: '건설업', rate: -0.95 },
  { code: '027', name: '유통업', rate: -0.62 },
  { code: '030', name: '섬유/의복', rate: -0.45 }
];

function getTodayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${KEY_PREFIX}${year}-${month}-${day}`;
}

export const useScreenerStore = defineStore('screener', {
  state: () => ({
    oldData: [] as StockItem[],
    newData: [] as StockItem[],
    marketBasis: defaultMarketBasis as MarketBasisInfo | null,
    topSectors: defaultTopSectors as TopSectorInfo[],
    bottomSectors: defaultBottomSectors as TopSectorInfo[],
    aiMarketAnalysis: null as AiMarketAnalysisInfo | null,
    isRefreshing: false,
    isAiAnalyzing: false,
    lastUpdated: '',
    cachedTimestamp: 0,
    sourceProvider: 'LS증권 Open API (openapi.ls-sec.co.kr)',
    errorMessage: null as string | null
  }),

  getters: {
    has85PlusMatched: (state) => {
      if (!state.newData || state.newData.length === 0) return false;
      return state.newData.some(item => item.isFullyMatched);
    },
    matchedCount: (state) => state.newData.filter(item => item.isFullyMatched).length,
    topBuyRecommendations: (state) => {
      if (!state.newData || state.newData.length === 0) return [];
      return [...state.newData].sort((a, b) => b.score - a.score).slice(0, 3);
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
    initFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const now = Date.now();
        const validDailyKeys: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(KEY_PREFIX) || key.startsWith('nuxt4_stock_screener_cache'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.cachedTimestamp && now - parsed.cachedTimestamp > EXPIRATION_MS) {
                  localStorage.removeItem(key);
                } else if (key.startsWith(KEY_PREFIX)) {
                  validDailyKeys.push(key);
                }
              } catch (e) {
                localStorage.removeItem(key);
              }
            }
          }
        }

        const todayKey = getTodayKey();
        const targetKey = localStorage.getItem(todayKey) ? todayKey : (validDailyKeys.sort().pop() || todayKey);
        const saved = localStorage.getItem(targetKey);

        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.newData && Array.isArray(parsed.newData)) {
            this.newData = parsed.newData;
          }
          if (parsed.oldData && Array.isArray(parsed.oldData)) {
            this.oldData = parsed.oldData;
          }
          if (parsed.marketBasis) {
            this.marketBasis = parsed.marketBasis;
          } else {
            this.marketBasis = defaultMarketBasis;
          }
          if (parsed.topSectors && Array.isArray(parsed.topSectors) && parsed.topSectors.length > 0) {
            this.topSectors = parsed.topSectors;
          } else {
            this.topSectors = defaultTopSectors;
          }
          if (parsed.bottomSectors && Array.isArray(parsed.bottomSectors) && parsed.bottomSectors.length > 0) {
            this.bottomSectors = parsed.bottomSectors;
          } else {
            this.bottomSectors = defaultBottomSectors;
          }
          if (parsed.aiMarketAnalysis) {
            this.aiMarketAnalysis = parsed.aiMarketAnalysis;
          }
          this.lastUpdated = parsed.lastUpdated || '';
          this.cachedTimestamp = parsed.cachedTimestamp || 0;
          this.sourceProvider = parsed.sourceProvider || this.sourceProvider;
        }
      } catch (e) {
        console.error('Failed to load screener cache from storage:', e);
      }
    },

    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        this.cachedTimestamp = Date.now();
        const todayKey = getTodayKey();
        localStorage.setItem(todayKey, JSON.stringify({
          newData: this.newData,
          oldData: this.oldData,
          marketBasis: this.marketBasis,
          topSectors: this.topSectors,
          bottomSectors: this.bottomSectors,
          aiMarketAnalysis: this.aiMarketAnalysis,
          lastUpdated: this.lastUpdated,
          cachedTimestamp: this.cachedTimestamp,
          sourceProvider: this.sourceProvider
        }));
      } catch (e) {
        console.error('Failed to save screener cache to storage:', e);
      }
    },

    async loadInitial(forceRefresh = false) {
      this.initFromStorage();

      if (!forceRefresh && this.newData && this.newData.length > 0) {
        return;
      }

      await this.refreshScreener();
    },

    async refreshScreener() {
      if (this.isRefreshing) return;
      this.isRefreshing = true;
      this.errorMessage = null;
      try {
        const response = await $fetch<ScreenerApiResponse>('/api/screener', { method: 'POST' });

        if (response && response.success) {
          if (response.newData && response.newData.length > 0) {
            this.newData = response.newData;
          }
          if (response.oldData && response.oldData.length > 0) {
            this.oldData = response.oldData;
          }
          if (response.marketBasis) {
            this.marketBasis = response.marketBasis;
          }
          if (response.topSectors && response.topSectors.length > 0) {
            this.topSectors = response.topSectors;
          }
          if (response.bottomSectors && response.bottomSectors.length > 0) {
            this.bottomSectors = response.bottomSectors;
          }
          this.lastUpdated = response.timestamp || new Date().toLocaleString('ko-KR');
          this.sourceProvider = response.source || this.sourceProvider;
          if (response.error) {
            this.errorMessage = response.error;
          }

          this.saveToStorage();
        }
      } catch (err: any) {
        console.error('Screener refresh error:', err);
        this.errorMessage = err.statusMessage || err.message || 'LS증권 시세 스크리닝 데이터 호출 중 오류가 발생했습니다.';
      } finally {
        this.isRefreshing = false;
      }
    },

    async runAiMarketDiagnosis() {
      if (this.isAiAnalyzing) return;
      this.isAiAnalyzing = true;
      try {
        const payload = {
          marketBasis: this.marketBasis,
          topSectors: this.topSectors,
          bottomSectors: this.bottomSectors,
          matchedCount: this.matchedCount
        };
        const res = await $fetch<{ success: boolean; content: string; createdAt: string }>('/api/ai/market-diagnosis', {
          method: 'POST',
          body: payload
        });
        if (res && res.success && res.content) {
          this.aiMarketAnalysis = {
            content: res.content,
            createdAt: res.createdAt
          };
          this.saveToStorage();
        }
      } catch (err: any) {
        console.error('AI Market Diagnosis error:', err);
        throw err;
      } finally {
        this.isAiAnalyzing = false;
      }
    }
  }
});
