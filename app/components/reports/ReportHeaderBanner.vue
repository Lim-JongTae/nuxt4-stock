<template>
  <div class="bg-gradient-to-r from-slate-900 via-indigo-950/60 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
    <div class="absolute -right-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
    <div class="flex flex-wrap items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 mb-2">
          <span class="px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold text-xs">
            <i class="fas fa-brain mr-1"></i> AI 종합 퀀트 분석 대시보드
          </span>
          <span class="px-2.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>수집시각: {{ lastUpdated || '실시간' }} (15일 보존 정책)</span>
          </span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          AI 퀀트 종합 주식 투자 분석 리포트
        </h1>
        <p class="text-xs text-slate-400 mt-1">
          LS증권 Open API 실시간 시세와 8대 기술적 지표 및 Anthropic Claude 퀀트 진단 결과를 일목요약하게 통합 제공합니다.
        </p>
      </div>

      <div class="flex items-center gap-3">
        <button 
          @click="$emit('refresh')" 
          :disabled="isRefreshing"
          class="px-4 py-2.5 rounded-xl bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
        >
          <i class="fas" :class="isRefreshing ? 'fa-spinner fa-spin' : 'fa-sync-alt'"></i>
          <span>{{ isRefreshing ? 'LS증권 API 시세 수집 중...' : '실시간 시세 & 스토어 갱신' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  lastUpdated: string;
  isRefreshing: boolean;
}>();

defineEmits<{
  (e: 'refresh'): void;
}>();
</script>
