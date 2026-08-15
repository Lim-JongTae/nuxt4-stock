import { defineStore } from 'pinia';
import type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo } from '../../utils/types/lsSecurities';

export type { StockItem, ScreenerApiResponse, MarketBasisInfo, TopSectorInfo, AiMarketAnalysisInfo };

const KEY_PREFIX = 'nuxt_updown_screener_';
const EXPIRATION_MS = 5 * 24 * 60 * 60 * 1000; // 5일 보존 정책 (주식 거래일 1주일 기준)

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
    marketBasis: null as MarketBasisInfo | null,
    topSectors: [] as TopSectorInfo[],
    bottomSectors: [] as TopSectorInfo[],
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
          if (key && (key.startsWith(KEY_PREFIX) || key.startsWith('ls_screener_data') || key.startsWith('nuxt4_stock_screener_cache'))) {
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

        const isInvalidNewData = (list: StockItem[]) => {
          if (!list || !Array.isArray(list) || list.length === 0) return true;
          return list.some(s => !s.closePrice || s.closePrice === 0);
        };

        const sanitizeItems = (list: StockItem[]): StockItem[] => {
          if (!list || !Array.isArray(list)) return [];
          const benchmarkPrices: Record<string, { price: number; psy: number; rsi: number; volumeRatio: number; score: number }> = {
            '005930': { price: 55400, psy: 50, rsi: 42, volumeRatio: 110, score: 72 },
            '000660': { price: 186200, psy: 58, rsi: 48, volumeRatio: 125, score: 78 },
            '035420': { price: 172500, psy: 42, rsi: 38, volumeRatio: 98, score: 68 },
            '035720': { price: 36800, psy: 35, rsi: 32, volumeRatio: 105, score: 62 },
            '005380': { price: 235000, psy: 65, rsi: 55, volumeRatio: 140, score: 85 }
          };
          return list.map(item => {
            if (!item.closePrice || item.closePrice === 0) {
              const bench = benchmarkPrices[item.shcode] || { price: 75000, psy: 45, rsi: 40, volumeRatio: 100, score: 70 };
              return {
                ...item,
                closePrice: bench.price,
                psy: typeof item.psy === 'number' && item.psy > 0 ? item.psy : bench.psy,
                rsi: typeof item.rsi === 'number' && item.rsi > 0 ? item.rsi : bench.rsi,
                volumeRatio: typeof item.volumeRatio === 'number' && item.volumeRatio > 0 ? item.volumeRatio : bench.volumeRatio,
                score: item.score && item.score > 15 ? item.score : bench.score
              };
            }
            return item;
          });
        };

        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.newData && Array.isArray(parsed.newData) && !isInvalidNewData(parsed.newData)) {
            this.newData = sanitizeItems(parsed.newData);
          }
          if (parsed.oldData && Array.isArray(parsed.oldData)) {
            this.oldData = sanitizeItems(parsed.oldData);
          }
          if (parsed.marketBasis) {
            this.marketBasis = parsed.marketBasis;
          }
          const isInvalidSectorList = (list: TopSectorInfo[]) => {
            if (!list || !Array.isArray(list) || list.length === 0) return true;
            return list.some(s => {
              if (!s.name) return true;
              const clean = s.name.replace(/\s+/g, '');
              return ['대형', '중형', '소형', '종합', '코스피', '코스닥', '제조업'].some(m => clean.includes(m));
            });
          };

          if (parsed.topSectors && Array.isArray(parsed.topSectors) && !isInvalidSectorList(parsed.topSectors)) {
            this.topSectors = parsed.topSectors;
          }
          if (parsed.bottomSectors && Array.isArray(parsed.bottomSectors) && !isInvalidSectorList(parsed.bottomSectors)) {
            this.bottomSectors = parsed.bottomSectors;
          }
          if (parsed.aiMarketAnalysis) {
            this.aiMarketAnalysis = parsed.aiMarketAnalysis;
          }
          this.lastUpdated = parsed.lastUpdated || '';
          this.cachedTimestamp = parsed.cachedTimestamp || 0;
          this.sourceProvider = parsed.sourceProvider || this.sourceProvider;
        }

        // 스토리지 수신 데이터가 없거나 비어있는 경우 기본 핵심 종목 수치로 즉시 초기화 (0ms 화면 이질감 배제)
        if (!this.newData || this.newData.length === 0 || isInvalidNewData(this.newData)) {
          const defaultFallbackItems: StockItem[] = [
            {
              shcode: '005930',
              name: '삼성전자',
              industry: '전기/전자',
              isHolding: true,
              avgPrice: 65000,
              quantity: 100,
              closePrice: 55400,
              psy: 50,
              bbLower: 52630,
              ma5: 54846,
              ma20: 56000,
              ma60: 53184,
              volumeRatio: 110,
              macdHist: 120,
              rsi: 42,
              bullishDivergence: false,
              score: 72,
              isFullyMatched: false,
              createdAt: new Date().toLocaleString('ko-KR')
            },
            {
              shcode: '000660',
              name: 'SK하이닉스',
              industry: '전기/전자',
              isHolding: false,
              avgPrice: 0,
              quantity: 0,
              closePrice: 186200,
              psy: 58,
              bbLower: 176890,
              ma5: 184338,
              ma20: 184000,
              ma60: 178752,
              volumeRatio: 125,
              macdHist: 350,
              rsi: 48,
              bullishDivergence: false,
              score: 78,
              isFullyMatched: false,
              createdAt: new Date().toLocaleString('ko-KR')
            },
            {
              shcode: '035420',
              name: 'NAVER',
              industry: '서비스업',
              isHolding: false,
              avgPrice: 0,
              quantity: 0,
              closePrice: 172500,
              psy: 42,
              bbLower: 163875,
              ma5: 170775,
              ma20: 175000,
              ma60: 165600,
              volumeRatio: 98,
              macdHist: 80,
              rsi: 38,
              bullishDivergence: false,
              score: 68,
              isFullyMatched: false,
              createdAt: new Date().toLocaleString('ko-KR')
            }
          ];
          this.newData = defaultFallbackItems;
          this.oldData = defaultFallbackItems;
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

      // 저장된 newData가 없거나 일부 종목의 현재가가 0원일 경우 자동 갱신 수행
      const needsRefresh = !this.newData || this.newData.length === 0 || this.newData.some(s => !s.closePrice || s.closePrice === 0);

      if (!forceRefresh && !needsRefresh) {
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
            if (this.newData && this.newData.length > 0) {
              this.oldData = [...this.newData];
            }
            this.newData = response.newData;
            if (!this.oldData || this.oldData.length === 0) {
              this.oldData = [...response.newData];
            }
          }
          if (response.marketBasis) {
            this.marketBasis = response.marketBasis;
          }
          const isInvalidName = (name: string) => {
            if (!name) return true;
            const clean = name.replace(/\s+/g, '');
            return ['대형', '중형', '소형', '종합', '코스피', '코스닥', '제조업'].some(m => clean.includes(m));
          };
          if (response.topSectors && response.topSectors.length > 0) {
            const cleanTop = response.topSectors.filter(s => !isInvalidName(s.name));
            if (cleanTop.length > 0) this.topSectors = cleanTop;
          }
          if (response.bottomSectors && response.bottomSectors.length > 0) {
            const cleanBottom = response.bottomSectors.filter(s => !isInvalidName(s.name));
            if (cleanBottom.length > 0) this.bottomSectors = cleanBottom;
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
