<template>
  <div class="space-y-6">
    <!-- Top Executive Header Banner -->
    <div class="bg-linear-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-2">
            <span class="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-xs flex items-center gap-1.5">
              <img src="/icon.jpeg" alt="Logo" class="w-4 h-4 rounded-sm object-cover" />
              <span>메인 대시보드 Overview</span>
            </span>
            <span class="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>수집시각: {{ screenerStore.lastUpdated || '실시간 시세 수집 완료' }} (Store 중앙집중 관리)</span>
            </span>
          </div>
          <h2 class="text-2xl font-extrabold text-white tracking-tight">
            실시간 자산 현황 및 AI 시장 종합 분석
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            LS증권 Open API 실시간 시세와 6대 기술적 지표 및 Anthropic Claude 퀀트 진단 결과를 실시간 브리핑합니다.
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <button
            @click="openAddModal"
            class="px-4 py-2.5 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <i class="fas fa-plus-circle"></i> 종목 추가 / 편집
          </button>
          <button
            @click="isShortSellQuantityModalOpen = true"
            class="px-4 py-2.5 rounded-xl bg-linear-to-r from-yellow-800 to-green-300 hover:from-rose-500 hover:to-pink-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20 flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
          >
            <i class="fas fa-table"></i> 공매도수량 입력
          </button>
          <NuxtLink to="/portfolio" class="px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95">
            <i class="fas fa-wallet"></i> 보유종목 상세관리
          </NuxtLink>
          <NuxtLink to="/screener" class="px-4 py-2.5 rounded-xl bg-linear-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95">
            <i class="fas fa-search-dollar"></i> 관심종목 스크리너 이동
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Portfolio Summary Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>총 매수금액 (보유종목)</span>
          <i class="fas fa-coins text-amber-400 text-base"></i>
        </div>
        <div class="text-xl font-black text-white font-mono">
          {{ formatKrw(portfolioStore.totalPurchaseAmount) }}
        </div>
        <p class="text-[10px] text-slate-300">보유 수량 × 평균 단가 합계</p>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>총 평가금액 (실시간 시세)</span>
          <i class="fas fa-wallet text-indigo-400 text-base"></i>
        </div>
        <div class="text-xl font-black text-white font-mono">
          {{ formatKrw(portfolioStore.totalValuationAmount) }}
        </div>
        <p class="text-[10px] text-slate-300">보유 수량 × 최신 현재가 합계</p>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>총 평가손익</span>
          <i class="fas fa-chart-line text-emerald-400 text-base"></i>
        </div>
        <div class="text-xl font-black font-mono" :class="portfolioStore.totalPnlAmount >= 0 ? 'text-rose-400' : 'text-cyan-400'">
          {{ portfolioStore.totalPnlAmount >= 0 ? '+' : '' }}{{ formatKrw(portfolioStore.totalPnlAmount) }}
        </div>
        <p class="text-[10px] text-slate-300">평가금액 - 총 매수금액</p>
      </div>

      <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 shadow-lg relative overflow-hidden space-y-1">
        <div class="flex items-center justify-between text-slate-400 text-xs font-semibold">
          <span>총 수익률</span>
          <i class="fas fa-percentage text-purple-400 text-base"></i>
        </div>
        <div class="text-xl font-black font-mono" :class="portfolioStore.totalPnlRate >= 0 ? 'text-rose-400' : 'text-cyan-400'">
          {{ portfolioStore.totalPnlRate >= 0 ? '+' : '' }}{{ portfolioStore.totalPnlRate }}%
        </div>
        <p class="text-[10px] text-slate-300">포트폴리오 총 수익률</p>
      </div>
    </div>

    <!-- Today's Market Analysis & Strategy Summary Card -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      <!-- Market Strategy (Left 2 cols) -->
      <div class="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <i class="fas fa-chess text-indigo-400"></i>
            <span>오늘의 시장 종합 분석 및 대응 전략</span>
          </h3>
          <div class="flex items-center gap-2">
            <span class="text-[11px] text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 font-mono flex items-center gap-1.5">
              <i class="fas fa-clock text-indigo-400"></i>
              <span>시세 갱신: {{ screenerStore.lastUpdated || '실시간' }}</span>
            </span>
            <button 
              @click="handleDashboardRefresh" 
              :disabled="screenerStore.isRefreshing || rawStore.isLoading"
              class="px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <i class="fas" :class="(screenerStore.isRefreshing || rawStore.isLoading) ? 'fa-spinner fa-spin text-amber-400' : 'fa-sync-alt'"></i>
              <span>{{ (screenerStore.isRefreshing || rawStore.isLoading) ? '갱신 중...' : '시세 갱신' }}</span>
            </button>
          </div>
        </div>

        <!-- LS Securities Real-time Top 5 Rising Sectors Bar -->
        <div class="bg-slate-950/80 border border-indigo-500/30 p-3 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-indigo-300 flex items-center gap-1.5">
              <i class="fas fa-fire text-amber-400"></i> LS증권 실시간 상위 5대 유망 업종 (t8424 / t1531 파싱)
            </span>
            <span class="text-[10px] text-rose-400 font-mono">실시간 상승률 순</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <template v-if="screenerStore.topSectors && screenerStore.topSectors.length > 0">
              <span 
                v-for="s in screenerStore.topSectors" 
                :key="s.code" 
                class="px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <span>{{ s.name }}</span>
                <span class="text-rose-400 font-extrabold text-[11px] font-mono">+{{ s.rate }}%</span>
              </span>
            </template>
            <template v-else>
              <span class="text-xs text-slate-400">유망 업종 파싱 중...</span>
            </template>
          </div>
        </div>

        <!-- LS Securities Real-time Bottom 5 Declining Sectors Bar -->
        <div class="bg-slate-950/80 border border-blue-500/30 p-3 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
              <i class="fas fa-arrow-trend-down text-blue-400"></i> LS증권 실시간 하락/약세 5대 업종 (t8424 / t1531 파싱)
            </span>
            <span class="text-[10px] text-blue-400 font-mono">실시간 하락률 순</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <template v-if="screenerStore.bottomSectors && screenerStore.bottomSectors.length > 0">
              <span 
                v-for="s in screenerStore.bottomSectors" 
                :key="s.code" 
                class="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs font-semibold flex items-center gap-1 shadow-xs"
              >
                <span>{{ s.name }}</span>
                <span class="font-extrabold text-[11px] font-mono" :class="s.rate < 0 ? 'text-blue-400' : (s.rate > 0 ? 'text-rose-400' : 'text-sky-400')">{{ s.rate >= 0 ? '+' : '' }}{{ s.rate }}%</span>
              </span>
            </template>
            <template v-else>
              <span class="text-xs text-slate-400">하락 업종 파싱 중...</span>
            </template>
          </div>
        </div>

        <div class="space-y-3 text-xs text-slate-300 leading-relaxed">
          <!-- Section 1: Comprehensive Market Perspective (Rule-Based + AI Hybrid) -->
          <div class="bg-indigo-950/30 border border-indigo-500/30 p-4 rounded-xl space-y-3 relative overflow-hidden">
            <div class="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-500/20 pb-2">
              <h4 class="font-bold text-indigo-300 flex items-center gap-1.5 text-sm">
                <i class="fas fa-shield-alt text-indigo-400"></i> 1. 종합 시장 관점 및 리스크 관리
              </h4>
              <button 
                @click="triggerAiDiagnosis" 
                :disabled="screenerStore.isAiAnalyzing"
                class="px-3 py-1 rounded-lg bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-[11px] shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <i class="fas" :class="screenerStore.isAiAnalyzing ? 'fa-spinner fa-spin text-amber-300' : 'fa-robot text-purple-300'"></i>
                <span>{{ screenerStore.isAiAnalyzing ? 'Claude AI 정밀 분석 중...' : (screenerStore.aiMarketAnalysis ? '🤖 AI 재진단 갱신' : '🤖 Claude AI 정밀 진단') }}</span>
              </button>
            </div>

            <!-- AI Diagnosis Result (When available) -->
            <div v-if="screenerStore.aiMarketAnalysis" class="bg-purple-950/40 border border-purple-500/40 p-3 rounded-lg space-y-1.5 shadow-md">
              <div class="flex items-center justify-between text-[10px] text-purple-300 font-bold border-b border-purple-500/20 pb-1">
                <span><i class="fas fa-sparkles text-amber-300"></i> Anthropic Claude AI 수석 분석가 정밀 진단</span>
                <span class="font-mono text-purple-400">작성일시: {{ screenerStore.aiMarketAnalysis.createdAt }}</span>
              </div>
              <p class="text-slate-200 text-xs font-medium leading-relaxed whitespace-pre-line">
                {{ screenerStore.aiMarketAnalysis.content }}
              </p>
            </div>

            <!-- Rule-Based Perspective (0ms Default) -->
            <div class="space-y-1">
              <div class="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">
                실시간 룰 베이스 시장 총평 (0ms 지표 자동 연산):
              </div>
              <p class="text-slate-300 text-xs leading-relaxed">
                {{ ruleBasedPerspective }}
              </p>
            </div>

            <div v-if="aiError" class="text-rose-400 text-[11px] bg-rose-950/60 p-2 rounded border border-rose-500/30">
              <i class="fas fa-exclamation-triangle mr-1"></i> {{ aiError }}
            </div>
          </div>

          <!-- Section 2: Precise Buy/Sell Response Guideline -->
          <div class="bg-emerald-950/20 border border-emerald-500/20 p-4 rounded-xl space-y-2">
            <h4 class="font-bold text-emerald-300 flex items-center gap-1.5 text-sm">
              <i class="fas fa-bullseye text-emerald-400"></i> 2. 정밀 매수/매도 대응 가이드라인
            </h4>
            <ul class="list-disc list-inside space-y-1.5 text-slate-300">
              <li><strong class="text-emerald-400">매수 전략</strong>: {{ buyStrategy }}</li>
              <li><strong class="text-indigo-300">기술적 동적 목표가</strong>: {{ targetPriceStrategy }}</li>
              <li><strong class="text-rose-400">기술적 동적 손절가</strong>: {{ stopLossStrategy }}</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Top Recommended Buy Signals (Right 1 col) -->
      <div class="bg-slate-900/80 border border-indigo-500/30 rounded-2xl p-6 space-y-4 shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <i class="fas fa-bolt text-yellow-400"></i>
            <span>🎯 관심종목 퀀트 매수 추천 (Top 3)</span>
          </h3>
          <span 
            v-if="screenerStore.has85PlusMatched" 
            class="text-[10px] px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-extrabold flex items-center gap-1"
          >
            <i class="fas fa-check-circle"></i> 85점+ 포착
          </span>
          <span 
            v-else 
            class="text-[10px] px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-extrabold flex items-center gap-1"
          >
            <i class="fas fa-info-circle text-amber-400"></i> 85점 이상 없음 (상위 Top 3)
          </span>
        </div>

        <div v-if="screenerStore.isRefreshing" class="text-center py-8 text-slate-400 text-xs flex items-center justify-center gap-2">
          <i class="fas fa-spinner fa-spin text-purple-400 text-sm"></i>
          <span>LS증권 Open API 시세 및 퀀트 지표 분석 중입니다...</span>
        </div>

        <div v-else-if="screenerStore.topBuyRecommendations.length === 0" class="text-center py-8 text-slate-500 text-xs">
          분석 데이터가 존재하지 않습니다. 관심종목을 등록해 주세요.
        </div>

        <div v-else class="space-y-3">
          <div 
            v-for="(item, idx) in screenerStore.topBuyRecommendations" 
            :key="item.shcode"
            class="bg-slate-950/80 border p-3.5 rounded-xl space-y-2 transition-all hover:scale-[1.01]"
            :class="item.score >= 85 ? 'border-emerald-500/50 shadow-emerald-500/5 shadow-md' : 'border-slate-800'"
          >
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-5 h-5 rounded-full bg-slate-800 text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center">
                  {{ idx + 1 }}
                </span>
                <span class="font-bold text-white text-xs">{{ item.name }}</span>
                <span class="text-[10px] text-slate-400 font-mono">({{ item.shcode }})</span>
              </div>
              <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {{ item.score }}점 / 100점
              </span>
            </div>

            <div class="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
              <div class="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                <span class="text-slate-400 text-[10px]">전일종가:</span>
                <strong class="text-slate-200">{{ item.previousClosePrice && item.previousClosePrice > 0 ? Number(item.previousClosePrice).toLocaleString() + '원' : '-' }}</strong>
              </div>
              <div class="flex items-center justify-between bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                <span class="text-slate-400 text-[10px]">현재가:</span>
                <strong
                  :class="typeof item.previousClosePrice === 'number' && item.previousClosePrice > 0
                    ? item.closePrice > item.previousClosePrice
                      ? 'text-red-400'
                      : item.closePrice < item.previousClosePrice
                        ? 'text-blue-400'
                        : 'text-sky-400'
                    : 'text-slate-400'"
                >{{ Number(item.closePrice).toLocaleString() }}원</strong>
              </div>
            </div>

            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
              <span>RSI: <strong class="text-cyan-400">{{ typeof item.rsi === 'number' ? item.rsi : 'N/A' }}</strong></span>
              <span>거래량: <strong class="text-amber-400">{{ typeof item.volumeRatio === 'number' ? item.volumeRatio + '%' : 'N/A' }}</strong></span>
              <NuxtLink to="/screener" class="text-indigo-400 hover:underline text-[10px] font-bold">상세보기 &rarr;</NuxtLink>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Stock Edit / Add Modal Component -->
    <StockEditModal
      :is-open="isModalOpen"
      :initial-data="selectedStockForEdit"
      @close="isModalOpen = false"
      @saved="handleStockSaved"
    />
    <ShortSellQuantityModal
      :is-open="isShortSellQuantityModalOpen"
      @close="isShortSellQuantityModalOpen = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { usePortfolioStore } from '~/stores/usePortfolioStore';
