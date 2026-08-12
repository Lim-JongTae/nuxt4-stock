<template>
  <div class="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-xs">
            <i class="fas fa-file-alt mr-1"></i> AI 리포트 아카이브
          </span>
          <span class="text-xs text-slate-400">일자별 AI 종합 시장 분석 & 대응 보고서</span>
        </div>
        <h2 class="text-xl font-extrabold text-white">
          AI 주식 투자 보고서 모음집
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Anthropic Claude와 LS증권 Open API 데이터로 동적 생성 및 작성된 일자별 리포트입니다.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <label class="text-xs text-slate-400">보고서 선택:</label>
        <select 
          v-model="selectedDate" 
          @change="fetchReportData" 
          class="bg-slate-950 text-xs text-white border border-slate-700 px-3 py-2 rounded-xl focus:outline-none focus:border-amber-500 hover:cursor-pointer cursor-pointer"
        >
          <option v-for="item in reportsList" :key="item.date" :value="item.date">
            {{ item.date }} 시장 보고서
          </option>
        </select>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="isLoading" class="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
      <i class="fas fa-spinner fa-spin text-2xl text-amber-400 mb-2"></i>
      <p class="text-sm">보고서 데이터를 불러오는 중입니다...</p>
    </div>

    <!-- Active Report Display Card -->
    <div v-else-if="currentReport" class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i class="fas fa-book-open text-amber-400"></i>
          <span>{{ selectedDate }} AI 종합 주식 분석 및 대응 전략 보고서</span>
        </h3>
        <span class="text-xs px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
          {{ currentReport.data_provider || 'LS증권 Open API 기반' }}
        </span>
      </div>

      <!-- Executive Overview / Summary -->
      <div class="bg-amber-950/20 border border-amber-500/30 p-5 rounded-xl space-y-2">
        <h4 class="font-bold text-amber-300 text-sm flex items-center gap-1.5">
          <i class="fas fa-bullhorn text-amber-400"></i>
          <span>📌 핵심 요약 (Executive Summary)</span>
        </h4>
        <p class="text-xs text-slate-200 leading-relaxed font-sans">
          {{ currentReport.overview || currentReport.summary || '보고서 요약 데이터가 존재하지 않습니다.' }}
        </p>
      </div>

      <!-- Top Sectors (유망 업종 3선) -->
      <div v-if="currentReport.top_sectors && currentReport.top_sectors.length" class="space-y-3">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-layer-group text-cyan-400"></i>
          <span>📊 유망 업종 TOP 3 분석</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div 
            v-for="sec in currentReport.top_sectors" 
            :key="sec.rank" 
            class="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2 hover:border-slate-700 transition"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-400">#{{ sec.rank }} {{ sec.sector_name }}</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                {{ sec.momentum }}
              </span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">
              {{ sec.reason }}
            </p>
          </div>
        </div>
      </div>

      <!-- Market Direction Indicator -->
      <div v-if="currentReport.market_direction" class="space-y-3">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-compass text-indigo-400"></i>
          <span>🧭 시장 방향성 지표</span>
        </h4>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div class="bg-slate-950/70 border border-slate-800 p-3 rounded-xl text-center">
            <span class="text-[10px] text-slate-400 block mb-1">선물 베이시스</span>
            <span class="text-xs font-bold text-emerald-400">{{ currentReport.market_direction.futures_basis || '-' }}</span>
          </div>
          <div class="bg-slate-950/70 border border-slate-800 p-3 rounded-xl text-center">
            <span class="text-[10px] text-slate-400 block mb-1">시장 심리</span>
            <span class="text-xs font-bold text-cyan-400">{{ currentReport.market_direction.market_sentiment || '-' }}</span>
          </div>
          <div class="bg-slate-950/70 border border-slate-800 p-3 rounded-xl text-center">
            <span class="text-[10px] text-slate-400 block mb-1">미결제약정(OI)</span>
            <span class="text-xs font-bold text-amber-300">{{ currentReport.market_direction.open_interest_oi || '-' }}</span>
          </div>
          <div class="bg-slate-950/70 border border-slate-800 p-3 rounded-xl text-center">
            <span class="text-[10px] text-slate-400 block mb-1">VKOSPI</span>
            <span class="text-xs font-bold text-indigo-400">{{ currentReport.market_direction.vkospi_level || '-' }}</span>
          </div>
          <div class="bg-slate-950/70 border border-slate-800 p-3 rounded-xl text-center col-span-2 sm:col-span-1">
            <span class="text-[10px] text-slate-400 block mb-1">프로그램 매매</span>
            <span class="text-xs font-bold text-purple-300">{{ currentReport.market_direction.program_trading || '-' }}</span>
          </div>
        </div>
      </div>

      <!-- General Strategy / Tactical Analysis -->
      <div class="space-y-2 pt-2 border-t border-slate-800">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-crosshairs text-emerald-400"></i>
          <span>🎯 정밀 매수/매도 대응 전략 (LS증권 API 퀀트 수급 진단)</span>
        </h4>
        <ul class="list-disc list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <li><strong>매수가 설정</strong>: 볼린저 하단 밴드 102% 이내 수렴 구간에서 1차 분할 매수 진입.</li>
          <li><strong>목표가 (Take Profit)</strong>: RRR 1:2 기준 +8.0% 1차 익절, 볼린저 상단 터치 시 2차 익절.</li>
          <li><strong>손절가 (Stop Loss)</strong>: 매수가 대비 -4.5% 기계적 손절 라인 준수.</li>
        </ul>
      </div>

      <!-- Holdings & Watchlist Summary in Report -->
      <div v-if="currentReport.holdings && currentReport.holdings.length" class="space-y-3 pt-2">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-wallet text-purple-400"></i>
          <span>보유 종목 분석 진단</span>
        </h4>
        <div class="space-y-2">
          <div 
            v-for="h in currentReport.holdings" 
            :key="h.shcode" 
            class="bg-slate-950/60 border border-slate-800 p-3.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
          >
            <div>
              <span class="font-bold text-white text-sm mr-2">{{ h.name }}</span>
              <span class="text-slate-400 font-mono">({{ h.shcode }})</span>
            </div>
            <div class="text-slate-300 leading-relaxed md:max-w-2xl">
              {{ h.technical_analysis?.verdict || h.reason || '보유 유망 의견 유지' }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

interface ReportListItem {
  date: string;
  summary: string;
  overview?: string;
}

const selectedDate = ref('');
const reportsList = ref<ReportListItem[]>([]);
const currentReport = ref<any>(null);
const isLoading = ref(false);

async function loadReportsList() {
  isLoading.value = true;
  try {
    const data = await $fetch<any>('/api/reports');
    if (data && Array.isArray(data.reportsList)) {
      reportsList.value = data.reportsList;
      if (reportsList.value.length > 0) {
        selectedDate.value = reportsList.value[0].date;
        currentReport.value = data.report || null;
      }
    }
  } catch (err) {
    console.error('Failed to load reports:', err);
  } finally {
    isLoading.value = false;
  }
}

async function fetchReportData() {
  if (!selectedDate.value) return;
  isLoading.value = true;
  try {
    const data = await $fetch<any>(`/api/reports?date=${selectedDate.value}`);
    if (data && data.report) {
      currentReport.value = data.report;
    }
  } catch (err) {
    console.error('Failed to fetch specific report:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadReportsList();
});
</script>
