<template>
  <div class="space-y-6">
    <!-- Top Executive Header Banner -->
    <div class="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 font-bold text-xs">
              <i class="fas fa-chart-pie mr-1"></i> 메인 대시보드 Overview
            </span>
            <span class="text-xs text-slate-400">자산 현황 & 종합 시장 대응 전략</span>
          </div>
          <h2 class="text-2xl font-extrabold text-white tracking-tight">
            실시간 자산 현황 및 AI 시장 종합 분석
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            LS증권 Open API 실시간 시세와 6대 기술적 지표 및 Anthropic Claude 퀀트 진단 결과를 실시간 브리핑합니다.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <NuxtLink to="/screener" class="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95">
            <i class="fas fa-search-dollar"></i> 관심종목 스크리너 이동
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Key Metrics Cards Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Total Investment Amount -->
      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>총 매수금액</span>
          <i class="fas fa-coins text-amber-400"></i>
        </div>
        <div class="text-2xl font-extrabold text-white font-mono">
          {{ formatKrw(portfolioStore.totalPurchaseAmount) }}
        </div>
        <p class="text-[11px] text-slate-400">보유 종목 평단가 × 수량 합계</p>
      </div>

      <!-- Total Valuation Amount -->
      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>총 평가금액</span>
          <i class="fas fa-chart-line text-cyan-400"></i>
        </div>
        <div class="text-2xl font-extrabold text-slate-100 font-mono">
          {{ formatKrw(portfolioStore.totalValuationAmount) }}
        </div>
        <p class="text-[11px] text-slate-400">LS증권 연동 실시간 시세 반영</p>
      </div>

      <!-- Total PnL Amount & Rate -->
      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>평가 손익 (수익률)</span>
          <i class="fas fa-percentage" :class="portfolioStore.totalPnlAmount >= 0 ? 'text-rose-400' : 'text-emerald-400'"></i>
        </div>
        <div class="text-2xl font-extrabold font-mono flex items-baseline gap-2" :class="portfolioStore.totalPnlAmount >= 0 ? 'text-rose-400' : 'text-emerald-400'">
          <span>{{ portfolioStore.totalPnlAmount >= 0 ? '+' : '' }}{{ formatKrw(portfolioStore.totalPnlAmount) }}</span>
          <span class="text-sm">({{ portfolioStore.totalPnlRate >= 0 ? '+' : '' }}{{ portfolioStore.totalPnlRate }}%)</span>
        </div>
        <p class="text-[11px] text-slate-400">실시간 누적 손익 상태</p>
      </div>

      <!-- Monitored Screener Matched Count -->
      <div class="bg-slate-900/80 border border-slate-800 p-5 rounded-2xl space-y-2 shadow-lg">
        <div class="flex items-center justify-between text-xs text-slate-400">
          <span>기술적 매수조건 포착</span>
          <i class="fas fa-check-circle text-emerald-400"></i>
        </div>
        <div class="text-2xl font-extrabold text-emerald-400 font-mono">
          {{ screenerStore.matchedCount }} <span class="text-sm text-slate-300">개 종목 (100%)</span>
        </div>
        <p class="text-[11px] text-slate-400">6개 매수타점 기술적 지표 완전 매칭</p>
      </div>
    </div>

    <!-- Today's Market Analysis & Strategy Summary Card -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Market Strategy (Left 2 cols) -->
      <div class="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <i class="fas fa-chess text-indigo-400"></i>
            <span>오늘의 시장 종합 분석 및 대응 전략</span>
          </h3>
          <span class="text-[11px] text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
            분석 일시: {{ screenerStore.lastUpdated || '2026-08-11 13:00' }}
          </span>
        </div>

        <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div class="bg-indigo-950/30 border border-indigo-500/20 p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-indigo-300 flex items-center gap-1.5 text-sm">
              <i class="fas fa-shield-alt text-indigo-400"></i> 1. 종합 시장 관점 및 리스크 관리
            </h4>
            <p>
              미국 로봇/AI 및 전력 인프라 세무 수혜업종 중심으로 반등 국면 지속 중. 기술적 과매도 탈출(RSI 30 돌파 + 심리선 25% 이하) 종목에 수급 유입세 포착.
            </p>
          </div>

          <div class="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <i class="fas fa-bullseye text-emerald-400"></i> 2. 정밀 매수/매도 대응 가이드라인
            </h4>
            <ul class="list-disc list-inside space-y-1 text-slate-300">
              <li><strong class="text-emerald-400">매수 전략</strong>: 퀀트 스코어 85점 이상 포착 종목에 한해 목표가(RRR 1:2) 설정 후 분할 매수.</li>
              <li><strong class="text-rose-400">손절 전략</strong>: 매수가 대비 <code class="text-rose-300 bg-slate-950 px-1 py-0.5 rounded">-4.5%</code> 이탈 시 즉시 기계적 손절.</li>
              <li><strong class="text-amber-400">추적 손절매 (Trailing Stop)</strong>: 고점 대비 <code class="text-amber-300 bg-slate-950 px-1 py-0.5 rounded">-3.0%</code> 하락 시 수익 확정 매도.</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Top Recommended Buy Signals (Right 1 col) -->
      <div class="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <i class="fas fa-bolt text-yellow-400"></i>
            <span>🎯 퀀트 매수 추천 (Top 3)</span>
          </h3>
          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold">85점+</span>
        </div>

        <div v-if="screenerStore.topBuyRecommendations.length === 0" class="text-center py-8 text-slate-500 text-xs">
          스크리너 데이터 불러오는 중입니다...
        </div>

        <div v-else class="space-y-3">
          <div 
            v-for="item in screenerStore.topBuyRecommendations" 
            :key="item.shcode"
            class="bg-slate-950/80 border border-emerald-500/30 p-3.5 rounded-xl space-y-2 hover:border-emerald-400/50 transition-all"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold text-[10px]">{{ item.industry }}</span>
                <h4 class="font-bold text-white text-xs">{{ item.name }}</h4>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {{ item.score }}점 / 100점
              </span>
            </div>

            <div class="flex items-center justify-between text-xs font-mono pt-1">
              <span class="text-slate-400">현재가:</span>
              <strong class="text-white">{{ Number(item.closePrice).toLocaleString() }}원</strong>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
              <span>RSI: <strong class="text-cyan-400">{{ item.rsi }}</strong></span>
              <span>거래량: <strong class="text-amber-400">{{ item.volumeRatio }}%</strong></span>
              <NuxtLink to="/screener" class="text-indigo-400 hover:underline text-[10px] font-bold">상세보기 &rarr;</NuxtLink>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { usePortfolioStore } from '~/stores/usePortfolioStore';
import { useScreenerStore } from '~/stores/useScreenerStore';

const portfolioStore = usePortfolioStore();
const screenerStore = useScreenerStore();

onMounted(async () => {
  await portfolioStore.fetchHoldings();
  await screenerStore.refreshScreener();
});

function formatKrw(val: number) {
  if (val === null || val === undefined || isNaN(val)) return '0원';
  return Number(val).toLocaleString() + '원';
}
</script>