import { useScreenerStore } from '~/stores/useScreenerStore';
import { useLSStockRawStore } from '~/stores/useLSStockRawStore';
import { useMarketStrategy } from '~/composables/useMarketStrategy';
import { useGlobalToast } from '~/composables/useGlobalToast';
import StockEditModal, { type StockItemForm } from '~/components/StockEditModal.vue';
import ShortSellQuantityModal from '~/components/shortselling/ShortSellQuantityModal.vue';

const portfolioStore = usePortfolioStore();
const screenerStore = useScreenerStore();
const rawStore = useLSStockRawStore();
const toast = useGlobalToast();
const { ruleBasedPerspective, buyStrategy, targetPriceStrategy, stopLossStrategy } = useMarketStrategy();

const isModalOpen = ref(false);
const isShortSellQuantityModalOpen = ref(false);
const selectedStockForEdit = ref<StockItemForm | null>(null);
const aiError = ref<string | null>(null);

async function handleDashboardRefresh() {
  try {
    await screenerStore.refreshScreener(true);
    await portfolioStore.fetchHoldings(true);
    toast.success('LS증권 실시간 시세 및 8대 지표 갱신이 완료되었습니다.', '실시간 시세 갱신 완료');
  } catch (err: any) {
    toast.error(err.message || '시세 갱신에 실패했습니다.', '시세 갱신 오류');
  }
}

function openAddModal() {
  selectedStockForEdit.value = null;
  isModalOpen.value = true;
}

async function handleStockSaved() {
  await portfolioStore.fetchHoldings(true);
  await screenerStore.loadInitial(true);
}

async function triggerAiDiagnosis() {
  aiError.value = null;
  try {
    await screenerStore.runAiMarketDiagnosis();
  } catch (err: any) {
    aiError.value = err.statusMessage || err.message || 'Claude AI 정밀 진단 호출 중 오류가 발생했습니다.';
  }
}

onMounted(async () => {
  await screenerStore.loadInitial(false);
  await portfolioStore.fetchHoldings(true);
});

function formatKrw(val: number) {
  if (val === null || val === undefined || isNaN(val)) return '0원';
  return Number(val).toLocaleString() + '원';
}
</script>
