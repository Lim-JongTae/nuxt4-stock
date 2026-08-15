import { defineStore } from 'pinia';
import type { StockItem, ScreenerApiResponse, MarketBasisInfo } from '../../utils/types/lsSecurities';

export type { StockItem, ScreenerApiResponse, MarketBasisInfo };

const KEY_PREFIX = 'nuxt4_stock_screener_';
const EXPIRATION_MS = 15 * 24 * 60 * 60 * 1000; // 15일 보존 정책 (15일 이상 초과 시에만 자동 제거)

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
    isRefreshing: false,
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
    oldRecordTime: (state) => {
      if (state.oldData && state.oldData.length > 0 && state.oldData[0]?.createdAt) {
        return state.oldData[0].createdAt;
      }
      return '이전 분석 기록 없음';
    }
  },

  actions: {
    // 최초 진입 시 스토리지/캐시 데이터 불러오기 (1일 1개 보존 & 15일 이상 경과 데이터만 자동 제거)
    initFromStorage() {
      if (typeof window === 'undefined') return;
      try {
        const now = Date.now();
        const validDailyKeys: string[] = [];

        // 1. 15일 이상 경과한 과거 일별 데이터만 자동 제거 (15일 이내 타 날짜 1일1개 데이터는 100% 보존)
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith(KEY_PREFIX) || key.startsWith('nuxt4_stock_screener_cache'))) {
            const raw = localStorage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (parsed.cachedTimestamp && now - parsed.cachedTimestamp > EXPIRATION_MS) {
                  localStorage.removeItem(key); // 15일 초과 데이터만 삭제
                } else if (key.startsWith(KEY_PREFIX)) {
                  validDailyKeys.push(key);
                }
              } catch (e) {
                localStorage.removeItem(key);
              }
            }
          }
        }

        // 2. 가장 최근 날짜의 1일 1개 데이터 불러오기
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
          this.lastUpdated = parsed.lastUpdated || '';
          this.cachedTimestamp = parsed.cachedTimestamp || 0;
          this.sourceProvider = parsed.sourceProvider || this.sourceProvider;
        }
      } catch (e) {
        console.error('Failed to load screener cache from storage:', e);
      }
    },

    // 데이터를 스토리지에 당일 1일 1개 덮어쓰기로 15일간 보관
    saveToStorage() {
      if (typeof window === 'undefined') return;
      try {
        this.cachedTimestamp = Date.now();
        const todayKey = getTodayKey();
        localStorage.setItem(todayKey, JSON.stringify({
          newData: this.newData,
          oldData: this.oldData,
          marketBasis: this.marketBasis,
          lastUpdated: this.lastUpdated,
          cachedTimestamp: this.cachedTimestamp,
          sourceProvider: this.sourceProvider
        }));
      } catch (e) {
        console.error('Failed to save screener cache to storage:', e);
      }
    },

    // 페이지 진입 및 초기 로드 (forceRefresh=false이면 스토어/LocalStorage 캐시 0ms 반환)
    async loadInitial(forceRefresh = false) {
      this.initFromStorage();

      if (!forceRefresh && this.newData && this.newData.length > 0) {
        return;
      }

      await this.refreshScreener();
    },

    // 새로고침 및 시세조회 버튼 클릭시에만 실행하여 API 재호출
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
          this.lastUpdated = response.timestamp || new Date().toLocaleString('ko-KR');
          this.sourceProvider = response.source || this.sourceProvider;
          if (response.error) {
            this.errorMessage = response.error;
          }

          // 성공적인 데이터 반환 시 스토리지에 캐시 저장
          this.saveToStorage();
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
