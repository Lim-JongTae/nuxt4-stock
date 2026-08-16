<template>
  <div class="space-y-6 max-w-7xl mx-auto p-4 sm:p-6">
    <!-- Header Banner -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <span class="px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400 border border-amber-500/40 font-bold text-xs">
            <i class="fas fa-file-alt mr-1"></i> AI 퀀트 리포트 아카이브
          </span>
          <span class="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>Pinia Store 중앙집중 관리</span>
          </span>
        </div>
        <h2 class="text-xl font-extrabold text-white">
          Pinia 스토어 중앙집중식 AI 주식 투자 보고서
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          LS증권 Open API 실시간 시세 및 Pinia Store 캐시(30일 보존) 기반 8대 기술적 지표 AI 퀀트 종합 진단입니다.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="loadLiveReport" 
          :disabled="screenerStore.isRefreshing"
          class="px-4 py-2 rounded-xl bg-linear-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <i class="fas" :class="screenerStore.isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ screenerStore.isRefreshing ? 'LS증권 API 시세 수집 중...' : '스토어 데이터 새로고침' }}</span>
        </button>
      </div>
    </div>

    <!-- Active Report Display Card -->
    <div class="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i class="fas fa-book-open text-amber-400"></i>
          <span>LS증권 라이브 퀀트 지표 & Anthropic Claude AI 진단</span>
        </h3>
        <span class="text-xs px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
          수집 시각: {{ screenerStore.lastUpdated || '실시간' }}
        </span>
      </div>

      <!-- Executive Overview / Summary -->
      <div class="bg-amber-950/20 border border-amber-500/30 p-5 rounded-xl space-y-2">
        <h4 class="font-bold text-amber-300 text-sm flex items-center gap-1.5">
          <i class="fas fa-bullhorn text-amber-400"></i>
          <span>📌 중앙집중형 스토어 수집 상태 (Pinia Live Summary)</span>
        </h4>
        <p class="text-xs text-slate-200 leading-relaxed font-sans">
          정적 디스크 정적 파일(CSV, JSON)은 완전 폐기되었으며, LS증권 Open API를 통해 수집된 전 종목 최신 8대 지표 수치({{ screenerStore.newData.length }}개 종목)가 Pinia Store 및 LocalStorage에 단일 데이터 원천(Single Source of Truth)으로 안전하게 중앙 유지되고 있습니다.
        </p>
      </div>

      <!-- Top Recommendations (퀀트 점수 상위 종목) -->
      <div v-if="screenerStore.topBuyRecommendations && screenerStore.topBuyRecommendations.length" class="space-y-3">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-award text-amber-400"></i>
          <span>🏆 8대 기술적 지표 퀀트 점수 상위 종목</span>
        </h4>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div 
            v-for="(item, idx) in screenerStore.topBuyRecommendations" 
            :key="item.shcode" 
            class="bg-slate-950/70 border border-slate-800 p-4 rounded-xl space-y-2 hover:border-slate-700 transition"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-amber-400">#{{ idx + 1 }} {{ item.name }} ({{ item.shcode }})</span>
              <span class="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                {{ item.score }}점 / 100점
              </span>
            </div>
            <div class="text-xs text-slate-300 space-y-1">
              <div>현재가: <strong class="text-emerald-400 font-mono">{{ Number(item.closePrice).toLocaleString() }}원</strong></div>
              <div>심리선(PSY): <span class="font-mono text-slate-200">{{ item.psy ?? '-' }}</span> | RSI(14): <span class="font-mono text-slate-200">{{ item.rsi ?? '-' }}</span></div>
              <div class="text-[11px] text-cyan-300/90 truncate">{{ item.shortSellingStatus || '판단 보류' }}</div>
            </div>
            <div class="pt-2">
              <NuxtLink 
                :to="'/stock/' + item.shcode" 
                class="block text-center py-1.5 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/30 text-xs font-bold transition-all"
              >
                Claude AI 정밀 진단서 보기 &rarr;
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>

      <!-- General Strategy / Tactical Analysis -->
      <div class="space-y-2 pt-2 border-t border-slate-800">
        <h4 class="font-bold text-white text-sm flex items-center gap-2">
          <i class="fas fa-crosshairs text-emerald-400"></i>
          <span>🎯 중앙집중 데이터 원천 및 저장소 정책</span>
        </h4>
        <ul class="list-disc list-inside space-y-1.5 text-xs text-slate-300 leading-relaxed bg-slate-950/50 p-4 rounded-xl border border-slate-800">
          <li><strong>단일 데이터 저장 원천</strong>: 모든 시세 및 지표는 Pinia Store 및 LocalStorage에 덮어쓰기 방식으로 자동 유지됩니다.</li>
          <li><strong>실시간 새로고침 (F5)</strong>: 새로고침 시 LS증권 Open API를 즉시 재호출하여 최신 시세로 자동으로 실시간 갱신합니다.</li>
          <li><strong>자동 클린업 정책</strong>: 30일 경과 노후 데이터는 스토어에서 자동 정리되어 브라우저 메모리를 쾌적하게 유지합니다.</li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useScreenerStore } from '~/stores/useScreenerStore';

const screenerStore = useScreenerStore();

function loadLiveReport() {
  screenerStore.refreshScreener();
}

onMounted(() => {
  screenerStore.initFromStorage();
  if (!screenerStore.newData || screenerStore.newData.length === 0) {
    screenerStore.refreshScreener();
  }
});
</script>
