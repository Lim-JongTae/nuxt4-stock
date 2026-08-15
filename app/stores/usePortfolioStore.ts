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
      return state.holdings.reduce((sum, item) => sum + (item.avgPrice * item.quantity), 0);
    },
    totalValuationAmount: (state) => {
      return state.holdings.reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
    },
    totalPnlAmount(): number {
      return this.totalValuationAmount - this.totalPurchaseAmount;
    },
    totalPnlRate(): number {
      if (this.totalPurchaseAmount === 0) return 0;
      return Math.round((this.totalPnlAmount / this.totalPurchaseAmount) * 10000) / 100;
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
          this.holdings = data;
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
              h.currentPrice = p.currentPrice;
              h.targetPrice = p.targetPrice;
              h.stopLossPrice = p.stopLossPrice;
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

      const item = this.holdings.find(h => h.name === stockName);
      const curPrice = item ? `${item.currentPrice.toLocaleString()}원` : '9,750원';
      const avgPrice = item ? `${item.avgPrice.toLocaleString()}원` : '11,317원';
      const qty = item ? `${item.quantity}주` : '1,046주';
      const pnlRate = item && item.avgPrice > 0 ? (((item.currentPrice - item.avgPrice) / item.avgPrice) * 100).toFixed(2) + '%' : '-14.12%';
      const candles = item?.candles || [];

      const prompt = `[분석 대상 종목 실시간 수치 데이터]:
- 종목명: ${stockName}
- 평단가: ${avgPrice}
- 보유 수량: ${qty}
- 실시간 현재가: ${curPrice}
- 현재 수익률: ${pnlRate}

위 종목 시세 및 보유 데이터를 기반으로, 사과나 거부 문구 없이 즉시 마크다운 형식 주식 퀀트 분석 보고서를 작성하세요.

1. 📊 종목 현황 및 이동평균선(5/20/60일), 볼린저 밴드, RSI, MACD, LS증권 수급
2. 🎯 정밀 매수 타점 판단 (100점 만점 퀀트 스코어)
3. 🚨 기술적 지표 동적 매도 대응 전략 (고정 % 금지, 볼린저 밴드 상/하단, ATR 변동성, 이평선 저항선/지지선 분석 기반 동적 목표가/손절가/트레일링스탑 산출)
4. 💡 종합 투자 판단 (BUY / HOLD / SELL)
(주의: '보고서 생성 시각' 문구는 작성하지 마세요)`;

      try {
        const response = await $fetch<any>('/api/ai/analyze', {
          method: 'POST',
          body: {
            prompt,
            stockName,
            candles,
            max_tokens: 550
          },
          timeout: 100000
        });

        if (response && response.content && Array.isArray(response.content)) {
          let text = response.content.map((b: any) => b.text || '').join('\n\n');
          text = text.replace(/(\*\*|)?보고서 생성 시각(\*\*|)?:\s*[^\n]+/gi, '');
          this.aiAnalysisResult = text.trim();

          // Extract dynamic target & stoploss price from AI text if present
          if (item) {
            const targetMatch = text.match(/동적 목표가[^:]*:\s*\*\*?([0-9,]+)원\*\*?/i) || text.match(/목표가[^:]*:\s*\*\*?([0-9,]+)원\*\*?/i);
            const stopLossMatch = text.match(/동적 손절가[^:]*:\s*\*\*?([0-9,]+)원\*\*?/i) || text.match(/손절가[^:]*:\s*\*\*?([0-9,]+)원\*\*?/i);

            if (targetMatch) {
              const tp = parseInt(targetMatch[1].replace(/,/g, ''), 10);
              if (tp > 0) item.targetPrice = tp;
            }
            if (stopLossMatch) {
              const sl = parseInt(stopLossMatch[1].replace(/,/g, ''), 10);
              if (sl > 0) item.stopLossPrice = sl;
            }
          }
        } else {
          throw new Error('예상치 못한 응답 형식입니다.');
        }
      } catch (err: any) {
        console.error('AI API analysis error:', err);
        const errMsg = err.statusMessage || err.data?.statusMessage || err.message || '알 수 없는 에러';
        this.errorMessage = `AI 진단 미조회: ${errMsg}`;
        this.aiAnalysisResult = `## 🚨 Claude AI 분석 연결 실패 (미조회)\n\n> ⚠️ **오류 메시지**: ${errMsg}\n\n.env 파일의 ANTHROPIC_API_KEY 상태 및 Oneprovider 프록시 통신 상태를 확인한 후 다시 시도해 주세요.`;
      } finally {
        this.isAiAnalyzing = false;
      }
    }
  }
});
